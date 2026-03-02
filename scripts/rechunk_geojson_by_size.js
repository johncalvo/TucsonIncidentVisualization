#!/usr/bin/env node
/**
 * Re-chunk GeoJSON into ~N MB files (by bytes, not feature count).
 *
 * - Reads existing per-year chunk files from public/data
 * - Writes new per-year chunk files back into public/data (default)
 * - Generates a fresh manifest.json afterwards (via scripts/generate_manifest.js)
 *
 * Usage:
 *   node scripts/rechunk_geojson_by_size.js --targetMB 5
 *   node scripts/rechunk_geojson_by_size.js --targetMB 5 --outDir public/data
 *
 * Notes:
 * - This keeps valid GeoJSON FeatureCollections.
 * - Size is approximate and based on UTF-8 byte length.
 */

import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const idx = args.indexOf(name)
  if (idx === -1) return fallback
  const v = args[idx + 1]
  return v === undefined ? fallback : v
}

const targetMB = Number(getArg('--targetMB', '5'))
if (!Number.isFinite(targetMB) || targetMB <= 0) {
  console.error('Invalid --targetMB; expected a positive number')
  process.exit(1)
}

const inDir = path.resolve(getArg('--inDir', 'public/data'))
const outDir = path.resolve(getArg('--outDir', 'public/data'))

const TARGET_BYTES = Math.floor(targetMB * 1024 * 1024)

const YEAR_CHUNK_RE = /^Tucson_Police_Incidents_-_(\d{4})_-_chunk_(\d+)\.geojson$/

const listYearChunks = () => {
  const files = fs.readdirSync(inDir)
  const byYear = new Map()

  for (const f of files) {
    const m = YEAR_CHUNK_RE.exec(f)
    if (!m) continue
    const year = Number(m[1])
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(f)
  }

  for (const [year, yearFiles] of byYear.entries()) {
    yearFiles.sort((a, b) => a.localeCompare(b))
    byYear.set(year, yearFiles)
  }

  return Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])
}

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

const writeChunkHeader = (ws) => {
  ws.write('{"type":"FeatureCollection","features":[', 'utf8')
}

const writeChunkFooter = (ws) => {
  ws.write(']}', 'utf8')
}

const headerBytes = Buffer.byteLength('{"type":"FeatureCollection","features":[', 'utf8')
const footerBytes = Buffer.byteLength(']}', 'utf8')
const commaBytes = Buffer.byteLength(',', 'utf8')

const rechunkYear = (year, files) => {
  console.log(`\nRechunking ${year} from ${files.length} source files...`)

  let outIdx = 0
  let ws = null
  let bytes = 0
  let count = 0
  let wroteAny = false

  const openNew = () => {
    if (ws) {
      writeChunkFooter(ws)
      ws.end()
    }

    const outName = `Tucson_Police_Incidents_-_${year}_-_chunk_${String(outIdx).padStart(4, '0')}.geojson`
    outIdx++
    const outPath = path.join(outDir, outName)

    ws = fs.createWriteStream(outPath, { encoding: 'utf8' })
    writeChunkHeader(ws)
    bytes = headerBytes + footerBytes
    count = 0
    wroteAny = false

    return outName
  }

  let currentName = openNew()

  for (const file of files) {
    const fp = path.join(inDir, file)
    const text = fs.readFileSync(fp, 'utf8')
    const json = JSON.parse(text)
    const features = Array.isArray(json.features) ? json.features : []

    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      if (feature?.properties && feature.properties.YEAR_OCCU == null) {
        feature.properties.YEAR_OCCU = year
      }

      const featureStr = JSON.stringify(feature)
      const featureBytes = Buffer.byteLength(featureStr, 'utf8')
      const nextBytes = bytes + featureBytes + (wroteAny ? commaBytes : 0)

      if (nextBytes > TARGET_BYTES && wroteAny) {
        // close current chunk and start a new one
        console.log(`  Wrote ${currentName}: ${count} features (~${Math.round(bytes / 1024 / 1024)} MB)`)
        currentName = openNew()
      }

      if (wroteAny) {
        ws.write(',', 'utf8')
        bytes += commaBytes
      }

      ws.write(featureStr, 'utf8')
      bytes += featureBytes
      count++
      wroteAny = true
    }
  }

  if (ws) {
    writeChunkFooter(ws)
    ws.end()
    console.log(`  Wrote ${currentName}: ${count} features (~${Math.round(bytes / 1024 / 1024)} MB)`)
  }

  return outIdx
}

const main = () => {
  ensureDir(outDir)

  const years = listYearChunks()
  if (years.length === 0) {
    console.error(`No year chunk files found in ${inDir}`)
    process.exit(1)
  }

  console.log(`Input:  ${inDir}`)
  console.log(`Output: ${outDir}`)
  console.log(`Target: ${targetMB} MB (~${TARGET_BYTES} bytes) per chunk`)

  let totalOut = 0
  for (const [year, files] of years) {
    totalOut += rechunkYear(year, files)
  }

  console.log(`\nDone. Created ~${totalOut} output chunks (4-digit indices).`)
  console.log('Now run: node scripts/generate_manifest.js')
}

main()
