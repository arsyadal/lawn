// Generates the Lawn PWA icons as PNG files without external dependencies.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/icons');
const BACKGROUND = [23, 70, 44, 255];
const FOREGROUND = [243, 217, 137, 255];
const SAMPLES = 3;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// The mark is the app's "L" monogram drawn as two overlapping bars.
function coverage(x, y, size, safeZone) {
  const glyphWidth = size * (safeZone ? 0.24 : 0.3);
  const glyphHeight = size * (safeZone ? 0.42 : 0.5);
  const thickness = glyphWidth * 0.46;
  const left = (size - glyphWidth) / 2;
  const top = (size - glyphHeight) / 2;
  const inStem = x >= left && x <= left + thickness && y >= top && y <= top + glyphHeight;
  const inFoot = x >= left && x <= left + glyphWidth && y >= top + glyphHeight - thickness && y <= top + glyphHeight;
  return inStem || inFoot ? 1 : 0;
}

function render(size, safeZone) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;
  const offset = step / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          hits += coverage(x + offset + sx * step, y + offset + sy * step, size, safeZone);
        }
      }
      const alpha = hits / (SAMPLES * SAMPLES);
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[index + channel] = Math.round(BACKGROUND[channel] * (1 - alpha) + FOREGROUND[channel] * alpha);
      }
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, safeZone] of [['lawn-192.png', 192, false], ['lawn-512.png', 512, false], ['lawn-maskable-512.png', 512, true]]) {
  writeFileSync(resolve(OUT_DIR, name), render(size, safeZone));
  console.log(`wrote ${name}`);
}
