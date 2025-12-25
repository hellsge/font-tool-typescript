/**
 * Vector Font Generator
 * 
 * Generates vector font files from TrueType fonts.
 * Stores glyph contours as windings (closed paths) with bounding box
 * and advance width information.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.5, 5.6, 9.2
 */

import * as fs from 'fs';
import { FontGenerator } from './font-generator';
import { FontConfig, IndexMethod } from './types';
import { VectorGlyphData } from './types/binary';
import { VectorFontHeader, VectorFontHeaderConfig } from './vector-font-header';
import { BinaryWriter } from './binary-writer';
import { GlyphOutline } from './font-parser';
import {
  BINARY_FORMAT,
  FILE_NAMING
} from './constants';
import {
  createGlyphRenderFailedError,
  createFileWriteError
} from './errors';
import { PathUtils } from './path-utils';

/**
 * Processed vector glyph with all data
 */
interface ProcessedVectorGlyph {
  /** Unicode code point */
  unicode: number;
  /** Glyph data */
  data: VectorGlyphData;
}

/**
 * Index entry for the index array
 */
interface IndexEntry {
  /** Unicode code point */
  unicode: number;
  /** File offset */
  offset: number;
}

/**
 * VectorFontGenerator class
 * Generates vector font files from TrueType fonts
 */
export class VectorFontGenerator extends FontGenerator {
  /** Processed glyphs */
  private glyphs: Map<number, ProcessedVectorGlyph> = new Map();

  /**
   * Creates a new VectorFontGenerator
   * 
   * @param config - Font configuration
   */
  constructor(config: FontConfig) {
    super(config);
  }

  /**
   * Generate the vector font file
   * 
   * Process:
   * 1. Load font
   * 2. Load character set
   * 3. Extract all glyph outlines
   * 4. Create header
   * 5. Create index array
   * 6. Write binary file
   * 7. Write character set file
   * 8. Write failed characters file (if any)
   */
  async generate(): Promise<void> {
    try {
      // Load font and character set
      await this.loadFont();
      await this.loadCharacterSet();
      
      // Ensure output directory exists
      await this.ensureOutputDirectory();
      
      // Extract all glyph outlines
      await this.extractAllGlyphs();
      
      // Generate output filename
      const baseName = this.generateOutputBaseName();
      
      // Create header
      const header = this.createHeader();
      
      // Create index array
      const indexArray = this.createIndexArray();
      
      // Write binary file
      const binPath = PathUtils.join(this.config.outputPath, baseName + '.bin');
      this.trackPartialFile(binPath);
      await this.writeBinaryFile(baseName, header, indexArray);
      
      // Write character set file
      const cstPath = PathUtils.join(this.config.outputPath, baseName + '.cst');
      this.trackPartialFile(cstPath);
      await this.writeCharacterSetFile(baseName);
      
      // Write failed characters file
      if (this.failedCharacters.length > 0) {
        const failedPath = PathUtils.join(this.config.outputPath, FILE_NAMING.UNSUPPORTED_CHARS_FILE);
        this.trackPartialFile(failedPath);
        await this.writeFailedCharactersFile();
      }
      
      // Clear partial file tracking on success
      this.partialOutputFiles = [];
    } catch (error) {
      // Clean up partial files on error
      this.cleanupPartialFiles();
      throw error;
    }
  }

  /**
   * Extract all glyph outlines in the character set
   */
  private async extractAllGlyphs(): Promise<void> {
    for (const unicode of this.characters) {
      try {
        const glyph = await this.extractGlyph(unicode);
        if (glyph) {
          this.glyphs.set(unicode, glyph);
        } else {
          this.recordFailedCharacter(unicode);
        }
      } catch (error) {
        // Record failed character and continue
        this.recordFailedCharacter(unicode);
      }
    }
  }

