#!/usr/bin/env node
/**
 * Re-chunk GeoJSON files: split into 20k-25k features per chunk
 * Creates chunks for all years (2021-2025) in public/data/
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../public/data');
const outputDir = path.join(__dirname, '../public/data');

// Target features per chunk
const CHUNK_SIZE = 20000;

// All year files with their chunks
const yearFiles = [
  { year: 2021, file: 'Tucson_Police_Incidents_-_2021_-_chunk_00.geojson' },
  { year: 2021, file: 'Tucson_Police_Incidents_-_2021_-_chunk_01.geojson' },
  { year: 2022, file: 'Tucson_Police_Incidents_-_2022_-_chunk_00.geojson' },
  { year: 2022, file: 'Tucson_Police_Incidents_-_2022_-_chunk_01.geojson' },
  { year: 2022, file: 'Tucson_Police_Incidents_-_2022_-_chunk_02.geojson' },
  { year: 2023, file: 'Tucson_Police_Incidents_-_2023_-_chunk_00.geojson' },
  { year: 2023, file: 'Tucson_Police_Incidents_-_2023_-_chunk_01.geojson' },
  { year: 2023, file: 'Tucson_Police_Incidents_-_2023_-_chunk_02.geojson' },
  { year: 2024, file: 'Tucson_Police_Incidents_-_2024_-_chunk_00.geojson' },
  { year: 2024, file: 'Tucson_Police_Incidents_-_2024_-_chunk_01.geojson' },
  { year: 2024, file: 'Tucson_Police_Incidents_-_2024_-_chunk_02.geojson' },
  { year: 2025, file: 'Tucson_Police_Incidents_-_2025_-_chunk_00.geojson' },
  { year: 2025, file: 'Tucson_Police_Incidents_-_2025_-_chunk_01.geojson' }
];

const allFeatures = [];

// Load all chunks
console.log('Loading all chunks...');
for (const { year, file } of yearFiles) {
  const filePath = path.join(sourceDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${file}`);
    continue;
  }
  
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(text);
    
    if (json.features && Array.isArray(json.features)) {
      json.features.forEach(f => {
        // Ensure YEAR_OCCU is set
        if (!f.properties.YEAR_OCCU) {
          f.properties.YEAR_OCCU = year;
        }
        allFeatures.push(f);
      });
      console.log(`  Loaded ${file}: ${json.features.length} features`);
    }
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
  }
}

console.log(`\nTotal features loaded: ${allFeatures.length}`);

// Re-chunk into CHUNK_SIZE chunks
const chunks = [];
for (let i = 0; i < allFeatures.length; i += CHUNK_SIZE) {
  chunks.push(allFeatures.slice(i, i + CHUNK_SIZE));
}

console.log(`Creating ${chunks.length} new chunks of ~${CHUNK_SIZE} features each...\n`);

// Write new chunks
let totalWritten = 0;
chunks.forEach((chunk, idx) => {
  const chunkName = `Tucson_Police_Incidents_-_2021_2025_-_chunk_${String(idx).padStart(2, '0')}.geojson`;
  const outputPath = path.join(outputDir, chunkName);
  
  const geojson = {
    type: 'FeatureCollection',
    features: chunk
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(geojson), 'utf8');
  totalWritten += chunk.length;
  console.log(`  ${chunkName}: ${chunk.length} features`);
});

console.log(`\nDone! Created ${chunks.length} chunks with ${totalWritten} total features`);
console.log(`Update App.jsx to load these chunk files.`);
