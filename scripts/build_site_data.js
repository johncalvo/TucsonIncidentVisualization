#!/usr/bin/env node
/**
 * Build site data for the app from one-or-more source GeoJSON files.
 *
 * Pipeline:
 *  1) Backup existing public/data chunk files to data/site_data_backup_<ts>/
 *  2) Stream-chunk each source file into ~N MB chunk_0000.geojson files
 *  3) Gzip chunks (creates *.geojson.gz)
 *  4) Generate public/data/manifest.json
 *  5) Report sizes
 *  6) Move uncompressed chunks into data/uncompressed_chunks_backup_<ts>/
 *
 * Usage:
 *  node scripts/build_site_data.js --targetMB 5 --level 9
 *  node scripts/build_site_data.js --srcDir data --outDir public/data --targetMB 5 --level 9
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import zlib from 'node:zlib';

import streamChainPkg from 'stream-chain';
import streamJsonPkg from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

const { chain } = streamChainPkg;
const { parser } = streamJsonPkg;
const { pick } = pickPkg;
const { streamArray } = streamArrayPkg;

const ROOT = process.cwd();

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const v = args[idx + 1];
  return v === undefined ? fallback : v;
};

const srcDir = path.resolve(ROOT, getArg('--srcDir', 'data'));
const outDir = path.resolve(ROOT, getArg('--outDir', 'public/data'));
const targetMB = Number(getArg('--targetMB', '5'));
const level = Math.max(1, Math.min(9, Number(getArg('--level', '9')) || 9));

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm run build:data -- [--srcDir data] [--outDir public/data] [--targetMB 5] [--level 9]');
  console.log('Expects source files named: Tucson_Police_Incidents_-_YYYY_-_Open_Data.geojson(.gz)');
  process.exit(0);
}

if (!Number.isFinite(targetMB) || targetMB <= 0) {
  console.error('Invalid --targetMB; expected a positive number');
  process.exit(1);
}

const TARGET_BYTES = Math.floor(targetMB * 1024 * 1024);

const SOURCE_RE = /^Tucson_Police_Incidents_-_(\d{4})_-_Open_Data\.geojson(\.gz)?$/;
const CHUNK_RE = /^Tucson_Police_Incidents_-_\d{4}_-_chunk_\d+\.geojson(\.gz)?$/;

const headerStr = '{"type":"FeatureCollection","features":[';
const footerStr = ']}';
const headerBytes = Buffer.byteLength(headerStr, 'utf8');
const footerBytes = Buffer.byteLength(footerStr, 'utf8');
const commaBytes = Buffer.byteLength(',', 'utf8');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function moveFile(from, to) {
  try {
    await fs.rename(from, to);
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'EXDEV') {
      await fs.copyFile(from, to);
      await fs.unlink(from);
      return;
    }
    throw err;
  }
}

async function backupExistingPublicData(ts) {
  if (!(await pathExists(outDir))) return null;

  const entries = await fs.readdir(outDir);
  const toBackup = entries.filter((n) => CHUNK_RE.test(n) || n === 'manifest.json');
  if (toBackup.length === 0) return null;

  const backupDir = path.join(ROOT, 'data', `site_data_backup_${ts}`);
  await ensureDir(backupDir);

  for (const name of toBackup) {
    await moveFile(path.join(outDir, name), path.join(backupDir, name));
  }

  return backupDir;
}

async function listSourceFiles() {
  if (!(await pathExists(srcDir))) {
    console.error(`Missing source dir: ${srcDir}`);
    process.exit(1);
  }

  const files = await fs.readdir(srcDir);
  const sources = [];
  for (const f of files) {
    const m = SOURCE_RE.exec(f);
    if (!m) continue;
    sources.push({
      year: Number(m[1]),
      file: path.join(srcDir, f),
      gz: Boolean(m[2]),
    });
  }

  sources.sort((a, b) => a.year - b.year);
  return sources;
}

function openChunkWriteStream(year, chunkIdx) {
  const outName = `Tucson_Police_Incidents_-_${year}_-_chunk_${String(chunkIdx).padStart(4, '0')}.geojson`;
  const outPath = path.join(outDir, outName);

  const ws = createWriteStream(outPath, { encoding: 'utf8' });
  ws.write(headerStr, 'utf8');

  return { ws, outName, outPath };
}

async function chunkSourceFile({ year, file, gz }) {
  console.log(`\nChunking ${path.relative(ROOT, file)} (${year}) -> ~${targetMB}MB chunks...`);

  const rawStream = createReadStream(file);
  const inputStream = gz ? rawStream.pipe(zlib.createGunzip()) : rawStream;

  let chunkIdx = 0;
  let { ws, outName } = openChunkWriteStream(year, chunkIdx);
  chunkIdx++;

  let bytes = headerBytes + footerBytes;
  let wroteAny = false;
  let count = 0;

  const closeChunk = async () => {
    ws.write(footerStr, 'utf8');
    await new Promise((resolve) => ws.end(resolve));
  };

  const openNewChunk = async () => {
    await closeChunk();
    console.log(`  Wrote ${outName}: ${count} features (~${Math.round(bytes / 1024 / 1024)} MB)`);

    ({ ws, outName } = openChunkWriteStream(year, chunkIdx));
    chunkIdx++;
    bytes = headerBytes + footerBytes;
    wroteAny = false;
    count = 0;
  };

  const pipeline = chain([inputStream, parser(), pick({ filter: 'features' }), streamArray()]);

  for await (const data of pipeline) {
    const feature = data?.value;
    if (!feature) continue;

    if (feature?.properties && feature.properties.YEAR_OCCU == null) {
      feature.properties.YEAR_OCCU = year;
    }

    const featureStr = JSON.stringify(feature);
    const featureBytes = Buffer.byteLength(featureStr, 'utf8');
    const nextBytes = bytes + featureBytes + (wroteAny ? commaBytes : 0);

    if (nextBytes > TARGET_BYTES && wroteAny) {
      await openNewChunk();
    }

    if (wroteAny) {
      ws.write(',', 'utf8');
      bytes += commaBytes;
    }

    ws.write(featureStr, 'utf8');
    bytes += featureBytes;
    wroteAny = true;
    count++;
  }

  await closeChunk();
  console.log(`  Wrote ${outName}: ${count} features (~${Math.round(bytes / 1024 / 1024)} MB)`);

  return chunkIdx;
}

async function gzipChunks() {
  const files = (await fs.readdir(outDir))
    .filter((f) => /\.geojson$/.test(f) && CHUNK_RE.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error('No chunk .geojson files found to gzip.');
    process.exit(1);
  }

  console.log(`\nGzipping ${files.length} chunks (level ${level})...`);
  for (const file of files) {
    const inPath = path.join(outDir, file);
    const outPath = inPath + '.gz';

    const input = await fs.readFile(inPath);
    const gz = zlib.gzipSync(input, { level });
    await fs.writeFile(outPath, gz);
  }
}

async function generateManifest() {
  // Run the existing manifest script to keep logic centralized.
  await import('./generate_manifest.js');
}

async function reportSizes() {
  await import('./report_chunk_sizes.js');
}

async function moveUncompressedChunksToBackup(ts) {
  const dest = path.join(ROOT, 'data', `uncompressed_chunks_backup_${ts}`);
  await ensureDir(dest);

  const entries = await fs.readdir(outDir);
  const raw = entries.filter((n) => CHUNK_RE.test(n) && n.endsWith('.geojson'));

  for (const name of raw) {
    await moveFile(path.join(outDir, name), path.join(dest, name));
  }

  return { dest, count: raw.length };
}

async function main() {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '_');

  await ensureDir(outDir);

  const sources = await listSourceFiles();
  if (sources.length === 0) {
    console.error(`No source files found in ${srcDir}`);
    console.error('Expected names like: Tucson_Police_Incidents_-_2026_-_Open_Data.geojson');
    process.exit(1);
  }

  const backedUp = await backupExistingPublicData(ts);
  if (backedUp) {
    console.log(`Backed up existing site data -> ${path.relative(ROOT, backedUp)}`);
  }

  console.log(`\nSources: ${sources.map((s) => s.year).join(', ')}`);
  console.log(`Output:  ${path.relative(ROOT, outDir)}`);
  console.log(`Target:  ${targetMB} MB per chunk`);

  let totalChunks = 0;
  for (const s of sources) {
    totalChunks += await chunkSourceFile(s);
  }

  await gzipChunks();
  await generateManifest();
  await reportSizes();

  const moved = await moveUncompressedChunksToBackup(ts);
  console.log(`\nMoved ${moved.count} uncompressed chunk(s) -> ${path.relative(ROOT, moved.dest)}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
