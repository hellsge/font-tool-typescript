/**
 * Header Parser for Compatibility Testing
 * 
 * This module provides functions to parse bitmap and vector font headers
 * from binary files for comparison between C++ and TypeScript outputs.
 * 
 * Requirements: 4.1 - Header structure comparison
 */

import * as fs from 'fs';
import { FileFlag } from '../../../src/types';

/**
 * Parsed Bitmap Font Header
 * All fields extracted from binary data for comparison
 */
export interface ParsedBitmapHeader {
  /** Total header length in bytes */
  length: number;
  /** File flag (should be 1 for bitmap) */
  fileFlag: number;
  /** Version major */
  versionMajor: number;
  /** Version minor */
  versionMinor: number;
  /** Version revision */
  versionRevision: number;
  /** Recalculated font size */
  size: number;
  /** Original font size (backSize) */
  fontSize: number;
  /** Render mode (1/2/4/8 bits per pixel) */
  renderMode: number;
  /** Bold flag */
  bold: boolean;
  /** Italic flag */
  italic: boolean;
  /** Reserved flag */
  rvd: boolean;
  /** Index method (0=ADDRESS, 1=OFFSET) */
  indexMethod: number;
  /** Crop flag */
  crop: boolean;
  /** Reserved bits */
  rsvd: number;
  /** Index area size in bytes */
  indexAreaSize: number;
  /** Font name length including null terminator */
  fontNameLength: number;
  /** Font name string */
  fontName: string;
  /** Raw bitfield byte for debugging */
  rawBitfield: number;
}

/**
 * Parsed Vector Font Header
 * All fields extracted from binary data for comparison
 */
export interface ParsedVectorHeader {
  /** Total header length in bytes */
  length: number;
  /** File flag (should be 2 for vector) */
  fileFlag: number;
  /** Version major */
  versionMajor: number;
  /** Version minor */
  versionMinor: number;
  /** Version revision */
  versionRevision: number;
  /** Version build number */
  versionBuildnum: number;
  /** Font size */
  fontSize: number;
  /** Render mode (unused for vector) */
  renderMode: number;
  /** Bold flag */
  bold: boolean;
  /** Italic flag */
  italic: boolean;
  /** Reserved flag */
  rvd: boolean;
  /** Index method (0=ADDRESS, 1=OFFSET) */
  indexMethod: number;
  /** Reserved bits */
  rsvd: number;
  /** Index area size in bytes */
  indexAreaSize: number;
  /** Font name length including null terminator */
  fontNameLength: number;
  /** Font ascent */
  ascent: number;
  /** Font descent */
  descent: number;
  /** Line gap */
  lineGap: number;
  /** Font name string */
  fontName: string;
  /** Raw bitfield byte for debugging */
  rawBitfield: number;
}

/**
 * Union type for parsed headers
 */
export type ParsedHeader = ParsedBitmapHeader | ParsedVectorHeader;

/**
 * Header parse result with metadata
 */
export interface HeaderParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Error message if parsing failed */
  error?: string;
  /** File type detected */
  fileType: 'bitmap' | 'vector' | 'unknown';
  /** Parsed header data */
  header?: ParsedHeader;
  /** Raw header bytes for comparison */
  rawBytes?: Buffer;
}


/**
 * Parses a Bitmap Font Header from a Buffer
 * 
 * Binary layout (packed, little-endian):
 * - length (1 byte): Total header length
 * - fileFlag (1 byte): 1 for bitmap
 * - version_major (1 byte)
 * - version_minor (1 byte)
 * - version_revision (1 byte)
 * - size (1 byte): Recalculated font size
 * - fontSize (1 byte): backSize value
 * - renderMode (1 byte): 1/2/4/8
 * - bitfield (1 byte): bold, italic, rvd, indexMethod, crop, reserved
 * - indexAreaSize (4 bytes, int32): Size of index array in bytes
 * - fontNameLength (1 byte): Length of font name including null terminator
 * - fontName (variable): Null-terminated font name
 * 
 * @param data - Buffer containing header data
 * @returns Parsed bitmap header
 */
