#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(__dirname, '..', 'src');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static files
fs.copyFileSync(path.join(srcDir, 'popup.html'), path.join(distDir, 'popup.html'));

// Check if logo exists
const logoSource = path.join(__dirname, '..', '..', 'public', 'images', 'logo.png');
if (fs.existsSync(logoSource)) {
  fs.copyFileSync(logoSource, path.join(distDir, 'icon128.png'));
}

fs.copyFileSync(path.join(__dirname, '..', 'manifest.json'), path.join(distDir, 'manifest.json'));

// Process compiled JS files
const popupJsPath = path.join(distDir, 'popup.js');
const backgroundJsPath = path.join(distDir, 'background.js');

function processJsFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove problematic React imports and replace with stubs
  content = content.replace(
    /import\s+React\s+from\s+["']react["'];?/g,
    'const React = window.React || require("react");'
  );
  
  content = content.replace(
    /import\s+\{\s*createRoot\s*\}\s+from\s+["']react-dom\/client["'];?/g,
    'const { createRoot } = window.ReactDOM || require("react-dom/client");'
  );
  
  // Handle jsx-runtime imports - remove them
  content = content.replace(
    /import\s+\{[^}]*jsx[^}]*\}\s+from\s+["']react\/jsx-runtime["'];?/g,
    ''
  );
  
  fs.writeFileSync(filePath, content);
}

processJsFile(popupJsPath);
processJsFile(backgroundJsPath);

console.log('✅ Extension bundled successfully');
