#!/usr/bin/env node
/**
 * scripts/upload-r2.js
 * Uploads all files from public/data/ to Cloudflare R2 using the S3-compatible API.
 *
 * Required environment variables (set in .env or CI secrets):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (used only for display, not upload)
 *
 * Usage:
 *   node scripts/upload-r2.js
 *   node scripts/upload-r2.js --dir public/data  (default)
 *   node scripts/upload-r2.js --file public/data/manifest.json  (single file)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// Parse CLI args
const args = process.argv.slice(2)
const singleFile = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const dataDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : join(ROOT, 'public', 'data')

// Validate env vars
const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env

// Create S3 client pointed at R2
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

/**
 * Returns the correct Content-Type for a file based on its extension.
 */
function getContentType(filename) {
  const ext = extname(filename).toLowerCase()
  switch (ext) {
    case '.json': return 'application/json'
    case '.geojson': return 'application/geo+json'
    case '.gz': return 'application/octet-stream'
    case '.html': return 'text/html'
    case '.js': return 'application/javascript'
    case '.css': return 'text/css'
    default: return 'application/octet-stream'
  }
}

/**
 * Returns extra headers for gzip-compressed files.
 */
function getExtraHeaders(filename) {
  if (filename.endsWith('.gz')) {
    return { ContentEncoding: 'gzip' }
  }
  return {}
}

/**
 * Uploads a single file to R2.
 */
async function uploadFile(localPath, key) {
  const body = readFileSync(localPath)
  const contentType = getContentType(key)
  const extraHeaders = getExtraHeaders(key)

  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: key === 'manifest.json' ? 'public, max-age=60' : 'public, max-age=86400',
    ...extraHeaders,
  })

  await client.send(cmd)
  const sizeKb = (body.length / 1024).toFixed(1)
  console.log(`  ✓ ${key} (${sizeKb} KB, ${contentType})`)
}

/**
 * Collects all files in a directory recursively.
 */
function collectFiles(dir, prefix = '') {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const key = prefix ? `${prefix}/${entry}` : entry
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectFiles(full, key))
    } else {
      files.push({ localPath: full, key })
    }
  }
  return files
}

async function main() {
  if (singleFile) {
    const abs = singleFile.startsWith('/') ? singleFile : join(ROOT, singleFile)
    const key = basename(abs)
    console.log(`Uploading single file: ${key} → R2 bucket: ${R2_BUCKET_NAME}`)
    await uploadFile(abs, key)
    console.log(`Done. ${R2_PUBLIC_URL ? `Public URL: ${R2_PUBLIC_URL}/${key}` : ''}`)
    return
  }

  console.log(`Scanning: ${dataDir}`)
  let files
  try {
    files = collectFiles(dataDir)
  } catch (err) {
    console.error(`Cannot read directory: ${dataDir}`)
    console.error(err.message)
    process.exit(1)
  }

  if (files.length === 0) {
    console.warn('No files found in data directory. Nothing to upload.')
    return
  }

  const totalSize = files.reduce((sum, f) => sum + statSync(f.localPath).size, 0)
  console.log(`Found ${files.length} files (${(totalSize / 1024 / 1024).toFixed(1)} MB total)`)
  console.log(`Uploading to R2 bucket: ${R2_BUCKET_NAME}`)
  console.log('---')

  let uploaded = 0
  let failed = 0

  // Upload in batches of 8 concurrent uploads
  const batchSize = 8
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(({ localPath, key }) => uploadFile(localPath, key))
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        uploaded++
      } else {
        failed++
        console.error(`  ✗ FAILED: ${result.reason?.message || result.reason}`)
      }
    }
  }

  console.log('---')
  console.log(`Upload complete: ${uploaded} succeeded, ${failed} failed`)
  if (R2_PUBLIC_URL) {
    console.log(`Data accessible at: ${R2_PUBLIC_URL}/manifest.json`)
  }

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
