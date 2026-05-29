// Generates the source icon/splash images in assets/ from the BasedMining logo,
// then `@capacitor/assets generate` fans them out to every android/ios size.
//
// Source logo is the orange grid mark on a solid white background. We key out
// the white to get a transparent mark, then composite it onto brand backgrounds:
//   icon      → orange mark on black  (#000, matches dark-theme accent)
//   splash    → orange mark on cream  (#f5f5f0, light theme)
//   splash-dark → orange mark on black (#000)
//
// Run: node scripts/gen-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'C:/Users/1136962520/Downloads/BasedMiningLogo.png';
const OUT = 'assets';
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const CREAM = { r: 245, g: 245, b: 240, alpha: 1 };

mkdirSync(OUT, { recursive: true });

// 1) Key out the white background → transparent RGBA mark, trimmed tight.
async function transparentMark() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    // near-white → fully transparent (also clears the internal grid gaps)
    if (r > 235 && g > 235 && b > 235) data[o + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 10 }); // crop to the mark's bounding box
}

// Composite the mark, scaled to `frac` of the canvas, centered on `bg`.
async function compose({ size, frac, bg, out }) {
  const mark = await transparentMark();
  const target = Math.round(size * frac);
  const resized = await mark.resize(target, target, { fit: 'contain' }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${out}`);
  console.log(`wrote ${OUT}/${out} (${size}px, mark ${Math.round(frac * 100)}%)`);
}

// solid-color square helper (adaptive icon background layer)
async function solid({ size, bg, out }) {
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .png()
    .toFile(`${OUT}/${out}`);
  console.log(`wrote ${OUT}/${out} (solid)`);
}

await compose({ size: 1024, frac: 0.78, bg: BLACK, out: 'icon-only.png' });
// Adaptive foreground: keep the mark inside the ~66% safe zone (outer edge is masked).
await compose({ size: 1024, frac: 0.6, bg: { r: 0, g: 0, b: 0, alpha: 0 }, out: 'icon-foreground.png' });
await solid({ size: 1024, bg: BLACK, out: 'icon-background.png' });
await compose({ size: 2732, frac: 0.22, bg: CREAM, out: 'splash.png' });
await compose({ size: 2732, frac: 0.22, bg: BLACK, out: 'splash-dark.png' });

console.log('done.');
