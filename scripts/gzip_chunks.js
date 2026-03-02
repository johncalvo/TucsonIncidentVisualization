#!/usr/bin/env node
/**
 * Gzip all GeoJSON chunk files under public/data.
 *
 * Creates `*.geojson.gz` next to the original files (does not delete originals).
 *
 * Usage:
 *   node scripts/gzip_chunks.js
 *   node scripts/gzip_chunks.js --level 9
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const idx = args.indexOf(name)
  if (idx === -1) return fallback
  const v = args[idx + 1]
  return v === undefined ? fallback : v
}

const level = Math.max(1, Math.min(9, Number(getArg('--level', '9')) || 9))
const dataDir = path.resolve('public/data')

const GEOJSON_RE = /^Tucson_Police_Incidents_-_\d{4}_-_chunk_\d+\.geojson$/

const files = fs.readdirSync(dataDir).filter((f) => GEOJSON_RE.test(f)).sort((a, b) => a.localeCompare(b))
if (files.length === 0) {
  console.error('No chunk .geojson files found in public/data')
  process.exit(1)
}

console.log(`Gzipping ${files.length} files in ${dataDir} (level ${level})...`)

for (const file of files) {
  const inPath = path.join(dataDir, file)
  const outPath = inPath + '.gz'

  // Skip if up-to-date
  if (fs.existsSync(outPath)) {
    const inStat = fs.statSync(inPath)
    const outStat = fs.statSync(outPath)
    if (outStat.mtimeMs >= inStat.mtimeMs && outStat.size > 0) {
      console.log(`  skip ${path.basename(outPath)} (already exists)`)
      continue
    }
  }

  const input = fs.readFileSync(inPath)
  const gz = zlib.gzipSync(input, { level })
  fs.writeFileSync(outPath, gz)

  const ratio = input.length > 0 ? (gz.length / input.length) : 1
  console.log(`  wrote ${path.basename(outPath)} (${(gz.length / 1024 / 1024).toFixed(2)} MB, ${(ratio * 100).toFixed(1)}%)`)
}

console.log('Done.')
