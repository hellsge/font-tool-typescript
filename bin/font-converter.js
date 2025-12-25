#!/usr/bin/env node

/**
 * CLI entry point for font converter
 */

// Import the compiled CLI module
const { cli } = require('../dist/main');

// Run the CLI
cli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(99);
});
