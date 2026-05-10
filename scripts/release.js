#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-electron');
const OWNER = 'Tamalero';
const REPO = 'PersonalBlueSkyFeed';

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function capture(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

// ── Version ──────────────────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
console.log(`\nPreparing release ${tag}\n`);

// ── Find AppImage ─────────────────────────────────────────────────────────────
const entries = fs.readdirSync(DIST);
const found = entries.find(f => f.endsWith('.AppImage') && f.includes(version));
if (!found) {
  console.error(`No AppImage found in ${DIST} for version ${version}`);
  process.exit(1);
}

// Normalise filename: spaces → hyphens
const normalised = found.replace(/\s+/g, '-');
const srcPath = path.join(DIST, found);
const appImagePath = path.join(DIST, normalised);

if (srcPath !== appImagePath) {
  fs.renameSync(srcPath, appImagePath);
  console.log(`Renamed: "${found}" → "${normalised}"`);
}

// ── Patch .upd_info ───────────────────────────────────────────────────────────
const readelfOut = capture(`readelf -S "${appImagePath}"`);
const updinfoLine = readelfOut.split('\n').find(l => l.includes('.upd_info'));
if (!updinfoLine) {
  console.error('Cannot find .upd_info section — is this an AppImage Type 2?');
  process.exit(1);
}

// readelf -S line: "[27] .upd_info  PROGBITS  0000000000000000  0002ae68"
// Offset is the last 8-char hex token on the line.
const hexTokens = updinfoLine.match(/[0-9a-f]{8}/gi);
const fileOffset = parseInt(hexTokens[hexTokens.length - 1], 16);
console.log(`.upd_info offset: 0x${fileOffset.toString(16)}`);

// gh-releases-zsync format: gh-releases-zsync|owner|repo|tag|filename-pattern
const zsyncPattern = normalised.replace(version, '*') + '.zsync';
const updateInfo = `gh-releases-zsync|${OWNER}|${REPO}|latest|${zsyncPattern}`;
console.log(`Update info:      ${updateInfo}`);

// Write 512-byte null-padded buffer into the section
const patchBuf = Buffer.alloc(512, 0);
patchBuf.write(updateInfo, 0, 'utf8');

const fd = fs.openSync(appImagePath, 'r+');
fs.writeSync(fd, patchBuf, 0, 512, fileOffset);
fs.closeSync(fd);

// Verify round-trip
const verifyBuf = Buffer.alloc(updateInfo.length);
const fdv = fs.openSync(appImagePath, 'r');
fs.readSync(fdv, verifyBuf, 0, updateInfo.length, fileOffset);
fs.closeSync(fdv);
if (verifyBuf.toString('utf8') !== updateInfo) {
  console.error('Patch verification failed — embedded string does not match');
  process.exit(1);
}
console.log('Patch verified OK');

// ── Generate zsync ────────────────────────────────────────────────────────────
const zsyncPath = `${appImagePath}.zsync`;
run(`zsyncmake "${appImagePath}" -o "${zsyncPath}"`);

// ── Recompute sha512 + size for latest-linux.yml ──────────────────────────────
const appImageBuf = fs.readFileSync(appImagePath);
const sha512 = crypto.createHash('sha512').update(appImageBuf).digest('base64');
const size = appImageBuf.length;
console.log(`sha512: ${sha512}`);
console.log(`size:   ${size}`);

// ── Update latest-linux.yml ───────────────────────────────────────────────────
const ymlPath = path.join(DIST, 'latest-linux.yml');
let yml = fs.readFileSync(ymlPath, 'utf8');

// Replace url/path filename
yml = yml.replace(/url: .+\.AppImage/, `url: ${normalised}`);
yml = yml.replace(/path: .+\.AppImage/, `path: ${normalised}`);
// Replace sha512 (appears twice: inside files[] and at top level)
yml = yml.replace(/sha512: .+/g, `sha512: ${sha512}`);
// Replace size
yml = yml.replace(/size: \d+/, `size: ${size}`);
// Remove blockMapSize — invalid after binary patch
yml = yml.replace(/\s+blockMapSize: \d+/, '');
// Refresh release date
yml = yml.replace(/releaseDate: .+/, `releaseDate: '${new Date().toISOString()}'`);

fs.writeFileSync(ymlPath, yml, 'utf8');
console.log('Updated latest-linux.yml');

// ── Publish to GitHub ─────────────────────────────────────────────────────────
console.log(`\nPublishing ${tag} to GitHub…`);

let releaseExists = false;
try {
  capture(`gh release view ${tag} --repo ${OWNER}/${REPO}`);
  releaseExists = true;
} catch {
  releaseExists = false;
}

if (!releaseExists) {
  run(`gh release create ${tag} --repo ${OWNER}/${REPO} --title "Bluesky Media Feed ${tag}" --notes "Release ${tag}" --draft`);
}

for (const asset of [appImagePath, zsyncPath, ymlPath]) {
  run(`gh release upload ${tag} "${asset}" --repo ${OWNER}/${REPO} --clobber`);
}

if (!releaseExists) {
  run(`gh release edit ${tag} --repo ${OWNER}/${REPO} --draft=false`);
}

console.log(`\nDone! https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`);