  /**
   * Extract a single glyph outline
   * 
   * @param unicode - Unicode code point
   * @returns Processed glyph or null if extraction failed
   */
  private async extractGlyph(unicode: number): Promise<ProcessedVectorGlyph | null> {
    if (!this.parsedFont) {
      return null;
    }

    // Get glyph outline from font parser
    const outline = this.fontParser.getGlyphOutline(unicode);
    
    if (!outline || outline.contours.length === 0) {
      return null;
    }

    // Convert outline to vector glyph data
    const data = this.convertOutlineToVectorData(outline);
    
    return {
      unicode,
      data
    };
  }

  /**
   * Convert glyph outline to vector glyph data format
   * 
   * @param outline - Glyph outline from font parser
   * @returns Vector glyph data
   */
  private convertOutlineToVectorData(outline: GlyphOutline): VectorGlyphData {
    const { boundingBox, advanceWidth, contours } = outline;
    
    // Prepare winding data
    const windingCount = contours.length;
    const windingLengths: number[] = [];
    const windings: number[] = [];
    
    // Process each contour (winding)
    for (const contour of contours) {
      windingLengths.push(contour.length);
      
      // Add all points from this contour
      for (const point of contour) {
        windings.push(point.x);
        windings.push(point.y);
      }
    }
    
    return {
      sx0: boundingBox.x1,
      sy0: boundingBox.y1,
      sx1: boundingBox.x2,
      sy1: boundingBox.y2,
      advance: advanceWidth,
      windingCount,
      windingLengths,
      windings
    };
  }

  /**
   * Create the vector font header
   */
  private createHeader(): VectorFontHeader {
    if (!this.parsedFont) {
      throw new Error('Font not loaded');
    }

    const config: VectorFontHeaderConfig = {
      fontName: this.getFontName(),
      fontSize: this.config.fontSize,
      renderMode: 0, // Unused for vector fonts
      bold: this.config.bold,
      italic: this.config.italic,
      indexMethod: this.config.indexMethod,
      ascent: this.parsedFont.metrics.ascent,
      descent: this.parsedFont.metrics.descent,
      lineGap: this.parsedFont.metrics.lineGap,
      characterCount: this.glyphs.size
    };
    
    return new VectorFontHeader(config);
  }

  /**
   * Create the index array based on index method
   * 
   * Index modes for vector fonts:
   * 1. indexMethod=ADDRESS: 65536 × 4 bytes (file offsets)
   * 2. indexMethod=OFFSET: N × 6 bytes (unicode + file offset)
   */
  private createIndexArray(): IndexEntry[] {
    const entries: IndexEntry[] = [];
    
    if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 entries with file offsets
      // Initialize all entries with 0x00000000 (unused)
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        entries.push({ unicode: i, offset: 0 });
      }
      
