/**
 * Unit tests for BinaryWriter class
 * 
 * Tests little-endian byte order and bitfield packing
 * Requirements: 5.8 - Little-endian format for all multi-byte integers
 */

import { BinaryWriter } from '../src/binary-writer';

describe('BinaryWriter', () => {
  describe('Integer writing - Little-endian byte order', () => {
    it('should write int8 correctly', () => {
      const writer = new BinaryWriter();
      writer.writeInt8(-128);
      writer.writeInt8(127);
      writer.writeInt8(0);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x80); // -128 as unsigned
      expect(buffer[1]).toBe(0x7F); // 127
      expect(buffer[2]).toBe(0x00); // 0
    });

    it('should write uint8 correctly', () => {
      const writer = new BinaryWriter();
      writer.writeUint8(0);
      writer.writeUint8(255);
      writer.writeUint8(128);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x00);
      expect(buffer[1]).toBe(0xFF);
      expect(buffer[2]).toBe(0x80);
    });

    it('should write int16LE in little-endian format', () => {
      const writer = new BinaryWriter();
      writer.writeInt16LE(0x1234);
      
      const buffer = writer.getBuffer();
      // Little-endian: LSB first
      expect(buffer[0]).toBe(0x34); // Low byte
      expect(buffer[1]).toBe(0x12); // High byte
    });

    it('should write negative int16LE correctly', () => {
      const writer = new BinaryWriter();
      writer.writeInt16LE(-1);
      
      const buffer = writer.getBuffer();
      // -1 in two's complement is 0xFFFF
      expect(buffer[0]).toBe(0xFF);
      expect(buffer[1]).toBe(0xFF);
    });

    it('should write uint16LE in little-endian format', () => {
      const writer = new BinaryWriter();
      writer.writeUint16LE(0xABCD);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0xCD); // Low byte
      expect(buffer[1]).toBe(0xAB); // High byte
    });

    it('should write int32LE in little-endian format', () => {
      const writer = new BinaryWriter();
      writer.writeInt32LE(0x12345678);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x78); // Lowest byte
      expect(buffer[1]).toBe(0x56);
      expect(buffer[2]).toBe(0x34);
      expect(buffer[3]).toBe(0x12); // Highest byte
    });

    it('should write negative int32LE correctly', () => {
      const writer = new BinaryWriter();
      writer.writeInt32LE(-1);
      
      const buffer = writer.getBuffer();
      // -1 in two's complement is 0xFFFFFFFF
      expect(buffer[0]).toBe(0xFF);
      expect(buffer[1]).toBe(0xFF);
      expect(buffer[2]).toBe(0xFF);
      expect(buffer[3]).toBe(0xFF);
    });

    it('should write uint32LE in little-endian format', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0xDEADBEEF);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0xEF); // Lowest byte
      expect(buffer[1]).toBe(0xBE);
      expect(buffer[2]).toBe(0xAD);
      expect(buffer[3]).toBe(0xDE); // Highest byte
    });
  });

  describe('Bitfield packing', () => {
    it('should pack boolean array into bitfield (LSB to MSB)', () => {
      const writer = new BinaryWriter();
      // bits: [true, false, true, false, false, false, false, false]
      // Expected: bit 0 = 1, bit 2 = 1 => 0b00000101 = 5
      writer.writeBitfield([true, false, true, false, false, false, false, false]);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x05);
    });

    it('should pack all true bits correctly', () => {
      const writer = new BinaryWriter();
      writer.writeBitfield([true, true, true, true, true, true, true, true]);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0xFF);
    });

    it('should pack all false bits correctly', () => {
      const writer = new BinaryWriter();
      writer.writeBitfield([false, false, false, false, false, false, false, false]);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x00);
    });

    it('should handle partial bitfield (less than 8 bits)', () => {
      const writer = new BinaryWriter();
      // Only 3 bits: [true, true, false]
      // Expected: bit 0 = 1, bit 1 = 1 => 0b00000011 = 3
      writer.writeBitfield([true, true, false]);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x03);
    });

    it('should pack bitmap font bitfield correctly', () => {
      const writer = new BinaryWriter();
      // bold=true, italic=false, rvd=false, indexMethod=1, crop=true
      // Expected: bit 0 = 1, bit 3 = 1, bit 4 = 1 => 0b00011001 = 25
      writer.writeBitmapFontBitfield(true, false, false, 1, true);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x19); // 25 in hex
    });

    it('should pack bitmap font bitfield with all flags false', () => {
      const writer = new BinaryWriter();
      writer.writeBitmapFontBitfield(false, false, false, 0, false);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x00);
    });

    it('should pack bitmap font bitfield with bold and italic', () => {
      const writer = new BinaryWriter();
      // bold=true, italic=true, rvd=false, indexMethod=0, crop=false
      // Expected: bit 0 = 1, bit 1 = 1 => 0b00000011 = 3
      writer.writeBitmapFontBitfield(true, true, false, 0, false);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x03);
    });

    it('should pack vector font bitfield correctly', () => {
      const writer = new BinaryWriter();
      // bold=true, italic=true, rvd=false, indexMethod=1
      // Expected: bit 0 = 1, bit 1 = 1, bit 3 = 1 => 0b00001011 = 11
      writer.writeVectorFontBitfield(true, true, false, 1);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x0B);
    });
  });

  describe('Bytes and strings', () => {
    it('should write raw bytes correctly', () => {
      const writer = new BinaryWriter();
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      writer.writeBytes(bytes);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x01);
      expect(buffer[1]).toBe(0x02);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);
    });

    it('should write string as UTF-8', () => {
      const writer = new BinaryWriter();
      writer.writeString('ABC');
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x41); // 'A'
      expect(buffer[1]).toBe(0x42); // 'B'
      expect(buffer[2]).toBe(0x43); // 'C'
    });

    it('should write null-terminated string', () => {
      const writer = new BinaryWriter();
      writer.writeNullTerminatedString('Hi');
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x48); // 'H'
      expect(buffer[1]).toBe(0x69); // 'i'
      expect(buffer[2]).toBe(0x00); // null terminator
    });
  });

  describe('Buffer management', () => {
    it('should track offset correctly', () => {
      const writer = new BinaryWriter();
      expect(writer.getOffset()).toBe(0);
      
      writer.writeUint8(1);
      expect(writer.getOffset()).toBe(1);
      
      writer.writeUint16LE(2);
      expect(writer.getOffset()).toBe(3);
      
      writer.writeUint32LE(3);
      expect(writer.getOffset()).toBe(7);
    });

    it('should allow setting offset', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0x12345678);
      
      writer.setOffset(0);
      expect(writer.getOffset()).toBe(0);
    });

    it('should throw on invalid offset', () => {
      const writer = new BinaryWriter(10);
      expect(() => writer.setOffset(-1)).toThrow(RangeError);
      expect(() => writer.setOffset(11)).toThrow(RangeError);
    });

    it('should auto-expand buffer when needed', () => {
      const writer = new BinaryWriter(4); // Small initial capacity
      
      // Write more than 4 bytes
      writer.writeUint32LE(1);
      writer.writeUint32LE(2);
      writer.writeUint32LE(3);
      
      expect(writer.getOffset()).toBe(12);
      expect(writer.getCapacity()).toBeGreaterThanOrEqual(12);
    });

    it('should reset offset correctly', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0x12345678);
      expect(writer.getOffset()).toBe(4);
      
      writer.reset();
      expect(writer.getOffset()).toBe(0);
    });

    it('should write at specific offset without changing current position', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0x00000000); // Placeholder
      writer.writeUint32LE(0xDEADBEEF);
      
      const currentOffset = writer.getOffset();
      writer.writeUint32LEAt(0, 0x12345678); // Update placeholder
      
      expect(writer.getOffset()).toBe(currentOffset); // Position unchanged
      
      const buffer = writer.getBuffer();
      // First 4 bytes should be updated
      expect(buffer[0]).toBe(0x78);
      expect(buffer[1]).toBe(0x56);
      expect(buffer[2]).toBe(0x34);
      expect(buffer[3]).toBe(0x12);
    });

    it('should write uint16 at specific offset', () => {
      const writer = new BinaryWriter();
      writer.writeUint16LE(0x0000);
      writer.writeUint16LE(0xFFFF);
      
      writer.writeUint16LEAt(0, 0xABCD);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0xCD);
      expect(buffer[1]).toBe(0xAB);
    });

    it('should write uint8 at specific offset', () => {
      const writer = new BinaryWriter();
      writer.writeUint8(0x00);
      writer.writeUint8(0xFF);
      
      writer.writeUint8At(0, 0x42);
      
      const buffer = writer.getBuffer();
      expect(buffer[0]).toBe(0x42);
      expect(buffer[1]).toBe(0xFF);
    });
  });

  describe('Output formats', () => {
    it('should return Buffer with correct length', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0x12345678);
      
      const buffer = writer.getBuffer();
      expect(buffer.length).toBe(4);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should return Uint8Array with correct length', () => {
      const writer = new BinaryWriter();
      writer.writeUint32LE(0x12345678);
      
      const arr = writer.getUint8Array();
      expect(arr.length).toBe(4);
      expect(arr instanceof Uint8Array).toBe(true);
    });
  });
});
