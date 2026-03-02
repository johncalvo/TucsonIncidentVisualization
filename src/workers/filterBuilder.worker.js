// Web Worker: Builds filter metadata from all features without blocking UI
self.onmessage = (e) => {
  try {
    const data = e.data
    if (!data || !data.features) {
      self.postMessage({ type: 'error', error: 'No features' })
      return
    }

    // Enumerate ALL keys present in the dataset. Keep a stable preferred ordering.
    const PREFERRED_KEYS = [
      'X',
      'Y',
      'INCI_ID',
      'agency',
      'ADDRESS_PUBLIC',
      'DATE_REPT',
      'HOUR_REPT',
      'DATETIME_REPT',
      'MONTH_REPT',
      'YEAR_REPT',
      'DOW_REPT',
      'TIME_REPT',
      'DATETIME_OCCU',
      'HOUR_OCCU',
      'city',
      'state',
      'zip',
      'NEIGHBORHD',
      'UCRsummary',
      'UCRSummaryDesc',
      'OFFENSE',
      'STATUTDESC',
      'WEAPON1DESC',
      'WEAPON2DESC',
      'WARD',
      'NHA_NAME',
      'DIVISION',
      'DIVISION_NO',
      'DIVSECT',
      'TRSQ',
      'City_geo',
    ]

    // To avoid runaway memory usage, cap tracked distinct values per key.
    // When the cap is exceeded, we stop tracking new distinct values for that key (but keep counting known ones).
    const MAX_TRACKED_VALUES = 5000

    const filterMetadata = {}

    // Single pass: discover keys and collect value frequencies.
    for (let i = 0; i < data.features.length; i++) {
      const p = data.features[i]?.properties || {}
      const props = (p && typeof p === 'object' && p._full && typeof p._full === 'object') ? p._full : p
      if (!props || typeof props !== 'object') continue

      const keys = Object.keys(props)
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const key = keys[kIdx]
        if (!key || key === '_full') continue

        const v = props[key]
        const val = v === null || v === undefined ? '' : String(v).trim()
        if (val.length === 0) continue

        let meta = filterMetadata[key]
        if (!meta) {
          meta = { valueCounts: new Map(), totalNonEmpty: 0, capped: false }
          filterMetadata[key] = meta
        }

        meta.totalNonEmpty++

        const prev = meta.valueCounts.get(val)
        if (prev !== undefined) {
          meta.valueCounts.set(val, prev + 1)
        } else {
          if (meta.valueCounts.size >= MAX_TRACKED_VALUES) {
            meta.capped = true
            continue
          }
          meta.valueCounts.set(val, 1)
        }
      }
    }

    // Convert to serializable format.
    // For very high-cardinality fields, do not send the full unique list.
    const TOP_N = 60
    const MAX_ALL_VALUES = 250

    const presentKeys = Object.keys(filterMetadata)
    const presentSet = new Set(presentKeys)
    const orderedKeys = [
      ...PREFERRED_KEYS.filter((k) => presentSet.has(k)),
      ...presentKeys.filter((k) => !PREFERRED_KEYS.includes(k)).sort(),
    ]

    const result = {}
    for (const key of orderedKeys) {
      const meta = filterMetadata[key]
      const sorted = Array.from(meta.valueCounts.entries())
        .filter(([val]) => val && val.length > 0)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)

      const topValues = sorted.slice(0, TOP_N)
      const totalUnique = meta.capped ? null : meta.valueCounts.size
      const includeAll = !meta.capped && totalUnique > 0 && totalUnique <= MAX_ALL_VALUES

      result[key] = {
        totalUnique,
        totalNonEmpty: meta.totalNonEmpty,
        topValues,
        allValues: includeAll ? sorted : undefined,
        truncated: meta.capped || !includeAll,
      }
    }

    self.postMessage({ type: 'success', data: result, orderedKeys })
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message })
  }
}
