import fs from 'fs'
import path from 'path'

const publicDataDir = path.resolve('public/data')
const outFile = path.join(publicDataDir, 'manifest.json')

const files = fs.readdirSync(publicDataDir)
const GEOJSON_RE = /^Tucson_Police_Incidents_-_\d{4}_-_chunk_\d+\.geojson$/
const GZ_RE = /^Tucson_Police_Incidents_-_\d{4}_-_chunk_\d+\.geojson\.gz$/

const rawChunks = files.filter((f) => GEOJSON_RE.test(f)).sort((a, b) => a.localeCompare(b))
const gzChunks = files.filter((f) => GZ_RE.test(f)).sort((a, b) => a.localeCompare(b))

// Prefer .gz if present so browsers always download the smaller payload.
// If uncompressed chunks are not present, fall back to whatever .gz chunks exist.
const chunkFiles = rawChunks.length > 0
  ? rawChunks.map((f) => {
      const gz = `${f}.gz`
      return files.includes(gz) ? gz : f
    })
  : gzChunks

const manifest = {
  version: 2,
  chunks: chunkFiles,
}

fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(`Wrote ${outFile} with ${chunkFiles.length} chunks`)
