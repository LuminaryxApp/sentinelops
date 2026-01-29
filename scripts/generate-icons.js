#!/usr/bin/env node

/**
 * Generate Tauri app icons from source SVG
 * Run: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'src-tauri', 'icons');
const SVG_PATH = join(ICONS_DIR, 'icon.svg');

// Icon sizes needed by Tauri
const PNG_SIZES = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 1024 }, // Source for ICO/ICNS
];

async function generateIcons() {
  console.log('Generating Tauri icons...');

  // Ensure icons directory exists
  mkdirSync(ICONS_DIR, { recursive: true });

  // Read SVG
  const svgBuffer = readFileSync(SVG_PATH);

  // Generate PNG files
  for (const { name, size } of PNG_SIZES) {
    const outputPath = join(ICONS_DIR, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created ${name} (${size}x${size})`);
  }

  // Generate ICO (Windows) - contains multiple sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => {
      return await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
    })
  );

  // Simple ICO file generation (PNG-based ICO)
  const icoBuffer = createIco(icoImages, icoSizes);
  writeFileSync(join(ICONS_DIR, 'icon.ico'), icoBuffer);
  console.log('  Created icon.ico');

  // For ICNS (macOS), we'll create a placeholder that works
  // macOS will use the PNG as fallback
  const icnsPath = join(ICONS_DIR, 'icon.icns');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(icnsPath.replace('.icns', '.png'));

  // Create a minimal ICNS with the PNG data
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  const icnsBuffer = createIcns(png512);
  writeFileSync(icnsPath, icnsBuffer);
  console.log('  Created icon.icns');

  console.log('Done! Icons generated successfully.');
}

// Create ICO file from PNG buffers
function createIco(pngBuffers, sizes) {
  const images = pngBuffers.map((png, i) => ({
    png,
    size: sizes[i],
  }));

  // ICO header
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;

  let offset = headerSize + dirEntrySize * numImages;
  const dirEntries = [];
  const imageData = [];

  for (const { png, size } of images) {
    dirEntries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      colorPlanes: 1,
      bitsPerPixel: 32,
      size: png.length,
      offset,
    });
    imageData.push(png);
    offset += png.length;
  }

  const buffer = Buffer.alloc(offset);
  let pos = 0;

  // Header
  buffer.writeUInt16LE(0, pos); pos += 2; // Reserved
  buffer.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
  buffer.writeUInt16LE(numImages, pos); pos += 2; // Number of images

  // Directory entries
  for (const entry of dirEntries) {
    buffer.writeUInt8(entry.width, pos); pos += 1;
    buffer.writeUInt8(entry.height, pos); pos += 1;
    buffer.writeUInt8(entry.colorCount, pos); pos += 1;
    buffer.writeUInt8(entry.reserved, pos); pos += 1;
    buffer.writeUInt16LE(entry.colorPlanes, pos); pos += 2;
    buffer.writeUInt16LE(entry.bitsPerPixel, pos); pos += 2;
    buffer.writeUInt32LE(entry.size, pos); pos += 4;
    buffer.writeUInt32LE(entry.offset, pos); pos += 4;
  }

  // Image data
  for (const data of imageData) {
    data.copy(buffer, pos);
    pos += data.length;
  }

  return buffer;
}

// Create minimal ICNS file
function createIcns(png512) {
  // ICNS format: 'icns' magic + size + icon types
  const iconType = Buffer.from('ic09'); // 512x512 PNG
  const iconData = png512;
  const iconEntry = Buffer.concat([
    iconType,
    Buffer.alloc(4), // size placeholder
    iconData,
  ]);
  iconEntry.writeUInt32BE(iconData.length + 8, 4);

  const magic = Buffer.from('icns');
  const totalSize = Buffer.alloc(4);
  totalSize.writeUInt32BE(8 + iconEntry.length);

  return Buffer.concat([magic, totalSize, iconEntry]);
}

generateIcons().catch(console.error);
