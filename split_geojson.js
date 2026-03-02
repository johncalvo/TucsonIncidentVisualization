#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNK_SIZE = 50000; // features per chunk

const years = [2021, 2022, 2023, 2024, 2025];
const dataDir = './public/data';

years.forEach(year => {
  const filePath = path.join(dataDir, `Tucson_Police_Incidents_-_${year}_-_Open_Data.geojson`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  console.log(`Processing ${year} data...`);
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const features = data.features;
    
    console.log(`  Total features: ${features.length}`);
    
    const totalChunks = Math.ceil(features.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min((i + 1) * CHUNK_SIZE, features.length);
      const chunkFeatures = features.slice(start, end);
      
      const chunkData = {
        type: 'FeatureCollection',
        features: chunkFeatures
      };
      
      const chunkFileName = `Tucson_Police_Incidents_-_${year}_-_chunk_${String(i).padStart(2, '0')}.geojson`;
      const chunkPath = path.join(dataDir, chunkFileName);
      
      fs.writeFileSync(chunkPath, JSON.stringify(chunkData));
      console.log(`  ✓ Created chunk ${i + 1}/${totalChunks}: ${chunkFileName} (${chunkFeatures.length} features)`);
    }
    
    console.log(`✓ Finished splitting ${year}\n`);
  } catch (error) {
    console.error(`Error processing ${year}:`, error.message);
  }
});

console.log('Done! Original large files can now be removed.');