export function parseBitmapHeader(data: Buffer): ParsedBitmapHeader {
  let offset = 0;
  
  // Read length (1 byte)
  const length = data.readUInt8(offset++);
  
  // Read fileFlag (1 byte)
  const fileFlag = data.readUInt8(offset++);
  
  // Read version (3 bytes)
  const versionMajor = data.readUInt8(offset++);
  const versionMinor = data.readUInt8(offset++);
  const versionRevision = data.readUInt8(offset++);
  
  // Read size (1 byte)
  const size = data.readUInt8(offset++);
  
  // Read fontSize (1 byte)
  const fontSize = data.readUInt8(offset++);
  
  // Read renderMode (1 byte)
  const renderMode = data.readUInt8(offset++);
  
  // Read bitfield (1 byte)
  const rawBitfield = data.readUInt8(offset++);
  const bold = (rawBitfield & 0x01) !== 0;
  const italic = (rawBitfield & 0x02) !== 0;
  const rvd = (rawBitfield & 0x04) !== 0;
  const indexMethod = (rawBitfield & 0x08) !== 0 ? 1 : 0;
  const crop = (rawBitfield & 0x10) !== 0;
  const rsvd = (rawBitfield >> 5) & 0x07;
  
  // Read indexAreaSize (4 bytes, little-endian)
  const indexAreaSize = data.readInt32LE(offset);
  offset += 4;
  
  // Read fontNameLength (1 byte)
  const fontNameLength = data.readUInt8(offset++);
  
  // Read fontName (excluding null terminator)
  const fontName = data.toString('utf8', offset, offset + fontNameLength - 1);
  
  return {
    length,
    fileFlag,
    versionMajor,
    versionMinor,
    versionRevision,
    size,
    fontSize,
    renderMode,
    bold,
    italic,
    rvd,
    indexMethod,
    crop,
    rsvd,
    indexAreaSize,
    fontNameLength,
    fontName,
    rawBitfield
  };
}

/**
 * Parses a Vector Font Header from a Buffer
 * 
 * Binary layout (packed, little-endian):
 * - length (1 byte): Total header length
 * - fileFlag (1 byte): 2 for vector
 * - version_major (1 byte)
 * - version_minor (1 byte)
 * - version_revision (1 byte)
 * - version_buildnum (1 byte)
 * - fontSize (1 byte)
 * - renderMode (1 byte): unused for vector
 * - bitfield (1 byte): bold, italic, rvd, indexMethod, reserved
 * - indexAreaSize (4 bytes, int32)
 * - fontNameLength (1 byte)
 * - ascent (2 bytes, int16)
 * - descent (2 bytes, int16)
 * - lineGap (2 bytes, int16)
 * - fontName (variable): Null-terminated font name
 * 
 * @param data - Buffer containing header data
 * @returns Parsed vector header
 */
export function parseVectorHeader(data: Buffer): ParsedVectorHeader {
  let offset = 0;
  
  // Read length (1 byte)
  const length = data.readUInt8(offset++);
  
  // Read fileFlag (1 byte)
  const fileFlag = data.readUInt8(offset++);
  
  // Read version (4 bytes)
  const versionMajor = data.readUInt8(offset++);
  const versionMinor = data.readUInt8(offset++);
  const versionRevision = data.readUInt8(offset++);
  const versionBuildnum = data.readUInt8(offset++);
  
  // Read fontSize (1 byte)
  const fontSize = data.readUInt8(offset++);
  
  // Read renderMode (1 byte)
  const renderMode = data.readUInt8(offset++);
  
  // Read bitfield (1 byte)
  const rawBitfield = data.readUInt8(offset++);
  const bold = (rawBitfield & 0x01) !== 0;
  const italic = (rawBitfield & 0x02) !== 0;
  const rvd = (rawBitfield & 0x04) !== 0;
  const indexMethod = (rawBitfield & 0x08) !== 0 ? 1 : 0;
  const rsvd = (rawBitfield >> 4) & 0x0F;
  
  // Read indexAreaSize (4 bytes, little-endian)
  const indexAreaSize = data.readInt32LE(offset);
  offset += 4;
  
  // Read fontNameLength (1 byte)
  const fontNameLength = data.readUInt8(offset++);
  
  // Read ascent (2 bytes, little-endian)
  const ascent = data.readInt16LE(offset);
  offset += 2;
  
  // Read descent (2 bytes, little-endian)
  const descent = data.readInt16LE(offset);
  offset += 2;
  
  // Read lineGap (2 bytes, little-endian)
  const lineGap = data.readInt16LE(offset);
  offset += 2;
  
  // Read fontName (excluding null terminator)
  const fontName = data.toString('utf8', offset, offset + fontNameLength - 1);
  
  return {
    length,
    fileFlag,
    versionMajor,
    versionMinor,
    versionRevision,
    versionBuildnum,
    fontSize,
    renderMode,
    bold,
    italic,
    rvd,
    indexMethod,
    rsvd,
    indexAreaSize,
    fontNameLength,
    ascent,
    descent,
    lineGap,
    fontName,
    rawBitfield
  };
}

/**
 * Detects the file type from the header
 * 
 * @param data - Buffer containing at least 2 bytes
 * @returns File type ('bitmap', 'vector', or 'unknown')
 */
