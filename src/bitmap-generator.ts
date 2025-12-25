/**
 * Bitmap Font Generator
 * 
 * Generates bitmap font files from TrueType fonts.
 * Supports multiple render modes (1/2/4/8-bit), styles (bold, italic),
 * rotation, gamma correction, and cropping.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.5, 5.6, 5.7, 9.1, 9.2, 9.3
 */

import * as fs from 'fs';
import * as opentype from 'opentype.js';
import { FontGenerator } from './font-generator';
import { FontConfig, RenderMode, IndexMethod, Rotation } from './types';
import { BitmapGlyphData, CropInfo } from './types/binary';
import { BitmapFontHeader, BitmapFontHeaderConfig } from './bitmap-font-header';
import { BinaryWriter } from './binary-writer';
import { ImageProcessor } from './image-processor';
import {
  BINARY_FORMAT,
  FILE_NAMING,
  RENDER_MODE_BITS
} from './constants';
import {
  FontConverterError,
  ErrorCode,
  createGlyphRenderFailedError,
  createFileWriteError
} from './errors';
import { PathUtils } from './path-utils';

/**
 * Rendered glyph with all processing applied
 */
interface ProcessedGlyph {
  /** Unicode code point */
  unicode: number;
  /** Packed pixel data */
  pixelData: Uint8Array;
  /** Glyph width (after processing) */
  width: number;
  /** Glyph height (after processing) */
  height: number;
  /** Crop information (if cropping enabled) */
  cropInfo?: CropInfo;
  /** Advance width */
  advance: number;
}

/**
 * Index entry for the index array
 */
interface IndexEntry {
  /** Unicode code point */
  unicode: number;
  /** Character index or file offset depending on mode */
  value: number;
}

/**
 * BitmapFontGenerator class
 * Generates bitmap font files from TrueType fonts
 */
export class BitmapFontGenerator extends FontGenerator {
  /** Processed glyphs */
  private glyphs: Map<number, ProcessedGlyph> = new Map();
  
  /** Base glyph size (width and height before cropping) */
  private baseGlyphWidth: number = 0;
  private baseGlyphHeight: number = 0;

  /**
   * Creates a new BitmapFontGenerator
   * 
   * @param config - Font configuration
   */
  constructor(config: FontConfig) {
    super(config);
  }

  /**
   * Generate the bitmap font file
   * 
   * Process:
   * 1. Load font
   * 2. Load character set
   * 3. Render all glyphs
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
      
      // Calculate base glyph dimensions
      this.calculateBaseGlyphDimensions();
      
      // Render all glyphs
      await this.renderAllGlyphs();
      
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
   * Calculate base glyph dimensions based on font size
   * Dimensions are aligned to 8-pixel boundaries
   */
  private calculateBaseGlyphDimensions(): void {
    const fontSize = this.config.fontSize;
    
    // Base dimensions are typically fontSize + some padding
    // Align to 8-pixel boundaries for byte alignment
    const [alignedWidth, alignedHeight] = ImageProcessor.adjustDimensionsForAlignment(
      fontSize,
      fontSize
    );
    
    this.baseGlyphWidth = alignedWidth;
    this.baseGlyphHeight = alignedHeight;
  }

