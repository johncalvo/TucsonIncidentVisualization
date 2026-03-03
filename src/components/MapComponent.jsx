import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import StatsBadge from './StatsBadge'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const MAP_CLUSTER_LIMIT = 8000
const DEFAULT_CENTER = [32.2226, -110.9747]
const DEFAULT_ZOOM = 12

function MapComponent({ data }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const heatmapLayerRef = useRef(null)
  const markersRef = useRef(null)
  const validFeaturesRef = useRef([])
  const [viewMode, setViewMode] = useState('heatmap')

  const totalFeatures = data?.features?.length || 0
  const truncated = viewMode === 'clusters' && totalFeatures > MAP_CLUSTER_LIMIT

  const fitToData = useCallback(() => {
    const features = validFeaturesRef.current
    if (!mapInstanceRef.current || features.length === 0) return
    const bounds = L.latLngBounds(features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]))
    if (bounds.isValid()) mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] })
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(mapInstanceRef.current)
    }

    if (heatmapLayerRef.current) {
      try { mapInstanceRef.current.removeLayer(heatmapLayerRef.current) } catch (e) {}
      heatmapLayerRef.current = null
    }
    if (markersRef.current) {
      try { mapInstanceRef.current.removeLayer(markersRef.current) } catch (e) {}
      markersRef.current = null
    }

    if (!data?.features?.length) return

    const validFeatures = data.features.filter(feature => {
      const coords = feature.geometry?.coordinates
      return coords && Array.isArray(coords) && coords.length >= 2 && coords[0] !== 0 && coords[1] !== 0
    })
    validFeaturesRef.current = validFeatures

    if (validFeatures.length === 0) return

    if (viewMode === 'heatmap') {
      // Adaptive intensity: scale each point so dense clusters glow and sparse areas fade
      // ~60 overlapping points → full brightness (prevents giant blobs on dense datasets)
      const pointIntensity = Math.max(0.002, Math.min(1.0, 8000 / Math.max(1, validFeatures.length)))

      const heatData = validFeatures.map(f => {
        const [lng, lat] = f.geometry.coordinates
        return [lat, lng, pointIntensity]
      })

      heatmapLayerRef.current = L.heatLayer(heatData, {
        radius: 10,
        blur: 12,
        maxZoom: 17,
        minOpacity: 0.05,
        max: 1.0,
        gradient: {
          0.2: '#0c4a6e',
          0.4: '#06b6d4',
          0.65: '#f97316',
          0.85: '#ef4444',
          1.0: '#7f1d1d',
        },
      }).addTo(mapInstanceRef.current)
    } else {
      const featuresForClusters = validFeatures.slice(0, MAP_CLUSTER_LIMIT)

      markersRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        disableClusteringAtZoom: 16,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      })

      featuresForClusters.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates
        const p = feature.properties

        const popup = `
          <div style="min-width:200px;font-family:Inter,sans-serif;background:#1f2937;color:#f9fafb;padding:10px;border-radius:6px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#f9fafb">${p.CrimeType || 'Unknown'}</div>
            <div style="color:#9ca3af;font-size:12px;margin-bottom:6px">${p.CrimeCategory || ''}</div>
            <div style="font-size:12px;color:#d1d5db">${p.ADDRESS_PUBLIC || ''}</div>
            ${p.DATE_OCCU ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">${new Date(p.DATE_OCCU).toLocaleDateString()}</div>` : ''}
          </div>
        `

        L.marker([lat, lng]).bindPopup(popup, { className: 'dark-popup' }).addTo(markersRef.current)
      })

      mapInstanceRef.current.addLayer(markersRef.current)
    }

    return () => {
      if (heatmapLayerRef.current && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(heatmapLayerRef.current) } catch (e) {}
      }
      if (markersRef.current && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(markersRef.current) } catch (e) {}
      }
    }
  }, [data, viewMode])

  const btnBase = {
    padding: '0.3rem 0.625rem',
    borderRadius: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#111827', border: '1px solid #1f2937' }}>
      {/* Controls bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: '#111827', borderBottom: '1px solid #1f2937', flexWrap: 'wrap' }}>
        <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>View:</span>
        {['heatmap', 'clusters'].map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              ...btnBase,
              borderColor: viewMode === mode ? '#06b6d4' : '#374151',
              background: viewMode === mode ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: viewMode === mode ? '#06b6d4' : '#6b7280',
            }}
          >
            {mode === 'heatmap' ? 'Heatmap' : 'Clusters'}
          </button>
        ))}

        <button
          onClick={fitToData}
          style={{ ...btnBase, borderColor: '#374151', background: 'transparent', color: '#6b7280', marginLeft: '0.25rem' }}
          title="Fit map to current data"
        >
          ⊡ Fit
        </button>

        {truncated && (
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#f97316' }}>
            Showing {MAP_CLUSTER_LIMIT.toLocaleString()} of {totalFeatures.toLocaleString()} (truncated)
          </span>
        )}
      </div>

      {/* Map + floating badge */}
      <div style={{ position: 'relative' }}>
        <div
          ref={mapRef}
          style={{ height: 'calc(100vh - 210px)', minHeight: '480px', width: '100%' }}
        />
        <StatsBadge
          filteredCount={totalFeatures}
          totalCount={totalFeatures}
          truncated={truncated}
        />
      </div>
    </div>
  )
}

export default MapComponent
