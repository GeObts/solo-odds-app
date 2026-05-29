// Generates Google Play store graphics into store/graphics/:
//   play-icon-512.png   — 512x512 hi-res icon (orange mark on black)
//   feature-graphic.png — 1024x500 banner (mark + wordmark on black)
//
// Run: node scripts/gen-store-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'store/graphics';
mkdirSync(OUT, { recursive: true });

// 512 hi-res icon: reuse the generated app icon (orange mark on black).
await sharp('assets/icon-only.png').resize(512, 512).png().toFile(`${OUT}/play-icon-512.png`);
console.log(`wrote ${OUT}/play-icon-512.png`);

// 1024x500 feature graphic.
const W = 1024;
const H = 500;
const logo = await sharp('public/logo.png').resize(300, 300, { fit: 'inside' }).toBuffer();
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000"/>
  <text x="430" y="225" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="700" fill="#ffffff">Solo Mining Odds</text>
  <text x="433" y="283" font-family="Arial, Helvetica, sans-serif" font-size="29" fill="#FF6A00">Live Bitcoin solo-mining calculator</text>
  <text x="433" y="330" font-family="Arial, Helvetica, sans-serif" font-size="23" fill="#888888">basedmining.xyz</text>
</svg>`;
await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: 95, top: 100 }])
  .png()
  .toFile(`${OUT}/feature-graphic.png`);
console.log(`wrote ${OUT}/feature-graphic.png`);
console.log('done.');
