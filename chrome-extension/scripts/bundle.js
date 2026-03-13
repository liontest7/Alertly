#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(__dirname, '..', 'src');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Bundle popup.tsx with esbuild — React included, no require(), no window.React
execSync(
  `npx esbuild ${path.join(srcDir, 'popup.tsx')} \
    --bundle \
    --outfile=${path.join(distDir, 'popup.js')} \
    --format=iife \
    --target=chrome110 \
    --jsx=automatic \
    --loader:.tsx=tsx \
    --minify`,
  { stdio: 'inherit' }
);

// Bundle background.ts
const bgSrc = path.join(srcDir, 'background.ts');
if (fs.existsSync(bgSrc)) {
  execSync(
    `npx esbuild ${bgSrc} \
      --bundle \
      --outfile=${path.join(distDir, 'background.js')} \
      --format=iife \
      --target=chrome110 \
      --minify`,
    { stdio: 'inherit' }
  );
}

// Copy static assets
fs.copyFileSync(path.join(srcDir, 'popup.html'), path.join(distDir, 'popup.html'));
fs.copyFileSync(path.join(__dirname, '..', 'manifest.json'), path.join(distDir, 'manifest.json'));

const logoSource = path.join(__dirname, '..', '..', 'public', 'images', 'logo.png');
if (fs.existsSync(logoSource)) {
  fs.copyFileSync(logoSource, path.join(distDir, 'icon128.png'));
}

console.log('✅ Extension bundled successfully');
