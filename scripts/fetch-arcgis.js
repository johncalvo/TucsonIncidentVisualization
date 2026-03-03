#!/usr/bin/env node
/**
 * scripts/fetch-arcgis.js
 * Fetches recent Tucson Police incident data from the ArcGIS REST API
 * and writes a GeoJSON file to data/fetched_YYYY-MM-DD.geojson
 *
 * Run manually:
 *   node scripts/fetch-arcgis.js
 *   node scripts/fetch-arcgis.js --year 2025
 *   node scripts/fetch-arcgis.js --since 2025-01-01
 *
 * In GitHub Actions, set the ARCGIS_ENDPOINT env var.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'data')

// ArcGIS MapServer endpoints (verified working 2025-03)
// Base: https://gis.tucsonaz.gov/arcgis/rest/services/PublicMaps/OpenData_PublicSafety/MapServer
const BASE = 'https://gis.tucsonaz.gov/arcgis/rest/services/PublicMaps/OpenData_PublicSafety/MapServer'
const ENDPOINTS = {
  2025: process.env.ARCGIS_ENDPOINT || `${BASE}/81/query`,
  2024: `${BASE}/80/query`,
  2023: `${BASE}/78/query`,
  2022: `${BASE}/71/query`,
  2021: `${BASE}/69/query`,
}

// Last-45-days endpoint for near-real-time updates
const LAST_45_ENDPOINT =
  'https://gis.tucsonaz.gov/public/rest/services/PublicMaps/PublicSafety/MapServer/49/query'

const PAGE_SIZE = 2000 // ArcGIS default max per request

// Parse CLI args
const args = process.argv.slice(2)
const yearArg = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : null
const last45Only = args.includes('--last45')

/**
 * Fetch one page of ArcGIS features.
 * Returns { features, exceededTransferLimit }
 */
async function fetchPage(endpoint, where, offset = 0) {
  const params = new URLSearchParams({
    where,
    outFields: '*',
    outSR: '4326',
    f: 'geojson',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: 'DATE_OCCU ASC',
  })

  const url = `${endpoint}?${params}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${endpoint}: ${await res.text()}`)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(`ArcGIS error: ${JSON.stringify(json.error)}`)
  }

  return {
    features: json.features || [],
    exceededTransferLimit: !!json.exceededTransferLimit,
  }
}

/**
 * Fetch ALL features from an endpoint with pagination.
 */
async function fetchAll(endpoint, where) {
  const allFeatures = []
  let offset = 0
  let page = 0

  console.log(`  Endpoint: ${endpoint}`)
  console.log(`  Where: ${where}`)

  while (true) {
    page++
    process.stdout.write(`  Page ${page} (offset ${offset})... `)
    const { features, exceededTransferLimit } = await fetchPage(endpoint, where, offset)
    console.log(`${features.length} records`)
    allFeatures.push(...features)

    if (!exceededTransferLimit || features.length < PAGE_SIZE) break
    offset += features.length
  }

  return allFeatures
}

/**
 * Convert ArcGIS feature (already GeoJSON format from ?f=geojson) to
 * a normalized GeoJSON feature with consistent property names.
 */
function normalizeFeature(feature) {
  if (!feature || !feature.properties) return null
  const p = feature.properties

  // Derive month name from DATE_OCCU epoch ms
  let monthName = ''
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
  if (p.DATE_OCCU) {
    const d = new Date(typeof p.DATE_OCCU === 'number' ? p.DATE_OCCU : p.DATE_OCCU)
    if (!isNaN(d.getTime())) {
      monthName = MONTHS[d.getMonth()] || ''
    }
  }

  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: {
      ...p,
      MONTH_OCCU: p.MONTH_OCCU || monthName,
    },
  }
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true })

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)

  if (last45Only) {
    // Fetch last 45 days only
    console.log('Fetching last 45 days dataset...')
    const features = await fetchAll(LAST_45_ENDPOINT, '1=1')
    const normalized = features.map(normalizeFeature).filter(Boolean)
    const outPath = join(DATA_DIR, `fetched_last45_${dateStr}.geojson`)
    writeFileSync(outPath, JSON.stringify({
      type: 'FeatureCollection',
      fetchedAt: today.toISOString(),
      features: normalized,
    }, null, 0))
    console.log(`Wrote ${normalized.length} features to ${outPath}`)
    return
  }

  // Determine which years to fetch
  let years = yearArg ? [yearArg] : Object.keys(ENDPOINTS).map(Number).sort()

  // Determine the where clause
  let where = '1=1'
  if (sinceArg) {
    // Only fetch records on or after sinceArg date
    where = `DATE_OCCU >= DATE '${sinceArg}'`
  } else if (!yearArg) {
    // Default: fetch yesterday's records from the current year
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yISO = yesterday.toISOString().slice(0, 10)
    const currentYear = today.getFullYear()
    years = [currentYear]
    where = `YEAR_OCCU=${currentYear} AND DATE_OCCU >= DATE '${yISO}'`
    console.log(`Fetching incremental update: YEAR=${currentYear}, since ${yISO}`)
  }

  const allFeatures = []

  for (const year of years) {
    const endpoint = ENDPOINTS[year]
    if (!endpoint) {
      console.warn(`No endpoint configured for year ${year}, skipping`)
      continue
    }
    console.log(`\nFetching year ${year}...`)
    const yearWhere = yearArg ? where : (sinceArg ? `YEAR_OCCU=${year} AND ${where}` : where)
    try {
      const features = await fetchAll(endpoint, yearWhere)
      allFeatures.push(...features)
      console.log(`  Total for ${year}: ${features.length}`)
    } catch (err) {
      console.error(`  Error fetching ${year}: ${err.message}`)
    }
  }

  // Normalize
  const normalized = allFeatures.map(normalizeFeature).filter(Boolean)
  console.log(`\nTotal features fetched: ${normalized.length}`)

  // Deduplicate by INCI_ID
  const seen = new Set()
  const deduped = normalized.filter(f => {
    const id = f.properties?.INCI_ID
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  if (deduped.length < normalized.length) {
    console.log(`Deduped: removed ${normalized.length - deduped.length} duplicates`)
  }

  const outPath = join(DATA_DIR, `fetched_${dateStr}.geojson`)
  writeFileSync(outPath, JSON.stringify({
    type: 'FeatureCollection',
    fetchedAt: today.toISOString(),
    features: deduped,
  }, null, 0))

  console.log(`Wrote ${deduped.length} features to ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