      // Update entries for existing glyphs (offsets will be calculated during write)
      for (const [unicode] of this.glyphs) {
        entries[unicode].offset = 0; // Placeholder, will be updated during write
      }
    } else {
      // Offset mode: N entries with unicode + file offset
      // Sort by unicode for consistent output
      const sortedUnicodes = Array.from(this.glyphs.keys()).sort((a, b) => a - b);
      
      for (const unicode of sortedUnicodes) {
        entries.push({ unicode, offset: 0 }); // Offset will be calculated during write
      }
    }
    
    return entries;
  }

  /**
   * Generate output base name for files
   * Format: [fontName]_vector
   */
  private generateOutputBaseName(): string {
    const fontName = this.getFontName();
    return `${fontName}_vector`;
  }

  /**
   * Generate output filename
   * Format: [fontName]_vector.bin
   */
  generateOutputFilename(): string {
    return this.generateOutputBaseName() + '.bin';
  }

  /**
   * Write the binary font file
   */
  private async writeBinaryFile(
    baseName: string,
    header: VectorFontHeader,
    indexArray: IndexEntry[]
  ): Promise<void> {
    const filePath = PathUtils.join(this.config.outputPath, baseName + '.bin');
    
    // Calculate total file size
    const headerSize = header.getSize();
    const indexSize = header.indexAreaSize;
    
    // Calculate glyph data size
    let glyphDataSize = 0;
    for (const glyph of this.glyphs.values()) {
      glyphDataSize += this.calculateGlyphDataSize(glyph.data);
    }
    
    const totalSize = headerSize + indexSize + glyphDataSize;
    const writer = new BinaryWriter(totalSize);
    
    // Write header
    const headerBytes = header.toBytes();
    writer.writeBytes(headerBytes);
    
    // Write index array (placeholder values)
    const indexStartOffset = writer.getOffset();
    this.writeIndexArray(writer, indexArray);
    
    // Write glyph data and update index array with file offsets
    const glyphDataStartOffset = writer.getOffset();
    await this.writeGlyphData(writer, indexArray, indexStartOffset);
    
    // Write to file
    try {
      fs.writeFileSync(filePath, writer.getBuffer());
    } catch (error) {
      throw createFileWriteError(filePath, error as Error);
    }
  }

  /**
   * Calculate the size of a glyph's data in bytes
   */
  private calculateGlyphDataSize(data: VectorGlyphData): number {
    let size = 0;
    size += 2; // sx0 (int16)
    size += 2; // sy0 (int16)
    size += 2; // sx1 (int16)
    size += 2; // sy1 (int16)
    size += 2; // advance (uint16)
    size += 2; // windingCount (uint16)
    size += data.windingCount * 2; // windingLengths (uint16 each)
    size += data.windings.length * 2; // points (int16 each)
    return size;
  }

  /**
   * Write the index array to the binary writer
   */
  private writeIndexArray(
    writer: BinaryWriter,
    indexArray: IndexEntry[]
  ): void {
    if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 × 4 bytes (uint32 file offsets)
      // Initially write placeholder values (0x00000000)
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        writer.writeUint32LE(0);
      }
    } else {
      // Offset mode: N × 6 bytes (uint16 unicode + uint32 offset)
      // Write placeholder values
      for (const entry of indexArray) {
        writer.writeUint16LE(entry.unicode);
        writer.writeUint32LE(0); // Placeholder offset
      }
    }
  }

  /**
   * Write glyph data to the binary writer
   * Also updates the index array with file offsets
   */
  private async writeGlyphData(
    writer: BinaryWriter,
    indexArray: IndexEntry[],
    indexStartOffset: number
  ): Promise<void> {
    // Sort glyphs by unicode for consistent output
    const sortedGlyphs = Array.from(this.glyphs.entries())
      .sort((a, b) => a[0] - b[0]);
    
    for (let i = 0; i < sortedGlyphs.length; i++) {
      const [unicode, glyph] = sortedGlyphs[i];
      const glyphOffset = writer.getOffset();
      
      // Update index array with file offset
      if (this.config.indexMethod === IndexMethod.ADDRESS) {
        // Address mode: update entry at unicode position
        const indexOffset = indexStartOffset + unicode * 4;
        writer.writeUint32LEAt(indexOffset, glyphOffset);
      } else {
        // Offset mode: update entry at position i
        const indexOffset = indexStartOffset + i * 6 + 2; // +2 to skip unicode field
        writer.writeUint32LEAt(indexOffset, glyphOffset);
      }
      
      // Write glyph data
      this.writeGlyphDataFields(writer, glyph.data);
    }
  }

  /**
   * Write glyph data fields to the binary writer
   */
  private writeGlyphDataFields(writer: BinaryWriter, data: VectorGlyphData): void {
    // Write bounding box (4 × int16)
    writer.writeInt16LE(data.sx0);
    writer.writeInt16LE(data.sy0);
    writer.writeInt16LE(data.sx1);
    writer.writeInt16LE(data.sy1);
    
    // Write advance width (uint16)
    writer.writeUint16LE(data.advance);
    
    // Write winding count (uint16)
    writer.writeUint16LE(data.windingCount);
    
    // Write winding lengths (uint16 each)
    for (const length of data.windingLengths) {
      writer.writeUint16LE(length);
    }
    
    // Write all points (int16 each)
    for (const coord of data.windings) {
      writer.writeInt16LE(coord);
    }
  }

  /**
   * Get the number of successfully extracted glyphs
   */
  getGlyphCount(): number {
    return this.glyphs.size;
  }
}