  /**
   * Render all glyphs in the character set
   */
  private async renderAllGlyphs(): Promise<void> {
    for (const unicode of this.characters) {
      try {
        const glyph = await this.renderGlyph(unicode);
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
   * Render a single glyph
   * 
   * @param unicode - Unicode code point
   * @returns Processed glyph or null if rendering failed
   */
  private async renderGlyph(unicode: number): Promise<ProcessedGlyph | null> {
    if (!this.parsedFont) {
      return null;
    }

    const font = this.parsedFont.opentypeFont;
    const glyph = font.charToGlyph(String.fromCodePoint(unicode));
    
    // Check if glyph exists (index 0 is typically .notdef)
    if (!glyph || glyph.index === 0) {
      return null;
    }

    // Get glyph metrics
    const advanceWidth = glyph.advanceWidth || 0;
    const fontSize = this.config.fontSize;
    const unitsPerEm = font.unitsPerEm;
    
    // Scale advance width to pixel size
    const scaledAdvance = Math.round((advanceWidth / unitsPerEm) * fontSize);

    // Render glyph to bitmap using opentype.js path
    let { pixels, width, height } = this.renderGlyphToBitmap(glyph, fontSize, unitsPerEm);
    
    if (width === 0 || height === 0) {
      // Empty glyph (like space) - create minimal bitmap
      width = Math.max(1, Math.round(scaledAdvance / 2));
      height = fontSize;
      pixels = new Uint8Array(width * height);
    }

    // Apply gamma correction
    if (this.config.gamma !== 1.0) {
      pixels = ImageProcessor.applyGamma(pixels, width, height, this.config.gamma);
    }

    // Apply bold effect
    if (this.config.bold) {
      const result = ImageProcessor.applyBold(pixels, width, height);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Apply italic effect
    if (this.config.italic) {
      const result = ImageProcessor.applyItalic(pixels, width, height);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Apply rotation
    if (this.config.rotation !== Rotation.ROTATE_0) {
      const result = ImageProcessor.rotateImage(pixels, width, height, this.config.rotation);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Handle cropping or padding
    let cropInfo: CropInfo | undefined;
    
    if (this.config.crop) {
      // Crop whitespace
      const cropResult = ImageProcessor.cropCharacter(pixels, width, height);
      pixels = cropResult.pixels;
      cropInfo = cropResult.cropInfo;
      width = cropInfo.validWidth;
      height = cropInfo.validHeight;
    } else {
      // Pad to aligned dimensions
      const padResult = ImageProcessor.padImageForAlignment(pixels, width, height);
      pixels = padResult.pixels;
      width = padResult.width;
      height = padResult.height;
    }

    // Pack pixels according to render mode
    const packedPixels = ImageProcessor.packPixels(
      pixels,
      width,
      height,
      this.config.renderMode
    );

    return {
      unicode,
      pixelData: packedPixels,
      width,
      height,
      cropInfo,
      advance: scaledAdvance
    };
  }

  /**
   * Render a glyph to a grayscale bitmap using opentype.js
   * 
   * @param glyph - OpenType glyph
   * @param fontSize - Target font size in pixels
   * @param unitsPerEm - Font units per em
   * @returns Grayscale pixel data and dimensions
   */
  private renderGlyphToBitmap(
    glyph: opentype.Glyph,
    fontSize: number,
    unitsPerEm: number
  ): { pixels: Uint8Array; width: number; height: number } {
    // Get glyph bounding box
    const bbox = glyph.getBoundingBox();
    
    // Scale factor
    const scale = fontSize / unitsPerEm;
    
    // Calculate dimensions
    const x1 = Math.floor(bbox.x1 * scale);
    const y1 = Math.floor(bbox.y1 * scale);
    const x2 = Math.ceil(bbox.x2 * scale);
    const y2 = Math.ceil(bbox.y2 * scale);
    
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    
    if (width <= 0 || height <= 0) {
      return { pixels: new Uint8Array(0), width: 0, height: 0 };
    }

    // Create pixel buffer
    const pixels = new Uint8Array(width * height);
    
    // Get glyph path
    const path = glyph.getPath(0, 0, fontSize);
    
    // Simple rasterization using path commands
    // This is a simplified approach - for production, consider using canvas or sharp
    this.rasterizePath(path, pixels, width, height, -x1, -y1 + height);
    
    return { pixels, width, height };
  }

  /**
   * Simple path rasterization
   * Uses scanline algorithm for filling
   */
  private rasterizePath(
    path: opentype.Path,
    pixels: Uint8Array,
    width: number,
    height: number,
    offsetX: number,
    offsetY: number
  ): void {
    // Collect all edges from path commands
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    for (const cmd of path.commands) {
      switch (cmd.type) {
        case 'M':
          currentX = cmd.x + offsetX;
          currentY = offsetY - cmd.y;
          startX = currentX;
          startY = currentY;
          break;
        case 'L':
          const lx = cmd.x + offsetX;
          const ly = offsetY - cmd.y;
          edges.push({ x1: currentX, y1: currentY, x2: lx, y2: ly });
          currentX = lx;
          currentY = ly;
          break;
        case 'Q':
          // Approximate quadratic curve with line segments
          const qx1 = cmd.x1 + offsetX;
          const qy1 = offsetY - cmd.y1;
          const qx2 = cmd.x + offsetX;
          const qy2 = offsetY - cmd.y;
          // Simple approximation with 4 segments
          for (let t = 0.25; t <= 1; t += 0.25) {
            const px = (1-t)*(1-t)*currentX + 2*(1-t)*t*qx1 + t*t*qx2;
            const py = (1-t)*(1-t)*currentY + 2*(1-t)*t*qy1 + t*t*qy2;
            edges.push({ x1: currentX, y1: currentY, x2: px, y2: py });
            currentX = px;
            currentY = py;
          }
          currentX = qx2;
          currentY = qy2;
          break;
        case 'C':
          // Approximate cubic curve with line segments
          const cx1 = cmd.x1 + offsetX;
          const cy1 = offsetY - cmd.y1;
          const cx2 = cmd.x2 + offsetX;
          const cy2 = offsetY - cmd.y2;
          const cx3 = cmd.x + offsetX;
          const cy3 = offsetY - cmd.y;
          // Simple approximation with 8 segments
          for (let t = 0.125; t <= 1; t += 0.125) {
            const t2 = t * t;
            const t3 = t2 * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const px = mt3*currentX + 3*mt2*t*cx1 + 3*mt*t2*cx2 + t3*cx3;
            const py = mt3*currentY + 3*mt2*t*cy1 + 3*mt*t2*cy2 + t3*cy3;
            edges.push({ x1: currentX, y1: currentY, x2: px, y2: py });
            currentX = px;
            currentY = py;
          }
          currentX = cx3;
          currentY = cy3;
          break;
        case 'Z':
          if (currentX !== startX || currentY !== startY) {
            edges.push({ x1: currentX, y1: currentY, x2: startX, y2: startY });
          }
          currentX = startX;
          currentY = startY;
          break;
      }
    }

    // Scanline fill algorithm
    for (let y = 0; y < height; y++) {
      const intersections: number[] = [];
      
      for (const edge of edges) {
        const { x1, y1, x2, y2 } = edge;
        
        // Check if scanline intersects this edge
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          // Calculate x intersection
          const t = (y - y1) / (y2 - y1);
          const x = x1 + t * (x2 - x1);
          intersections.push(x);
        }
      }
      
      // Sort intersections
      intersections.sort((a, b) => a - b);
      
      // Fill between pairs of intersections
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(width - 1, Math.ceil(intersections[i + 1]));
        
        for (let x = xStart; x <= xEnd; x++) {
          pixels[y * width + x] = 255;
        }
      }
    }
  }

  /**
   * Create the bitmap font header
   */
  private createHeader(): BitmapFontHeader {
    const config: BitmapFontHeaderConfig = {
      fontName: this.getFontName(),
      size: this.config.fontSize,
      fontSize: this.config.fontSize,
      renderMode: this.config.renderMode,
      bold: this.config.bold,
      italic: this.config.italic,
      indexMethod: this.config.indexMethod,
      crop: this.config.crop,
      characterCount: this.glyphs.size
    };
    
    return new BitmapFontHeader(config);
  }

  /**
   * Create the index array based on index method and crop settings
   * 
   * Index modes:
   * 1. crop=true: 65536 × 4 bytes (file offsets)
   * 2. crop=false, indexMethod=ADDRESS: 65536 × 2 bytes (character indices)
   * 3. crop=false, indexMethod=OFFSET: N × 4 bytes (unicode + char index)
   */
  private createIndexArray(): IndexEntry[] {
    const entries: IndexEntry[] = [];
    
    if (this.config.crop) {
      // Crop mode: will be filled with file offsets later
      // Initialize all entries with 0xFFFFFFFF (unused)
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        entries.push({ unicode: i, value: BINARY_FORMAT.UNUSED_INDEX_32 });
      }
      
      // Update entries for existing glyphs (offsets will be calculated during write)
      let charIndex = 0;
      for (const [unicode] of this.glyphs) {
        entries[unicode].value = charIndex; // Temporary: store char index
        charIndex++;
      }
    } else if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 entries with character indices
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        entries.push({ unicode: i, value: BINARY_FORMAT.UNUSED_INDEX_16 });
      }
      
      // Update entries for existing glyphs
      let charIndex = 0;
      for (const [unicode] of this.glyphs) {
        entries[unicode].value = charIndex;
        charIndex++;
      }
    } else {
      // Offset mode: N entries with unicode + char index
      let charIndex = 0;
      for (const [unicode] of this.glyphs) {
        entries.push({ unicode, value: charIndex });
        charIndex++;
      }
    }
    
    return entries;
  }

  /**
   * Generate output base name for files
   * Format: [fontName]_size[size]_bits[mode]_bitmap
   */
  private generateOutputBaseName(): string {
    const fontName = this.getFontName();
    const size = this.config.fontSize;
    const bits = this.config.renderMode;
    
    return `${fontName}${FILE_NAMING.SIZE_PREFIX}${size}${FILE_NAMING.BITS_PREFIX}${bits}_bitmap`;
  }

  /**
   * Generate output filename
   * Format: [fontName]_size[size]_bits[mode]_bitmap.bin
   */
  generateOutputFilename(): string {
    return this.generateOutputBaseName() + '.bin';
  }

  /**
   * Write the binary font file
   */
  private async writeBinaryFile(
    baseName: string,
    header: BitmapFontHeader,
    indexArray: IndexEntry[]
  ): Promise<void> {
    const filePath = PathUtils.join(this.config.outputPath, baseName + '.bin');
    
    // Calculate total file size
    const headerSize = header.getSize();
    const indexSize = header.indexAreaSize;
    
    // Calculate glyph data size
    let glyphDataSize = 0;
    for (const glyph of this.glyphs.values()) {
      if (this.config.crop) {
        glyphDataSize += 4; // CropInfo: 4 bytes
      }
      glyphDataSize += glyph.pixelData.length;
    }
    
    const totalSize = headerSize + indexSize + glyphDataSize;
    const writer = new BinaryWriter(totalSize);
    
    // Write header
    const headerBytes = header.toBytes();
    writer.writeBytes(headerBytes);
    
    // Write index array
    const indexStartOffset = writer.getOffset();
    this.writeIndexArray(writer, indexArray, header);
    
    // Write glyph data and update index array with file offsets (for crop mode)
    const glyphDataStartOffset = writer.getOffset();
    await this.writeGlyphData(writer, indexArray, indexStartOffset, glyphDataStartOffset);
    
    // Write to file
    try {
      fs.writeFileSync(filePath, writer.getBuffer());
    } catch (error) {
      throw createFileWriteError(filePath, error as Error);
    }
  }

  /**
   * Write the index array to the binary writer
   */
  private writeIndexArray(
    writer: BinaryWriter,
    indexArray: IndexEntry[],
    header: BitmapFontHeader
  ): void {
    if (this.config.crop) {
      // Crop mode: 65536 × 4 bytes (uint32 file offsets)
      // Initially write placeholder values, will be updated later
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        writer.writeUint32LE(BINARY_FORMAT.UNUSED_INDEX_32);
      }
    } else if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 × 2 bytes (uint16 character indices)
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        writer.writeUint16LE(indexArray[i].value);
      }
    } else {
      // Offset mode: N × 4 bytes (uint16 unicode + uint16 char index)
      for (const entry of indexArray) {
        writer.writeUint16LE(entry.unicode);
        writer.writeUint16LE(entry.value);
      }
    }
  }

  /**
   * Write glyph data to the binary writer
   * For crop mode, also updates the index array with file offsets
   */
  private async writeGlyphData(
    writer: BinaryWriter,
    indexArray: IndexEntry[],
    indexStartOffset: number,
    glyphDataStartOffset: number
  ): Promise<void> {
    // Sort glyphs by unicode for consistent output
    const sortedGlyphs = Array.from(this.glyphs.entries())
      .sort((a, b) => a[0] - b[0]);
    
    for (const [unicode, glyph] of sortedGlyphs) {
      const glyphOffset = writer.getOffset();
      
      // Update index array with file offset (for crop mode)
      if (this.config.crop) {
        const indexOffset = indexStartOffset + unicode * 4;
        writer.writeUint32LEAt(indexOffset, glyphOffset);
      }
      
      // Write crop info if cropping is enabled
      if (this.config.crop && glyph.cropInfo) {
        writer.writeUint8(glyph.cropInfo.topSkip);
        writer.writeUint8(glyph.cropInfo.leftSkip);
        writer.writeUint8(glyph.cropInfo.validWidth);
        writer.writeUint8(glyph.cropInfo.validHeight);
      }
      
      // Write packed pixel data
      writer.writeBytes(glyph.pixelData);
    }
  }

  /**
   * Get the number of successfully rendered glyphs
   */
  getGlyphCount(): number {
    return this.glyphs.size;
  }

  /**
   * Get the base glyph dimensions
   */
  getBaseGlyphDimensions(): { width: number; height: number } {
    return {
      width: this.baseGlyphWidth,
      height: this.baseGlyphHeight
    };
  }
}
