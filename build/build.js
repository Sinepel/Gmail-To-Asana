#!/usr/bin/env node

/**
 * Build script for Gmail to Asana Extension
 * Creates both Chrome and Firefox versions with packaging
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Files and directories to copy
const FILES_TO_COPY = [
  'manifest.json',
  'src',
  'icons',
  '_locales',
];

/**
 * Remove directory recursively
 */
function rmdir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        rmdir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

/**
 * Copy file or directory recursively
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Build Chrome extension
 */
function buildChrome() {
  console.log('Building Chrome extension...');

  const chromeDir = path.join(DIST_DIR, 'chrome');
  rmdir(chromeDir);
  fs.mkdirSync(chromeDir, { recursive: true });

  FILES_TO_COPY.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(chromeDir, file);
    copyRecursive(src, dest);
  });

  console.log('Chrome extension built: dist/chrome/');
}

/**
 * Build Firefox extension
 */
function buildFirefox() {
  console.log('Building Firefox extension...');

  const firefoxDir = path.join(DIST_DIR, 'firefox');
  rmdir(firefoxDir);
  fs.mkdirSync(firefoxDir, { recursive: true });

  FILES_TO_COPY.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(firefoxDir, file);
    copyRecursive(src, dest);
  });

  // Modify manifest for Firefox
  const manifestPath = path.join(firefoxDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Add Firefox-specific settings
  manifest.browser_specific_settings = {
    gecko: {
      id: 'gmail-to-asana@extension',
      strict_min_version: '109.0',
    },
  };

  // Firefox uses background.scripts instead of service_worker
  // Convert service_worker to scripts array with type: module
  if (manifest.background && manifest.background.service_worker) {
    const serviceWorkerPath = manifest.background.service_worker;
    manifest.background = {
      scripts: [serviceWorkerPath],
      type: 'module',
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Firefox extension built: dist/firefox/');
}

/**
 * Package extension into zip/xpi
 */
function packageExtension(sourceDir, outputFile) {
  // Remove existing package
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  // Create zip using system zip command
  const outputPath = path.resolve(outputFile);
  const sourcePath = path.resolve(sourceDir);

  try {
    execSync(`cd "${sourcePath}" && zip -r "${outputPath}" . -x "*.DS_Store"`, {
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    console.error(`Failed to create package: ${error.message}`);
    return false;
  }
}

/**
 * Main build function
 */
function build() {
  console.log('Gmail to Asana Extension - Build Script\n');

  // Clean dist directory
  rmdir(DIST_DIR);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Build both versions
  buildChrome();
  buildFirefox();

  // Get version from manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
  const version = manifest.version;

  console.log('\nPackaging extensions...');

  // Package Chrome extension (.zip)
  const chromeZip = path.join(DIST_DIR, `gmail-to-asana-chrome-v${version}.zip`);
  if (packageExtension(path.join(DIST_DIR, 'chrome'), chromeZip)) {
    console.log(`Chrome package: dist/gmail-to-asana-chrome-v${version}.zip`);
  }

  // Package Firefox extension (.xpi)
  const firefoxXpi = path.join(DIST_DIR, `gmail-to-asana-firefox-v${version}.xpi`);
  if (packageExtension(path.join(DIST_DIR, 'firefox'), firefoxXpi)) {
    console.log(`Firefox package: dist/gmail-to-asana-firefox-v${version}.xpi`);
  }

  console.log('\nBuild complete!');
  console.log('\n--- Development ---');
  console.log('Chrome: chrome://extensions → Load unpacked → dist/chrome/');
  console.log('Firefox: about:debugging → Load Temporary Add-on → dist/firefox/manifest.json');
  console.log('\n--- Distribution ---');
  console.log(`Chrome Web Store: Upload dist/gmail-to-asana-chrome-v${version}.zip`);
  console.log(`Firefox Add-ons: Upload dist/gmail-to-asana-firefox-v${version}.xpi`);
}

// Run build
build();
