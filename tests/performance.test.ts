/**
 * Performance Tests
 * 
 * Tests font generation performance with different character set sizes.
 * Validates processing time and memory usage requirements.
 * 
 * Task: 22.1, 22.2
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import * as fs from 'fs';
import * as path from 'path';
import { main } from '../src/main';

describe('Performance Tests', () => {
  const testOutputDir = path.join(__dirname, '../test-output/performance');
  const testFontPath = path.join(__dirname, '../Font/NotoSans_Regular.ttf');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test output files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        const filePath = path.join(testOutputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  /**
   * Helper function to measure memory usage
   */
  function getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }

  /**
   * Helper function to generate character ranges
   */
  function generateCharacterRanges(count: number): Array<{ type: string; value: string }> {
    const ranges: Array<{ type: string; value: string }> = [];
    
    // Start with basic ASCII
    ranges.push({ type: 'range', value: '0x0020-0x007E' }); // 95 chars
    
    let currentCount = 95;
    let startCode = 0x00A0;
    
    while (currentCount < count && startCode < 0xFFFF) {
      const remaining = count - currentCount;
      const rangeSize = Math.min(remaining, 256);
      const endCode = Math.min(startCode + rangeSize - 1, 0xFFFF);
      
      ranges.push({
        type: 'range',
        value: `0x${startCode.toString(16).toUpperCase().padStart(4, '0')}-0x${endCode.toString(16).toUpperCase().padStart(4, '0')}`
      });
      
      currentCount += (endCode - startCode + 1);
      startCode = endCode + 1;
    }
    
    return ranges;
  }

  describe('Processing Time Tests', () => {
    it('should process small character set (<1000 chars) within 2 seconds', async () => {
      // Requirement 11.1: Small character sets should complete within 2 seconds
      const configPath = path.join(testOutputDir, 'small_charset_config.json');
      const characterRanges = generateCharacterRanges(500); // ~500 characters
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const startTime = Date.now();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const duration = Date.now() - startTime;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(2000);
      
      console.log(`Small charset (500 chars) processing time: ${duration}ms`);
    }, 10000);

    it('should process medium character set (1000-10000 chars) within 5 seconds', async () => {
      // Requirement 11.2: Medium character sets should complete within 5 seconds
      const configPath = path.join(testOutputDir, 'medium_charset_config.json');
      const characterRanges = generateCharacterRanges(5000); // ~5000 characters
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const startTime = Date.now();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const duration = Date.now() - startTime;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(5000);
      
      console.log(`Medium charset (5000 chars) processing time: ${duration}ms`);
    }, 15000);

    it('should process large character set (>10000 chars) within 10 seconds', async () => {
      // Requirement 11.3: Large character sets should complete within 10 seconds
      const configPath = path.join(testOutputDir, 'large_charset_config.json');
      const characterRanges = generateCharacterRanges(15000); // ~15000 characters
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const startTime = Date.now();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const duration = Date.now() - startTime;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(10000);
      
      console.log(`Large charset (15000 chars) processing time: ${duration}ms`);
    }, 20000);

    it('should process vector fonts efficiently', async () => {
      // Vector fonts should also meet performance requirements
      const configPath = path.join(testOutputDir, 'vector_perf_config.json');
      const characterRanges = generateCharacterRanges(5000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 0,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'vector',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const startTime = Date.now();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const duration = Date.now() - startTime;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(5000);
      
      console.log(`Vector font (5000 chars) processing time: ${duration}ms`);
    }, 15000);
  });

  describe('Memory Usage Tests', () => {
    it('should maintain memory usage below 500MB during processing', async () => {
      // Requirement 11.7: Memory usage should stay under 500MB
      const configPath = path.join(testOutputDir, 'memory_test_config.json');
      const characterRanges = generateCharacterRanges(10000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 24,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const initialMemory = getMemoryUsageMB();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const finalMemory = getMemoryUsageMB();
      const memoryIncrease = finalMemory - initialMemory;

      expect(exitCode).toBe(0);
      expect(finalMemory).toBeLessThan(500);
      
      console.log(`Memory usage: Initial=${initialMemory.toFixed(2)}MB, Final=${finalMemory.toFixed(2)}MB, Increase=${memoryIncrease.toFixed(2)}MB`);
    }, 20000);

    it('should release memory after processing each configuration', async () => {
      // Requirement 11.5, 11.6: Sequential processing and resource release
      const configPath = path.join(testOutputDir, 'multi_config_memory.json');
      const characterRanges = generateCharacterRanges(3000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          },
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 20,
            renderMode: 4,
            bold: true,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          },
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 0,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'vector',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const initialMemory = getMemoryUsageMB();
      const exitCode = await main(['node', 'font-converter', configPath]);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = getMemoryUsageMB();
      const memoryIncrease = finalMemory - initialMemory;

      expect(exitCode).toBe(0);
      expect(finalMemory).toBeLessThan(500);
      
      // Memory increase should be reasonable (not accumulating for each config)
      // Allow up to 200MB increase for multiple configs
      expect(memoryIncrease).toBeLessThan(200);
      
      console.log(`Multi-config memory: Initial=${initialMemory.toFixed(2)}MB, Final=${finalMemory.toFixed(2)}MB, Increase=${memoryIncrease.toFixed(2)}MB`);
    }, 30000);

    it('should handle memory efficiently with different render modes', async () => {
      // Test memory usage with different bit depths
      const configPath = path.join(testOutputDir, 'render_mode_memory.json');
      const characterRanges = generateCharacterRanges(5000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 1, // 1-bit (most memory efficient)
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const initialMemory = getMemoryUsageMB();
      const exitCode = await main(['node', 'font-converter', configPath]);
      const finalMemory = getMemoryUsageMB();

      expect(exitCode).toBe(0);
      expect(finalMemory).toBeLessThan(500);
      
      console.log(`1-bit render mode memory: Initial=${initialMemory.toFixed(2)}MB, Final=${finalMemory.toFixed(2)}MB`);
    }, 15000);

    it('should not accumulate memory with streaming output', async () => {
      // Requirement 11.4: Stream output data instead of buffering
      const configPath = path.join(testOutputDir, 'streaming_test.json');
      const characterRanges = generateCharacterRanges(8000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 20,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const memoryReadings: number[] = [];
      memoryReadings.push(getMemoryUsageMB());

      const exitCode = await main(['node', 'font-converter', configPath]);
      
      memoryReadings.push(getMemoryUsageMB());

      expect(exitCode).toBe(0);
      
      const maxMemory = Math.max(...memoryReadings);
      expect(maxMemory).toBeLessThan(500);
      
      console.log(`Streaming test max memory: ${maxMemory.toFixed(2)}MB`);
    }, 20000);
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      // Run the same configuration multiple times to check consistency
      const configPath = path.join(testOutputDir, 'consistency_test.json');
      const characterRanges = generateCharacterRanges(2000);
      
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: characterRanges
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const durations: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        // Clean up before each run
        const files = fs.readdirSync(testOutputDir);
        for (const file of files) {
          if (file.endsWith('.bin') || file.endsWith('.cst')) {
            fs.unlinkSync(path.join(testOutputDir, file));
          }
        }
        
        const startTime = Date.now();
        const exitCode = await main(['node', 'font-converter', configPath]);
        const duration = Date.now() - startTime;
        
        expect(exitCode).toBe(0);
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;
      
      console.log(`Performance consistency: Avg=${avgDuration.toFixed(0)}ms, Min=${minDuration}ms, Max=${maxDuration}ms, Variance=${variance}ms`);
      
      // Variance should be reasonable (within 100% of average for CI stability)
      expect(variance).toBeLessThan(avgDuration * 1.0);
    }, 30000);
  });
});
