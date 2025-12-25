# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-25

### Added
- Initial release of TypeScript font converter
- Bitmap font generation with 1-bit, 2-bit, 4-bit, and 8-bit render modes
- Vector font generation with contour data
- Character set processing from multiple sources (.cst files, CodePage, Unicode ranges, strings)
- Text effects: bold, italic, rotation (0°, 90°, 180°, 270°), gamma correction
- Space optimization with character cropping mode
- Two indexing methods: Address mode (65536 entries) and Offset mode (N entries)
- Cross-platform support (Windows, macOS, Linux)
- Binary format compatibility with C++ implementation (version 1.0.2)
- Comprehensive test suite with property-based testing (100+ iterations)
- CLI with parameter override support
- INI settings file support for gamma and rotation overrides
- Automatic output directory creation
- Error handling with descriptive messages
- NotSupportedChars.txt generation for failed character rendering

### Features
- **Configuration Management**: JSON-based configuration with validation
- **Font Parsing**: Support for .ttf and .ttc (TrueType Collection) files
- **Image Processing**: High-quality bitmap rendering with sharp library
- **Binary Writer**: Efficient packed binary structure writing with little-endian support
- **Character Encoding**: Support for multiple character sources in single configuration
- **Performance**: Optimized for large character sets (>10,000 characters)
- **Type Safety**: Full TypeScript strict mode with comprehensive type definitions

### Documentation
- Comprehensive README with installation, usage, and troubleshooting
- Example configurations for common use cases
- API documentation with TypeScript type definitions
- Configuration parameter reference

### Testing
- Unit tests for core functionality
- Property-based tests with fast-check (100+ iterations per property)
- Integration tests for end-to-end workflows
- Compatibility tests with C++ implementation
- Cross-platform consistency tests
- 80%+ code coverage

## [Unreleased]

### Planned
- Performance optimizations for very large character sets
- Additional output formats
- GUI configuration tool
- Font preview generation
- Batch processing improvements
