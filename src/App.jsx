import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import Filters from './components/Filters'
import MetricsDashboard from './components/MetricsDashboard'
import Navigation from './components/Navigation'
import CollapsibleSection from './components/CollapsibleSection'

const MapComponent = React.lazy(() => import('./components/MapComponent'))
const TimelineChart = React.lazy(() => import('./components/TimelineChart'))
const TimelineVolumeChart = React.lazy(() => import('./components/TimelineVolumeChart'))
const DetailedAnalysis = React.lazy(() => import('./components/DetailedAnalysis'))
const FieldTimelineChart = React.lazy(() => import('./components/FieldTimelineChart'))
const TranscriptViewer = React.lazy(() => import('./components/TranscriptViewer'))

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_TO_NUM = MONTH_ORDER.reduce((acc, m, idx) => {
  acc[m] = String(idx + 1).padStart(2, '0')
  return acc
}, {})

function useInView({ rootMargin = '250px', threshold = 0 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          obs.disconnect()
        }
      },
      { rootMargin, threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [inView, rootMargin, threshold])

  return { ref, inView }
}

function LazyMount({ minHeight = 420, children }) {
  const { ref, inView } = useInView()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (inView) setMounted(true)
  }, [inView])

  return (
    <div ref={ref}>
      {mounted ? (
        children
      ) : (
        <div style={{ minHeight, background: '#111827', borderRadius: '0.75rem', border: '1px solid #1f2937' }} />
      )}
    </div>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [filters, setFilters] = useState({
    crimeCategory: [],
    months: [],
    zipCodes: [],
    address: '',
    divisions: [],
    years: [],
    dynamic: {}, // key: property name, value: array of selected values
    dynamicText: {} // key: property name, value: substring match
  })
  const [appliedFilters, setAppliedFilters] = useState(null)
  const [filterMetadata, setFilterMetadata] = useState(null) // metadata for advanced filters
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timelineTopN, setTimelineTopN] = useState(12)
  const [activeTab, setActiveTab] = useState('map') // 'map' | 'charts' | 'analysis' | 'courts'
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drilldownFocus, setDrilldownFocus] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const urlOverridesRef = useRef(null)

  const getAllBaseDefaults = () => {
    if (!data || !data.features || data.features.length === 0) return null
    const allCrimeCategories = [...new Set(data.features.map(f => f.properties.CrimeCategory).filter(v => v))].sort()
    const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const allZipCodes = [...new Set(data.features.map(f => f.properties.zip).filter(v => v))].sort()
    const allDivisions = [...new Set(data.features.map(f => f.properties.DIVISION).filter(v => v))].sort()
    const allYears = [...new Set(data.features.map(f => f.properties.YEAR_OCCU).filter(v => v !== null && v !== undefined))].sort()

    return {
      crimeCategory: allCrimeCategories,
      months: allMonths,
      zipCodes: allZipCodes,
      address: '',
      divisions: allDivisions,
      years: allYears,
      dynamic: {},
      dynamicText: {}
    }
  }

  const parseUrlFilters = () => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const raw = sp.get('filters')
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj !== 'object') return null
      return obj
    } catch (e) {
      console.warn('Failed to parse URL filters', e)
      return null
    }
  }

  const applyUrlOverrides = (base, overrides) => {
    if (!base || !overrides || typeof overrides !== 'object') return base

    const next = { ...base }

    const coerceArray = (arr, defaultArr) => {
      if (!Array.isArray(arr)) return defaultArr
      if (!Array.isArray(defaultArr) || defaultArr.length === 0) return arr
      const sample = defaultArr[0]
      const wantNumber = typeof sample === 'number'
      const coerced = arr
        .map((v) => {
          if (wantNumber) {
            if (typeof v === 'number') return v
            const n = Number(v)
            return Number.isFinite(n) ? n : v
          }
          return v === null || v === undefined ? '' : String(v)
        })
      return coerced
        .filter((v) => defaultArr.includes(v))
    }

    if (Array.isArray(overrides.crimeCategory)) next.crimeCategory = coerceArray(overrides.crimeCategory, base.crimeCategory)
    if (Array.isArray(overrides.months)) next.months = coerceArray(overrides.months, base.months)
    if (Array.isArray(overrides.zipCodes)) next.zipCodes = coerceArray(overrides.zipCodes, base.zipCodes)
    if (Array.isArray(overrides.divisions)) next.divisions = coerceArray(overrides.divisions, base.divisions)
    if (Array.isArray(overrides.years)) next.years = coerceArray(overrides.years, base.years)
    if (typeof overrides.address === 'string') next.address = overrides.address

    if (overrides.dynamic && typeof overrides.dynamic === 'object') {
      const dyn = {}
      for (const [k, v] of Object.entries(overrides.dynamic)) {
        if (!k) continue
        if (!Array.isArray(v) || v.length === 0) continue
        dyn[k] = v
          .map((x) => (x === null || x === undefined ? '' : String(x).trim()))
          .filter((x) => x.length > 0)
      }
      next.dynamic = dyn
    }

    if (overrides.dynamicText && typeof overrides.dynamicText === 'object') {
      const dt = {}
      for (const [k, v] of Object.entries(overrides.dynamicText)) {
        const q = (v ?? '').toString().trim()
        if (!k || !q) continue
        dt[k] = q
      }
      next.dynamicText = dt
    }

    return next
  }

  const buildUrlPayload = (current, base) => {
    if (!current || !base) return null

    const payload = {}
    const equalSet = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false
      if (a.length !== b.length) return false
      const sa = new Set(a)
      if (sa.size !== a.length) {
        // duplicates: fall back to string compare
        return JSON.stringify(a) === JSON.stringify(b)
      }
      for (const x of b) if (!sa.has(x)) return false
      return true
    }

    if (!equalSet(current.crimeCategory, base.crimeCategory)) payload.crimeCategory = current.crimeCategory
    if (!equalSet(current.months, base.months)) payload.months = current.months
    if (!equalSet(current.zipCodes, base.zipCodes)) payload.zipCodes = current.zipCodes
    if (!equalSet(current.divisions, base.divisions)) payload.divisions = current.divisions
    if (!equalSet(current.years, base.years)) payload.years = current.years
    if ((current.address || '').toString().trim().length > 0) payload.address = current.address

    const dyn = current.dynamic && typeof current.dynamic === 'object' ? current.dynamic : {}
    const dynPayload = {}
    for (const [k, v] of Object.entries(dyn)) {
      if (!k || !Array.isArray(v) || v.length === 0) continue
      dynPayload[k] = v
    }
    if (Object.keys(dynPayload).length > 0) payload.dynamic = dynPayload

    const dt = current.dynamicText && typeof current.dynamicText === 'object' ? current.dynamicText : {}
    const dtPayload = {}
    for (const [k, v] of Object.entries(dt)) {
      const q = (v ?? '').toString().trim()
      if (!k || !q) continue
      dtPayload[k] = q
    }
    if (Object.keys(dtPayload).length > 0) payload.dynamicText = dtPayload

    return Object.keys(payload).length > 0 ? payload : null
  }

  // Parse URL filter overrides once on mount.
  useEffect(() => {
    urlOverridesRef.current = parseUrlFilters()
    try {
      const sp = new URLSearchParams(window.location.search)
      const rawTop = sp.get('topN')
      if (rawTop) {
        const n = Number(rawTop)
        if (Number.isFinite(n)) setTimelineTopN(Math.max(1, Math.min(50, Math.floor(n))))
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Debounce applying filter changes to keep charts/maps smooth while the user is rapidly clicking.
  useEffect(() => {
    // When filters are first initialized, apply immediately.
    if (appliedFilters === null) {
      setAppliedFilters(filters)
      return
    }
    const t = setTimeout(() => setAppliedFilters(filters), 160)
    return () => clearTimeout(t)
  }, [filters, appliedFilters])

  // Load GeoJSON data chunks using Web Worker for non-blocking parsing
  useEffect(() => {
    // Prevent dev StrictMode double-invocation from doing duplicate work.
    let cancelled = false
    const abort = new AbortController()

    const loadData = async () => {
      try {
        // VITE_DATA_BASE_URL lets the deployed site load data from Cloudflare R2
        // instead of the local public/data/ directory.
        const envBase = import.meta.env.VITE_DATA_BASE_URL
        let dataBaseUrl
        if (envBase) {
          // Ensure trailing slash
          dataBaseUrl = envBase.endsWith('/') ? envBase : `${envBase}/`
        } else {
          const baseUrl = import.meta.env.BASE_URL || '/'
          const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
          dataBaseUrl = `${normalizedBase}data/`
        }

        setError(null)
        setLoadingProgress(10)
        console.log('Fetching GeoJSON data chunks...')

        const allProcessedData = []
        let totalChunksLoaded = 0

        const parseInWorkerPool = (() => {
          const workers = []
          const idle = []
          const pending = new Set()
          const maxWorkers = Math.max(2, Math.min(6, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 4))

          const getWorker = () => {
            let w = idle.pop()
            if (w) return w
            if (workers.length < maxWorkers) {
              w = new Worker(new URL('./workers/jsonParser.worker.js', import.meta.url), { type: 'module' })
              workers.push(w)
              return w
            }
            return null
          }

          const releaseWorker = (w) => {
            idle.push(w)
          }

          const terminateAll = () => {
            for (const w of workers) {
              try { w.terminate() } catch (e) {}
            }
            workers.length = 0
            idle.length = 0
            pending.clear()
          }

          const run = (payload, transferList) => {
            return new Promise((resolve, reject) => {
              const tryStart = () => {
                const w = getWorker()
                if (!w) {
                  // Retry shortly until a worker is free
                  const t = setTimeout(tryStart, 0)
                  pending.add(t)
                  return
                }

                w.onmessage = (e) => {
                  if (e.data.type === 'success') {
                    releaseWorker(w)
                    resolve(e.data.data)
                  } else {
                    releaseWorker(w)
                    reject(new Error(e.data.error))
                  }
                }
                w.onerror = (err) => {
                  releaseWorker(w)
                  reject(err)
                }

                // Transfer buffers to avoid copying/decoding on main thread
                if (Array.isArray(transferList) && transferList.length > 0) {
                  w.postMessage(payload, transferList)
                } else {
                  w.postMessage(payload)
                }
              }

              tryStart()
            })
          }

          return { run, terminateAll }
        })()

        const fetchManifestChunks = async () => {
          try {
            const res = await fetch(`${dataBaseUrl}manifest.json`, { cache: 'force-cache', signal: abort.signal })
            if (!res.ok) return null
            const manifest = await res.json()
            // Extract last-updated timestamp from manifest
            const ts = manifest?.fetchedAt || manifest?.generatedAt || manifest?.updatedAt
            if (ts) {
              const d = new Date(ts)
              if (!isNaN(d)) {
                setLastUpdated(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
              }
            }
            const chunks = Array.isArray(manifest?.chunks) ? manifest.chunks : null
            return chunks && chunks.length > 0 ? chunks : null
          } catch (e) {
            return null
          }
        }

        const parseYearFromName = (name) => {
          const m = /Tucson_Police_Incidents_-_(\d{4})_-_chunk_\d+\.geojson(?:\.gz)?/.exec(name)
          return m ? Number(m[1]) : null
        }

        const chunksFromManifest = await fetchManifestChunks()

        if (cancelled || abort.signal.aborted) {
          return
        }

        // Build the list of chunk URLs.
        let chunkFiles = chunksFromManifest

        // Fallback: legacy fixed chunkCounts if manifest missing
        if (!chunkFiles) {
          console.warn('No manifest.json found; falling back to legacy counts')
          const years = [2021, 2022, 2023, 2024, 2025]
          const chunkCounts = { 2021: 2, 2022: 3, 2023: 3, 2024: 3, 2025: 2 }
          chunkFiles = []
          for (const year of years) {
            const count = chunkCounts[year] || 0
            for (let idx = 0; idx < count; idx++) {
              chunkFiles.push(`Tucson_Police_Incidents_-_${year}_-_chunk_${String(idx).padStart(2, '0')}.geojson`)
            }
          }
        }

        const totalChunks = chunkFiles.length
        const maxConcurrentFetches = 6

        const queue = chunkFiles.map((file) => {
          // Back-compat: if manifest lists .geojson but .gz exists, prefer .gz.
          const prefersGz = !file.endsWith('.gz')
          const url = `${dataBaseUrl}${file}`
          const urlGz = prefersGz ? `${url}.gz` : url
          return {
            file,
            url,
            urlGz,
            year: parseYearFromName(file),
          }
        })

        let cursor = 0
        const runOne = async (task) => {
          // Try gzip first (if applicable), fall back to plain.
          let response = await fetch(task.urlGz, { signal: abort.signal })
          let usedGz = task.urlGz.endsWith('.gz') && response.ok
          if (!response.ok) {
            response = await fetch(task.url, { signal: abort.signal })
            usedGz = false
          }
          if (!response.ok) throw new Error(`Fetch failed: ${task.file}`)
          const buffer = await response.arrayBuffer()
          const chunkData = await parseInWorkerPool.run({ buffer, gzip: usedGz }, [buffer])
          if (cancelled) return
          if (chunkData.features) {
            if (task.year) {
              chunkData.features.forEach(f => {
                if (!f.properties.YEAR_OCCU) f.properties.YEAR_OCCU = task.year
              })
            }
            allProcessedData.push(...chunkData.features)
          }
          totalChunksLoaded++
          const progress = 10 + Math.min(80, (totalChunksLoaded / Math.max(1, totalChunks)) * 80)
          setLoadingProgress(Math.round(progress))
        }

        const workers = new Array(Math.min(maxConcurrentFetches, totalChunks)).fill(null).map(async () => {
          while (true) {
            const idx = cursor++
            if (idx >= queue.length) return
            try {
              await runOne(queue[idx])
            } catch (err) {
              console.error('Chunk load error:', err?.message || err)
            }
          }
        })

        await Promise.all(workers)
        parseInWorkerPool.terminateAll()

        if (cancelled) return

        // Fallback: load single Open_Data files if chunk-based files are unavailable
        if (allProcessedData.length === 0) {
          console.warn('No chunk files found; attempting to load Open_Data files per year')
          const years = [2021, 2022, 2023, 2024, 2025]
          for (const year of years) {
            try {
              const fileName = `Tucson_Police_Incidents_-_${year}_-_Open_Data.geojson`
              const url = `${dataBaseUrl}${fileName}`
              const response = await fetch(url, { signal: abort.signal })
              if (!response.ok) {
                console.warn(`Open_Data not found for ${year}`)
                continue
              }
              const buffer = await response.arrayBuffer()
              const data = await new Promise((resolve, reject) => {
                const worker = new Worker(new URL('./workers/jsonParser.worker.js', import.meta.url), { type: 'module' })
                const timeout = setTimeout(() => {
                  worker.terminate()
                  reject(new Error(`Timeout loading ${fileName}`))
                }, 15000)
                worker.onmessage = (e) => {
                  clearTimeout(timeout)
                  if (e.data.type === 'success') {
                    resolve(e.data.data)
                    worker.terminate()
                  } else {
                    reject(new Error(e.data.error))
                  }
                }
                worker.onerror = (error) => {
                  clearTimeout(timeout)
                  reject(error)
                  worker.terminate()
                }
                worker.postMessage(buffer, [buffer])
              })
              if (cancelled) return
              if (data.features) {
                data.features.forEach(f => {
                  if (!f.properties.YEAR_OCCU) f.properties.YEAR_OCCU = year
                })
                allProcessedData.push(...data.features)
              }
              totalChunksLoaded++
              const progress = 10 + Math.min(80, (totalChunksLoaded / years.length) * 80)
              setLoadingProgress(Math.round(progress))
              console.log(`Loaded Open_Data for ${year}`)
            } catch (err) {
              console.error(`Error loading Open_Data for ${year}:`, err.message)
            }
          }
        }

        console.log(`Successfully loaded ${totalChunksLoaded} chunks. Total features: ${allProcessedData.length}`)
        
        if (allProcessedData.length === 0) {
          throw new Error('No features loaded from any year')
        }
        
        setLoadingProgress(100)
        
        // Create final combined data
        const finalData = {
          type: 'FeatureCollection',
          features: allProcessedData
        }
        
        if (!cancelled) {
          setData(finalData)
          setLoading(false)
        }
        
      } catch (error) {
        console.error('Error loading data:', error)
        if (!cancelled) {
          setError(error.message || 'Could not load incident data.')
          setLoading(false)
        }
      }
    }
    
    loadData()

    return () => {
      cancelled = true
      abort.abort()
    }
  }, [])

  // Initialize filters with all values once data loads
  useEffect(() => {
    if (data && data.features && data.features.length > 0) {
      const allCrimeCategories = [...new Set(data.features.map(f => f.properties.CrimeCategory))].sort()
      const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const allZipCodes = [...new Set(data.features.map(f => f.properties.zip))].sort()
      const allDivisions = [...new Set(data.features.map(f => f.properties.DIVISION))].sort()
      const allYears = [...new Set(data.features.map(f => f.properties.YEAR_OCCU))].sort()
      
      // Build filter metadata in a worker to avoid blocking UI
      const worker = new Worker(new URL('./workers/filterBuilder.worker.js', import.meta.url))
      
      worker.onmessage = (e) => {
        if (e.data.type === 'success') {
          const meta = e.data.data
          setFilterMetadata(meta)
          
          // Initialize filters: keep dynamic empty (user selects from Advanced Filters as needed)
          // This avoids loading thousands of values at startup which causes sluggishness
          const base = {
            crimeCategory: allCrimeCategories,
            months: allMonths,
            zipCodes: allZipCodes,
            address: '',
            divisions: allDivisions,
            years: allYears,
            dynamic: {},
            dynamicText: {}
          }

          const merged = applyUrlOverrides(base, urlOverridesRef.current)
          setFilters(merged)
          setAppliedFilters(merged)
          worker.terminate()
        } else {
          console.error('Filter metadata error:', e.data.error)
          const base = {
            crimeCategory: allCrimeCategories,
            months: allMonths,
            zipCodes: allZipCodes,
            address: '',
            divisions: allDivisions,
            years: allYears,
            dynamic: {},
            dynamicText: {}
          }
          const merged = applyUrlOverrides(base, urlOverridesRef.current)
          setFilters(merged)
          setAppliedFilters(merged)
          worker.terminate()
        }
      }
      
      worker.onerror = (err) => {
        console.error('Filter worker error:', err)
        const base = {
          crimeCategory: allCrimeCategories,
          months: allMonths,
          zipCodes: allZipCodes,
          address: '',
          divisions: allDivisions,
          years: allYears,
          dynamic: {},
          dynamicText: {}
        }
        const merged = applyUrlOverrides(base, urlOverridesRef.current)
        setFilters(merged)
        setAppliedFilters(merged)
        worker.terminate()
      }
      
      // Send data to worker
      worker.postMessage(data)
    }
  }, [data])

  // Keep the URL in sync with current filters (store only non-defaults).
  useEffect(() => {
    if (!data || !data.features || data.features.length === 0) return
    const base = getAllBaseDefaults()
    if (!base) return

    const t = setTimeout(() => {
      const payload = buildUrlPayload(filters, base)
      const sp = new URLSearchParams(window.location.search)
      if (!payload) {
        sp.delete('filters')
      } else {
        sp.set('filters', JSON.stringify(payload))
      }

      const n = Math.max(1, Math.min(50, Number(timelineTopN) || 12))
      if (n === 12) sp.delete('topN')
      else sp.set('topN', String(n))

      const qs = sp.toString()
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
      window.history.replaceState({}, '', nextUrl)
    }, 350)

    return () => clearTimeout(t)
  }, [filters, data, timelineTopN])

  const handleFieldTimelineSeriesClick = (fieldKey, seriesLabel) => {
    const label = (seriesLabel ?? '').toString().trim()
    if (!fieldKey || !label) return
    if (label === 'Other' || label === 'Unknown') return

    setDrilldownFocus({ key: fieldKey, ts: Date.now() })

    setFilters((prev) => {
      if (!prev) return prev
      const base = getAllBaseDefaults()
      if (!base) return prev

      // Prefer base filter for CrimeCategory so the main filter UI stays in sync.
      if (fieldKey === 'CrimeCategory') {
        const isAlreadySingle = Array.isArray(prev.crimeCategory) && prev.crimeCategory.length === 1 && prev.crimeCategory[0] === label
        return {
          ...prev,
          crimeCategory: isAlreadySingle ? base.crimeCategory : [label],
        }
      }

      const dyn = prev.dynamic && typeof prev.dynamic === 'object' ? prev.dynamic : {}
      const current = Array.isArray(dyn[fieldKey]) ? dyn[fieldKey] : null
      const nextDynamic = { ...dyn }
      const isAlreadySingle = current && current.length === 1 && current[0] === label
      if (isAlreadySingle) {
        delete nextDynamic[fieldKey]
      } else {
        nextDynamic[fieldKey] = [label]
      }

      return { ...prev, dynamic: nextDynamic }
    })
  }

  // Filter data based on user selections
  const filteredData = useMemo(() => {
    if (!data || !data.features) return { features: [] }
    if (!appliedFilters) return { ...data, features: data.features }
    
    // Get all possible values to detect if "all" are selected
    const allCrimeCategories = [...new Set(data.features.map(f => f.properties.CrimeCategory))].sort()
    const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const allZipCodes = [...new Set(data.features.map(f => f.properties.zip))].sort()
    const allDivisions = [...new Set(data.features.map(f => f.properties.DIVISION))].sort()
    const allYears = [...new Set(data.features.map(f => f.properties.YEAR_OCCU))].sort()
    
    return {
      ...data,
      features: data.features.filter(feature => {
        const props = feature.properties
        
        // Crime category filter - only apply if not all selected
        if (appliedFilters.crimeCategory.length > 0 && 
            appliedFilters.crimeCategory.length < allCrimeCategories.length && 
            !appliedFilters.crimeCategory.includes(props.CrimeCategory)) {
          return false
        }
        
        // Month filter - only apply if not all selected
        if (appliedFilters.months.length > 0 && 
            appliedFilters.months.length < allMonths.length && 
            !appliedFilters.months.includes(props.MONTH_OCCU_String)) {
          return false
        }
        
        // Zip code filter - only apply if not all selected
        if (appliedFilters.zipCodes.length > 0 && 
            appliedFilters.zipCodes.length < allZipCodes.length && 
            !appliedFilters.zipCodes.includes(props.zip)) {
          return false
        }
        
        // Address filter
        if (appliedFilters.address && !props.ADDRESS_PUBLIC.toLowerCase().includes(appliedFilters.address.toLowerCase())) {
          return false
        }
        
        // Division filter - only apply if not all selected
        if (appliedFilters.divisions.length > 0 && 
            appliedFilters.divisions.length < allDivisions.length && 
            !appliedFilters.divisions.includes(props.DIVISION)) {
          return false
        }
        
        // Year filter - only apply if not all selected
        if (appliedFilters.years.length > 0 && 
            appliedFilters.years.length < allYears.length && 
            !appliedFilters.years.includes(props.YEAR_OCCU)) {
          return false
        }

        const fullProps = (props && typeof props === 'object' && props._full && typeof props._full === 'object')
          ? props._full
          : props

        // Dynamic checkbox filters: apply if user selected one or more specific values.
        // Match base filter semantics: if "all" values are selected for a field, treat it as not filtering.
        if (appliedFilters.dynamic && typeof appliedFilters.dynamic === 'object') {
          for (const [key, selected] of Object.entries(appliedFilters.dynamic)) {
            if (Array.isArray(selected) && selected.length > 0) {
              const meta = filterMetadata?.[key]
              if (meta && Number.isFinite(meta.totalUnique) && selected.length >= meta.totalUnique) {
                continue
              }
              const val = fullProps?.[key]
              const norm = val === null || val === undefined ? '' : String(val).trim()
              if (!selected.includes(norm)) {
                return false
              }
            }
          }
        }

        // Dynamic text filters: substring match (case-insensitive)
        if (appliedFilters.dynamicText && typeof appliedFilters.dynamicText === 'object') {
          for (const [key, text] of Object.entries(appliedFilters.dynamicText)) {
            const q = (text ?? '').toString().trim()
            if (!q) continue
            const val = fullProps?.[key]
            const norm = val === null || val === undefined ? '' : String(val)
            if (!norm.toLowerCase().includes(q.toLowerCase())) {
              return false
            }
          }
        }
        
        return true
      })
    }
  }, [data, appliedFilters, filterMetadata])

  const fieldTimelineSeries = useMemo(() => {
    const features = filteredData?.features || []
    if (!features.length) {
      return { labels: [], byField: {} }
    }

    const FIELDS = [
      { key: 'CrimeCategory', label: 'Crime Category' },
      { key: 'CrimeType', label: 'Crime Type' },
      { key: 'UCRSummaryDesc', label: 'UCR Summary' },
      { key: 'STATUTDESC', label: 'Statute Description' },
      { key: 'WEAPON1DESC', label: 'Weapon 1' },
      { key: 'WEAPON2DESC', label: 'Weapon 2' },
    ]

    const ymSet = new Set()
    const totalsByField = {}
    for (const f of FIELDS) totalsByField[f.key] = new Map()

    const getProps = (feature) => {
      const p = feature?.properties
      if (p && typeof p === 'object' && p._full && typeof p._full === 'object') return p._full
      return p || {}
    }

    // Pass 1: totals per field/value and collect year-month labels.
    for (let i = 0; i < features.length; i++) {
      const props = getProps(features[i])
      const month = props.MONTH_OCCU_String
      const year = props.YEAR_OCCU
      const mm = MONTH_TO_NUM[month]
      if (!mm || !year) continue
      const ym = `${year}-${mm}`
      ymSet.add(ym)

      for (let k = 0; k < FIELDS.length; k++) {
        const key = FIELDS[k].key
        const v = props[key]
        const val = v === null || v === undefined || String(v).trim().length === 0 ? 'Unknown' : String(v).trim()
        const map = totalsByField[key]
        map.set(val, (map.get(val) || 0) + 1)
      }
    }

    const labels = Array.from(ymSet).sort()
    const labelIndex = new Map()
    for (let i = 0; i < labels.length; i++) labelIndex.set(labels[i], i)

    const TOP_N = Math.max(1, Math.min(50, Number(timelineTopN) || 12))
    const byField = {}

    // Decide top values per field
    const topInfo = {}
    for (const f of FIELDS) {
      const entries = Array.from(totalsByField[f.key].entries()).sort((a, b) => b[1] - a[1])
      const top = entries.slice(0, TOP_N).map(([value]) => value)
      const topSet = new Set(top)
      topInfo[f.key] = { top, topSet }

      const series = []
      for (let i = 0; i < top.length; i++) {
        series.push({ label: top[i], data: new Array(labels.length).fill(0) })
      }
      series.push({ label: 'Other', data: new Array(labels.length).fill(0) })
      byField[f.key] = { label: f.label, series, top, totalIncidents: features.length }
    }

    // Pass 2: fill arrays for top values and Other.
    for (let i = 0; i < features.length; i++) {
      const props = getProps(features[i])
      const month = props.MONTH_OCCU_String
      const year = props.YEAR_OCCU
      const mm = MONTH_TO_NUM[month]
      if (!mm || !year) continue
      const ym = `${year}-${mm}`
      const idx = labelIndex.get(ym)
      if (idx === undefined) continue

      for (let k = 0; k < FIELDS.length; k++) {
        const key = FIELDS[k].key
        const v = props[key]
        const val = v === null || v === undefined || String(v).trim().length === 0 ? 'Unknown' : String(v).trim()
        const info = topInfo[key]
        const field = byField[key]
        if (!field) continue

        if (info.topSet.has(val)) {
          const pos = info.top.indexOf(val)
          if (pos >= 0) field.series[pos].data[idx] += 1
          else field.series[field.series.length - 1].data[idx] += 1
        } else {
          field.series[field.series.length - 1].data[idx] += 1
        }
      }
    }

    // Drop Other if empty
    for (const f of FIELDS) {
      const field = byField[f.key]
      if (!field) continue
      const other = field.series[field.series.length - 1]
      const otherSum = other.data.reduce((a, b) => a + b, 0)
      if (otherSum === 0) field.series.pop()
    }

    return { labels, byField }
  }, [filteredData, timelineTopN])

  // Summary stats for Filters header (for UX and light performance)
  const summaryStats = useMemo(() => {
    const totalIncidents = data?.features ? data.features.length : 0
    const filteredIncidents = filteredData?.features ? filteredData.features.length : 0
    const totalCrimeCategories = data?.features ? new Set(data.features.map(f => f.properties.CrimeCategory)).size : 0
    const filteredCrimeCategories = filteredData?.features ? new Set(filteredData.features.map(f => f.properties.CrimeCategory)).size : 0
    const totalZips = data?.features ? new Set(data.features.map(f => f.properties.zip)).size : 0
    const filteredZips = filteredData?.features ? new Set(filteredData.features.map(f => f.properties.zip)).size : 0
    const totalDivisions = data?.features ? new Set(data.features.map(f => f.properties.DIVISION)).size : 0
    const filteredDivisions = filteredData?.features ? new Set(filteredData.features.map(f => f.properties.DIVISION)).size : 0
    return {
      totalIncidents,
      filteredIncidents,
      totalCrimeCategories,
      filteredCrimeCategories,
      totalZips,
      filteredZips,
      totalDivisions,
      filteredDivisions,
    }
  }, [data, filteredData])

  const clearAllFilters = () => {
    if (!data || !data.features || data.features.length === 0) return
    const allCrimeCategories = [...new Set(data.features.map(f => f.properties.CrimeCategory).filter(v => v))].sort()
    const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const allZipCodes = [...new Set(data.features.map(f => f.properties.zip).filter(v => v))].sort()
    const allDivisions = [...new Set(data.features.map(f => f.properties.DIVISION).filter(v => v))].sort()
    const allYears = [...new Set(data.features.map(f => f.properties.YEAR_OCCU).filter(v => v))].sort()

    const next = {
      crimeCategory: allCrimeCategories,
      months: allMonths,
      zipCodes: allZipCodes,
      address: '',
      divisions: allDivisions,
      years: allYears,
      dynamic: {},
      dynamicText: {}
    }
    setFilters(next)
    setAppliedFilters(next)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0f1e' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'inline-block',
              width: '52px', height: '52px',
              border: '3px solid #1f2937',
              borderTopColor: '#06b6d4',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '0.5rem' }}>
            Loading Incident Data
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Processing 500,000+ incidents with Web Workers…
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              <span style={{ color: '#6b7280' }}>Progress</span>
              <span style={{ color: '#06b6d4', fontWeight: 600 }}>{Math.round(loadingProgress)}%</span>
            </div>
            <div style={{ height: '4px', background: '#1f2937', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(loadingProgress)}%`,
                background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
                borderRadius: '2px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          <p style={{ color: '#374151', fontSize: '0.75rem' }}>
            Using parallel Web Workers for non-blocking parsing
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !data || !data.features || data.features.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0f1e' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px', padding: '2rem' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>
            Error Loading Data
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error || 'Could not load incident data.'}
          </p>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '0.5rem', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
            <p style={{ fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Troubleshooting:</p>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
              <li>Open DevTools (F12) → Console tab</li>
              <li>Verify public/data/manifest.json exists</li>
              <li>Verify public/data/ contains .geojson.gz files</li>
              <li>Try a hard refresh (Ctrl+Shift+R)</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#06b6d4',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Dark panel placeholder for lazy loaded components
  const DarkFallback = ({ minHeight = 420 }) => (
    <div style={{ minHeight, background: '#111827', borderRadius: '0.75rem', border: '1px solid #1f2937' }} />
  )

  return (
    <div className="app-shell">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalIncidents={summaryStats.totalIncidents}
        filteredIncidents={summaryStats.filteredIncidents}
        lastUpdated={lastUpdated}
        loading={loading}
      />

      <div className="app-main">
        {/* Filter Sidebar */}
        {sidebarOpen && activeTab !== 'courts' && (
          <aside
            className="filter-sidebar"
            style={{ padding: '1rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f9fafb' }}>Filters</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={clearAllFilters}
                  style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem' }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem' }}
                  title="Close sidebar"
                >
                  ✕
                </button>
              </div>
            </div>
            <Filters
              data={data}
              visibleData={filteredData}
              filters={filters}
              setFilters={setFilters}
              filterMetadata={filterMetadata}
              summaryStats={summaryStats}
              drilldownFocus={drilldownFocus}
            />
          </aside>
        )}

        {/* Main content */}
        <div className="app-content">
          {/* Re-open sidebar button when closed */}
          {!sidebarOpen && activeTab !== 'courts' && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                marginBottom: '1rem',
                padding: '0.375rem 0.875rem',
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: '0.5rem',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              ☰ Show Filters
            </button>
          )}

          {/* KPI metrics row — always visible (except courts tab) */}
          {activeTab !== 'courts' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <MetricsDashboard
                totalIncidents={summaryStats.totalIncidents}
                filteredIncidents={summaryStats.filteredIncidents}
                crimeCategories={summaryStats.filteredCrimeCategories}
                divisions={summaryStats.filteredDivisions}
                onClearFilters={clearAllFilters}
              />
            </div>
          )}

          {/* ── MAP TAB ── */}
          {activeTab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <LazyMount minHeight={560}>
                <Suspense fallback={<DarkFallback minHeight={560} />}>
                  <MapComponent data={filteredData} />
                </Suspense>
              </LazyMount>
            </div>
          )}

          {/* ── CHARTS TAB ── */}
          {activeTab === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <CollapsibleSection title="Incidents by Crime Category" defaultOpen={true}>
                <LazyMount minHeight={420}>
                  <Suspense fallback={<DarkFallback />}>
                    <TimelineChart data={filteredData} />
                  </Suspense>
                </LazyMount>
              </CollapsibleSection>

              <CollapsibleSection title="Incident Volume Over Time (2021–2025)" defaultOpen={true}>
                <LazyMount minHeight={420}>
                  <Suspense fallback={<DarkFallback />}>
                    <TimelineVolumeChart data={filteredData} />
                  </Suspense>
                </LazyMount>
              </CollapsibleSection>

              <CollapsibleSection title="Timeline Charts (Selected Fields)" defaultOpen={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Top values</span>
                    <select
                      style={{ background: '#111827', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f9fafb', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                      value={timelineTopN}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) setTimelineTopN(n)
                      }}
                    >
                      {[5, 10, 12, 15, 20].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  {[
                    { key: 'CrimeCategory', title: 'Crime Category Over Time' },
                    { key: 'CrimeType', title: 'Crime Type Over Time' },
                    { key: 'UCRSummaryDesc', title: 'UCR Summary Over Time' },
                    { key: 'STATUTDESC', title: 'Statute / Offense Over Time' },
                    { key: 'WEAPON1DESC', title: 'Primary Weapon Over Time' },
                    { key: 'WEAPON2DESC', title: 'Secondary Weapon Over Time' },
                  ].map((cfg) => {
                    const f = fieldTimelineSeries.byField?.[cfg.key]
                    return (
                      <CollapsibleSection key={cfg.key} title={cfg.title} defaultOpen={false}>
                        <LazyMount minHeight={560}>
                          <Suspense fallback={<DarkFallback minHeight={560} />}>
                            <FieldTimelineChart
                              fieldKey={cfg.key}
                              title={f?.label || cfg.title}
                              labels={fieldTimelineSeries.labels}
                              series={f?.series || []}
                              totalIncidents={filteredData?.features?.length || 0}
                              onSeriesClick={handleFieldTimelineSeriesClick}
                            />
                          </Suspense>
                        </LazyMount>
                      </CollapsibleSection>
                    )
                  })}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* ── ANALYSIS TAB ── */}
          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <LazyMount minHeight={520}>
                <Suspense fallback={<DarkFallback minHeight={520} />}>
                  <DetailedAnalysis data={filteredData} filterMetadata={filterMetadata} />
                </Suspense>
              </LazyMount>
            </div>
          )}

          {/* ── COURTS TAB ── */}
          {activeTab === 'courts' && (
            <LazyMount minHeight={520}>
              <Suspense fallback={<DarkFallback minHeight={520} />}>
                <TranscriptViewer />
              </Suspense>
            </LazyMount>
          )}

          {/* Footer */}
          <footer style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #1f2937', fontSize: '0.75rem', color: '#4b5563' }}>
            Data source:{' '}
            <a
              href="https://data-cotgis.opendata.arcgis.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#06b6d4' }}
            >
              City of Tucson Open Data
            </a>
            {' '}· Analytics based on publicly available incident records.
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