export function detectFileType(data: Buffer): 'bitmap' | 'vector' | 'unknown' {
  if (data.length < 2) {
    return 'unknown';
  }
  
  const fileFlag = data.readUInt8(1); // fileFlag is at offset 1
  
  if (fileFlag === FileFlag.BITMAP) {
    return 'bitmap';
  } else if (fileFlag === FileFlag.VECTOR) {
    return 'vector';
  }
  
  return 'unknown';
}

/**
 * Parses a font header from a Buffer, auto-detecting the type
 * 
 * @param data - Buffer containing header data
 * @returns Header parse result with type and parsed data
 */
export function parseHeader(data: Buffer): HeaderParseResult {
  try {
    if (data.length < 2) {
      return {
        success: false,
        error: 'Buffer too small to contain header',
        fileType: 'unknown'
      };
    }
    
    const fileType = detectFileType(data);
    const length = data.readUInt8(0);
    
    if (data.length < length) {
      return {
        success: false,
        error: `Buffer size (${data.length}) is smaller than header length (${length})`,
        fileType
      };
    }
    
    const rawBytes = data.subarray(0, length);
    
    if (fileType === 'bitmap') {
      const header = parseBitmapHeader(data);
      return {
        success: true,
        fileType: 'bitmap',
        header,
        rawBytes
      };
    } else if (fileType === 'vector') {
      const header = parseVectorHeader(data);
      return {
        success: true,
        fileType: 'vector',
        header,
        rawBytes
      };
    }
    
    return {
      success: false,
      error: `Unknown file type: fileFlag=${data.readUInt8(1)}`,
      fileType: 'unknown'
    };
  } catch (error) {
    return {
      success: false,
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      fileType: 'unknown'
    };
  }
}

/**
 * Parses a font header from a file path
 * 
 * @param filePath - Path to the .font or .bin file
 * @returns Header parse result
 */
export function parseHeaderFromFile(filePath: string): HeaderParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
        fileType: 'unknown'
      };
    }
    
    const data = fs.readFileSync(filePath);
    return parseHeader(data);
  } catch (error) {
    return {
      success: false,
      error: `File read error: ${error instanceof Error ? error.message : String(error)}`,
      fileType: 'unknown'
    };
  }
}

/**
 * Type guard to check if a parsed header is a bitmap header
 */
export function isBitmapHeader(header: ParsedHeader): header is ParsedBitmapHeader {
  return 'crop' in header && 'size' in header && !('ascent' in header);
}

/**
 * Type guard to check if a parsed header is a vector header
 */
export function isVectorHeader(header: ParsedHeader): header is ParsedVectorHeader {
  return 'ascent' in header && 'descent' in header && 'lineGap' in header;
}

/**
 * Formats a parsed bitmap header as a human-readable string
 */
export function formatBitmapHeader(header: ParsedBitmapHeader): string {
  return `BitmapFontHeader:
  length: ${header.length}
  fileFlag: ${header.fileFlag} (BITMAP)
  version: ${header.versionMajor}.${header.versionMinor}.${header.versionRevision}
  size: ${header.size}
  fontSize: ${header.fontSize}
  renderMode: ${header.renderMode}-bit
  bold: ${header.bold}
  italic: ${header.italic}
  rvd: ${header.rvd}
  indexMethod: ${header.indexMethod === 0 ? 'ADDRESS' : 'OFFSET'}
  crop: ${header.crop}
  indexAreaSize: ${header.indexAreaSize}
  fontNameLength: ${header.fontNameLength}
  fontName: "${header.fontName}"
  rawBitfield: 0x${header.rawBitfield.toString(16).padStart(2, '0')}`;
}

/**
 * Formats a parsed vector header as a human-readable string
 */
export function formatVectorHeader(header: ParsedVectorHeader): string {
  return `VectorFontHeader:
  length: ${header.length}
  fileFlag: ${header.fileFlag} (VECTOR)
  version: ${header.versionMajor}.${header.versionMinor}.${header.versionRevision}.${header.versionBuildnum}
  fontSize: ${header.fontSize}
  renderMode: ${header.renderMode}
  bold: ${header.bold}
  italic: ${header.italic}
  rvd: ${header.rvd}
  indexMethod: ${header.indexMethod === 0 ? 'ADDRESS' : 'OFFSET'}
  indexAreaSize: ${header.indexAreaSize}
  fontNameLength: ${header.fontNameLength}
  ascent: ${header.ascent}
  descent: ${header.descent}
  lineGap: ${header.lineGap}
  fontName: "${header.fontName}"
  rawBitfield: 0x${header.rawBitfield.toString(16).padStart(2, '0')}`;
}

/**
 * Formats any parsed header as a human-readable string
 */
export function formatHeader(header: ParsedHeader): string {
  if (isBitmapHeader(header)) {
    return formatBitmapHeader(header);
  } else {
    return formatVectorHeader(header);
  }
}
