/**
 * Constants for TypeScript Font Converter
 * 
 * This module defines all constant values used throughout the font conversion process,
 * including version information, default values, and configuration limits.
 */

import { RenderMode, Rotation, IndexMethod } from './types';

/**
 * Binary format version information
 * 
 * IMPORTANT: Bitmap and Vector fonts use different version numbers!
 * - Bitmap fonts: 1.0.2.0
 * - Vector fonts: 0.0.0.1
 * 
 * C++ Reference: FontDefine.h
 */
export const VERSION = {
  /** Bitmap font version */
  BITMAP: {
    MAJOR: 1,
    MINOR: 0,
    REVISION: 2,
    BUILD: 0,
    STRING: '1.0.2'
  },
  /** Vector font version */
  VECTOR: {
    MAJOR: 0,
    MINOR: 0,
    REVISION: 0,
    BUILD: 1,
    STRING: '0.0.0.1'
  },
  // Legacy: for backward compatibility
  MAJOR: 1,
  MINOR: 0,
  REVISION: 2,
  BUILD: 0,
  STRING: '1.0.2'
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  FONT_SIZE: 16,
  RENDER_MODE: RenderMode.BIT_4,
  BOLD: false,
  ITALIC: false,
  ROTATION: Rotation.ROTATE_0,
  GAMMA: 1.0,
  INDEX_METHOD: IndexMethod.ADDRESS,
  CROP: false,
  OUTPUT_FORMAT: 'bitmap' as const
} as const;

/**
 * Binary format constants
 */
export const BINARY_FORMAT = {
  /** Maximum index array size for address mode */
  MAX_INDEX_SIZE: 65536,
  
  /** Unused index entry marker for address mode (16-bit) */
  UNUSED_INDEX_16: 0xFFFF,
  
  /** Unused index entry marker for crop mode (32-bit) */
  UNUSED_INDEX_32: 0xFFFFFFFF,
  
  /** Bitmap alignment boundary (pixels) */
  BITMAP_ALIGNMENT: 8,
  
  /** Maximum Unicode value */
  MAX_UNICODE: 0xFFFF,
  
  /** Minimum Unicode value */
  MIN_UNICODE: 0x0000
} as const;

/**
 * File naming constants
 */
export const FILE_NAMING = {
  /** Bitmap font file suffix */
  BITMAP_SUFFIX: '_bitmap.bin',
  
  /** Vector font file suffix */
  VECTOR_SUFFIX: '_vector.bin',
  
  /** Character set file extension */
  CST_EXTENSION: '.cst',
  
  /** Unsupported characters log file */
  UNSUPPORTED_CHARS_FILE: 'NotSupportedChars.txt',
  
  /** Size prefix in filename */
  SIZE_PREFIX: '_size',
  
  /** Bits prefix in filename */
  BITS_PREFIX: '_bits'
} as const;

/**
 * Render mode bit values
 */
export const RENDER_MODE_BITS = {
  [RenderMode.BIT_1]: 1,
  [RenderMode.BIT_2]: 2,
  [RenderMode.BIT_4]: 4,
  [RenderMode.BIT_8]: 8
} as const;

/**
 * Rotation angle values in degrees
 */
export const ROTATION_DEGREES = {
  [Rotation.ROTATE_0]: 0,
  [Rotation.ROTATE_90]: 90,
  [Rotation.ROTATE_180]: 180,
  [Rotation.ROTATE_270]: 270
} as const;

/**
 * Configuration validation limits
 */
export const VALIDATION_LIMITS = {
  /** Minimum font size in points */
  MIN_FONT_SIZE: 1,
  
  /** Maximum font size in points */
  MAX_FONT_SIZE: 255,
  
  /** Minimum gamma value */
  MIN_GAMMA: 0.1,
  
  /** Maximum gamma value */
  MAX_GAMMA: 5.0,
  
  /** Maximum font name length */
  MAX_FONT_NAME_LENGTH: 255,
  
  /** Maximum character set size */
  MAX_CHARSET_SIZE: 65536
} as const;

/**
 * Performance thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Small character set (<1000 chars) */
  SMALL_CHARSET_THRESHOLD: 2000,
  
  /** Medium character set (1000-10000 chars) */
  MEDIUM_CHARSET_THRESHOLD: 5000,
  
  /** Large character set (>10000 chars) */
  LARGE_CHARSET_THRESHOLD: 10000,
  
  /** Memory limit (bytes) */
  MEMORY_LIMIT: 500 * 1024 * 1024 // 500MB
} as const;

/**
 * Character set size categories
 */
export const CHARSET_SIZE_CATEGORIES = {
  SMALL: 1000,
  MEDIUM: 10000
} as const;

/**
 * Supported Node.js version
 */
export const MIN_NODE_VERSION = '16.0.0';

/**
 * Buffer sizes for streaming operations
 */
export const BUFFER_SIZES = {
  /** Default buffer size for file operations */
  DEFAULT: 64 * 1024, // 64KB
  
  /** Large buffer for bitmap data */
  LARGE: 256 * 1024 // 256KB
} as const;
