#!/usr/bin/env node
// Regenerate Bureau brand assets.
//
// - Small wordmark + favicons: trim and square the existing 1080 puzzle PNGs,
//   then resize down to 512, 64, 32 and 16.
// - Large brand assets (apple-touch-icon, PWA sizes): render the master SVGs
//   with sharp at 180/192/512/1080.
//
// Run from the repo root: node scripts/generate-logos.mjs

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const brandDir = path.join(root, "apps/web/public/brand");
const publicDir = path.join(root, "apps/web/public");

const sourceSvg = {
  light: path.join(root, "Logo-Bureau-Clair.svg"),
  dark: path.join(root, "Logo-Bureau-Sombre.svg"),
};

const sourcePng = {
  light: path.join(brandDir, "bureau-logo-light.png"),
  dark: path.join(brandDir, "bureau-logo-dark.png"),
};

const markPaths = {
  "1080": {
    light: path.join(brandDir, "bureau-logo-light.png"),
    dark: path.join(brandDir, "bureau-logo-dark.png"),
  },
  "512": {
    light: path.join(brandDir, "bureau-logo-light-512.png"),
    dark: path.join(brandDir, "bureau-logo-dark-512.png"),
  },
};

const faviconPaths = {
  light: {
    16: path.join(publicDir, "favicon-16.png"),
    32: path.join(publicDir, "favicon-32.png"),
    64: path.join(publicDir, "favicon-64.png"),
  },
  dark: {
    16: path.join(publicDir, "favicon-dark-16.png"),
    32: path.join(publicDir, "favicon-dark-32.png"),
    64: path.join(publicDir, "favicon-dark-64.png"),
  },
};

const largePaths = {
  light: {
    180: path.join(publicDir, "apple-touch-icon.png"),
    192: path.join(publicDir, "icon-192.png"),
    512: path.join(publicDir, "icon-512.png"),
    1080: path.join(publicDir, "icon-1080.png"),
  },
  dark: {
    180: path.join(publicDir, "apple-touch-icon-dark.png"),
    192: path.join(publicDir, "icon-192-dark.png"),
    512: path.join(publicDir, "icon-512-dark.png"),
    1080: path.join(publicDir, "icon-1080-dark.png"),
  },
};

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Trim an image and centre the content on a new square canvas, then resize to `size`.
 * Preserves aspect ratio and avoids stretching.
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

  console.log(`Generated ${output} (${size}×${size})`);
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
 * Render an SVG master to a PNG at the requested size.
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
  // Small mark set from existing PNGs (trim, square, scale).
  for (const theme of ["light", "dark"]) {
    await makeSquare(sourcePng[theme], markPaths["1080"][theme], 1080);
    await makeSquare(sourcePng[theme], markPaths["512"][theme], 512);

    for (const s of [16, 32, 64]) {
      await makeFavicon(markPaths["512"][theme], faviconPaths[theme][s], s);
    }
  }

  // Large brand assets from master SVGs.
  for (const theme of ["light", "dark"]) {
    for (const [size, out] of Object.entries(largePaths[theme])) {
      await renderSvg(sourceSvg[theme], out, Number(size));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
