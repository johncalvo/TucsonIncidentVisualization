#!/usr/bin/env node
/**
 * Report total/raw/gzip sizes for chunks listed in public/data/manifest.json.
 *
 * For .gz files, uses the gzip ISIZE trailer (last 4 bytes) to get the
 * uncompressed size without inflating the data.
 */

import fs from 'fs'
import path from 'path'

const dataDir = path.resolve('public/data')
const manifestPath = path.join(dataDir, 'manifest.json')

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const chunks = Array.isArray(manifest?.chunks) ? manifest.chunks : []

if (chunks.length === 0) {
  console.error('No chunks listed in manifest.json')
  process.exit(1)
}

const human = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(u === 0 ? 0 : 2)} ${units[u]}`
}

const readGzipISize = (filePath) => {
  // ISIZE is stored in the last 4 bytes of gzip stream, little-endian, modulo 2^32
  const fd = fs.openSync(filePath, 'r')
  try {
    const stat = fs.fstatSync(fd)
    if (stat.size < 4) return null
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, stat.size - 4)
    return buf.readUInt32LE(0)
  } finally {
    fs.closeSync(fd)
  }
}

const rows = []
let totalCompressed = 0
let totalUncompressed = 0

for (const file of chunks) {
  const fp = path.join(dataDir, file)
  if (!fs.existsSync(fp)) {
    rows.push({ file, exists: false })
    continue
  }

  const stat = fs.statSync(fp)
  const compressedBytes = stat.size
  let uncompressedBytes = null

  if (file.endsWith('.gz')) {
    uncompressedBytes = readGzipISize(fp)
  } else {
    uncompressedBytes = compressedBytes
  }

  totalCompressed += compressedBytes
  if (typeof uncompressedBytes === 'number') totalUncompressed += uncompressedBytes

  rows.push({
    file,
    exists: true,
    compressedBytes,
    uncompressedBytes,
    ratio: typeof uncompressedBytes === 'number' && uncompressedBytes > 0
      ? compressedBytes / uncompressedBytes
      : null,
  })
}

const missing = rows.filter(r => r.exists === false)
const ok = rows.filter(r => r.exists)

ok.sort((a, b) => (b.compressedBytes || 0) - (a.compressedBytes || 0))

console.log(`Chunks in manifest: ${chunks.length}`)
console.log(`Missing files: ${missing.length}`)
console.log(`Total download (as listed): ${human(totalCompressed)}`)
console.log(`Total uncompressed (estimated): ${human(totalUncompressed)}`)
if (totalUncompressed > 0) {
  console.log(`Overall ratio: ${(totalCompressed / totalUncompressed * 100).toFixed(1)}%`)
}

console.log('')
console.log('Top 10 largest chunks (download size):')
for (const r of ok.slice(0, 10)) {
  const ratio = r.ratio == null ? '' : ` (${(r.ratio * 100).toFixed(1)}%)`
  console.log(`- ${r.file}: ${human(r.compressedBytes)}${ratio}`)
}

if (missing.length > 0) {
  console.log('')
  console.log('Missing:')
  for (const r of missing.slice(0, 20)) {
    console.log(`- ${r.file}`)
  }
  if (missing.length > 20) console.log(`...and ${missing.length - 20} more`)
}
