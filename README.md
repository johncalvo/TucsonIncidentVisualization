# Tucson Incident Visualization

Interactive map-based visualization of Tucson police incidents with heatmaps, timeline charts, and advanced filtering.

## Features

- **Interactive Heatmap** - Visualize incident density across Tucson
- **Timeline Chart** - Track incident volume over time with category breakdown
- **Advanced Filters** - Filter by:
  - Crime Category (Violent, Property, Quality of Life, etc.)
  - Month
  - Zip Code
  - Division
  - Address (search)
- **Real-time Statistics** - View counts and metrics that update as you filter

## Getting Started

1. Copy the GeoJSON file to the public directory:
```bash
cp /path/to/Tucson_Police_Incidents_-_2025_-_Open_Data.geojson public/data/
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Technology Stack

- React 18
- Vite
- Leaflet (mapping)
- Chart.js (timeline visualization)
- Tailwind CSS (styling)
