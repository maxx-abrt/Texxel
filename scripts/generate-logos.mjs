#!/usr/bin/env node
// Regenerate Bureau brand assets from the master transparent SVG.
//
// The master is a single red puzzle mark on transparent background that
// reads well on both light and dark surfaces, so we only need one source.
//
// Outputs:
//  - favicons: 16, 32, 64 (light + dark variants are the same asset)
//  - apple-touch-icon: 180
//  - PWA icons: 192, 512, 1080
//
// Run from the repo root: node scripts/generate-logos.mjs

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const publicDir = path.join(root, "apps/web/public");
const brandDir = path.join(publicDir, "brand");

const sourceSvg = path.join(brandDir, "bureau-logo.svg");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Trim an image and centre the content on a new square canvas, then resize to `size`.
 */
async function makeSquare(input, output, size) {
  const { data: trimmed, info: tInfo } = await sharp(input)
    .trim()
    .toBuffer({ resolveWithObject: true });

  const side = Math.max(tInfo.width, tInfo.height);
  const left = Math.floor((side - tInfo.width) / 2);
  const top = Math.floor((side - tInfo.height) / 2);
  const right = side - tInfo.width - left;
  const bottom = side - tInfo.height - top;

  const squared = await sharp(trimmed)
    .extend({ top, bottom, left, right, background: transparent })
    .toBuffer();

  await sharp(squared)
    .resize(size, size, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
      background: transparent,
    })
    .png()
    .toFile(output);

  console.log(`Generated ${output} (${size}x${size})`);
}

/**
 * Resize a square mark to a favicon size with a little sharpening.
 */
async function makeFavicon(input, output, size) {
  await sharp(input)
    .resize(size, size, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
      background: transparent,
    })
    .sharpen({ sigma: 0.5 })
    .png()
    .toFile(output);

  console.log(`Generated favicon ${output}`);
}

/**
 * Render the master SVG to a PNG at the requested size.
 */
async function renderSvg(input, output, size) {
  const svg = await readFile(input);
  await sharp(svg)
    .resize(size, size, { fit: "inside" })
    .png()
    .toFile(output);

  console.log(`Generated SVG render ${output}`);
}

async function main() {
  // Favicons (single asset, same for light and dark).
  const faviconSizes = [16, 32, 64];
  for (const s of faviconSizes) {
    await makeFavicon(sourceSvg, path.join(publicDir, `favicon-${s}.png`), s);
    // Dark variants are the same red mark; keep them for the layout.tsx references.
    await makeFavicon(sourceSvg, path.join(publicDir, `favicon-dark-${s}.png`), s);
  }

  // Apple touch icon (180).
  await renderSvg(sourceSvg, path.join(publicDir, "apple-touch-icon.png"), 180);
  await renderSvg(sourceSvg, path.join(publicDir, "apple-touch-icon-dark.png"), 180);

  // PWA icons.
  for (const s of [192, 512, 1080]) {
    await renderSvg(sourceSvg, path.join(publicDir, `icon-${s}.png`), s);
    await renderSvg(sourceSvg, path.join(publicDir, `icon-${s}-dark.png`), s);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
