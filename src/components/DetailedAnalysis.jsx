import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_TO_NUM = MONTH_ORDER.reduce((acc, month, idx) => {
  acc[month] = String(idx + 1).padStart(2, '0')
  return acc
}, {})

function getStringProp(props, key) {
  const v = props?.[key]
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s
}

function DetailedAnalysis({ data, filterMetadata }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subcategoryField, setSubcategoryField] = useState('CrimeType')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [locationDimension, setLocationDimension] = useState('zip') // zip | DIVISION | NEIGHBORHD

  const subcategoryFields = useMemo(() => {
    const preferred = [
      { key: 'CrimeType', label: 'Crime Type' },
      { key: 'Crime', label: 'Crime' },
      { key: 'OFFENSE', label: 'Offense' },
      { key: 'UCRSummaryDesc', label: 'UCR Summary' },
    ]

    const available = new Set(Object.keys(filterMetadata || {}))
    const out = preferred.filter((f) => available.has(f.key) || f.key === 'CrimeType' || f.key === 'Crime')

    // If we don't have metadata (or it’s missing keys), fall back to the preferred list.
    return out.length > 0 ? out : preferred
  }, [filterMetadata])

  // One-time index per visible (already globally filtered) dataset.
  const base = useMemo(() => {
    const features = data?.features || []
    const categoryCounts = new Map()
    const categoryToIndices = new Map()
    const addressSet = new Set()
    const neighborhoodSet = new Set()

    for (let i = 0; i < features.length; i++) {
      const props = features[i]?.properties
      if (!props) continue

      const category = getStringProp(props, 'CrimeCategory') || 'Unknown'
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)

      let indices = categoryToIndices.get(category)
      if (!indices) {
        indices = []
        categoryToIndices.set(category, indices)
      }
      indices.push(i)

      const addr = getStringProp(props, 'ADDRESS_PUBLIC')
      if (addr) addressSet.add(addr)

      const n = getStringProp(props, 'NEIGHBORHD')
      if (n) neighborhoodSet.add(n)
    }

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))

    return {
      features,
      categories: sortedCategories,
      categoryCount: categoryCounts.size,
      uniqueLocations: addressSet.size,
      uniqueNeighborhoods: neighborhoodSet.size,
      categoryToIndices,
    }
  }, [data])

  // Cache expensive per-selection computations (cleared whenever the dataset changes).
  const cacheRef = useRef({
    datasetKey: 0,
    subcatsByCategoryAndField: new Map(),
    selectionAgg: new Map(),
  })

  useEffect(() => {
    cacheRef.current.datasetKey++
    cacheRef.current.subcatsByCategoryAndField = new Map()
    cacheRef.current.selectionAgg = new Map()
  }, [base.features])

  const selectedCategoryIndices = useMemo(() => {
    if (!selectedCategory) return []
    return base.categoryToIndices.get(selectedCategory) || []
  }, [base.categoryToIndices, selectedCategory])

  const subcategories = useMemo(() => {
    if (!selectedCategory) return []
    const cacheKey = `${cacheRef.current.datasetKey}::${selectedCategory}::${subcategoryField}`
    const cached = cacheRef.current.subcatsByCategoryAndField.get(cacheKey)
    if (cached) return cached

    const counts = new Map()
    const features = base.features
    const indices = selectedCategoryIndices

    for (let j = 0; j < indices.length; j++) {
      const props = features[indices[j]]?.properties
      if (!props) continue
      const sub = getStringProp(props, subcategoryField) || 'Unknown'
      counts.set(sub, (counts.get(sub) || 0) + 1)
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))

    cacheRef.current.subcatsByCategoryAndField.set(cacheKey, sorted)
    return sorted
  }, [base.features, selectedCategory, selectedCategoryIndices, subcategoryField])

  const selectionAgg = useMemo(() => {
    if (!selectedCategory || !selectedSubcategory) {
      return {
        totalInSelectedCategory: selectedCategoryIndices.length,
        totalInSelectedCatAndSub: 0,
        trend: [],
        locations: [],
      }
    }

    const cacheKey = `${cacheRef.current.datasetKey}::${selectedCategory}::${subcategoryField}::${selectedSubcategory}::${locationDimension}`
    const cached = cacheRef.current.selectionAgg.get(cacheKey)
    if (cached) return cached

    const trendByYearMonth = new Map()
    const locationCounts = new Map()
    const features = base.features
    const indices = selectedCategoryIndices
    let totalInSelectedCatAndSub = 0

    for (let j = 0; j < indices.length; j++) {
      const props = features[indices[j]]?.properties
      if (!props) continue

      const sub = getStringProp(props, subcategoryField) || 'Unknown'
      if (sub !== selectedSubcategory) continue

      totalInSelectedCatAndSub++

      const locKey = locationDimension === 'DIVISION'
        ? (getStringProp(props, 'DIVISION') || 'Unknown')
        : locationDimension === 'NEIGHBORHD'
          ? (getStringProp(props, 'NEIGHBORHD') || 'Unknown')
          : (getStringProp(props, 'zip') || 'Unknown')
      locationCounts.set(locKey, (locationCounts.get(locKey) || 0) + 1)

      const year = props.YEAR_OCCU
      const monthStr = getStringProp(props, 'MONTH_OCCU_String')
      const monthNum = MONTH_TO_NUM[monthStr]
      if (year && monthNum) {
        const ym = `${year}-${monthNum}`
        trendByYearMonth.set(ym, (trendByYearMonth.get(ym) || 0) + 1)
      }
    }

    const trend = Array.from(trendByYearMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([yearMonth, count]) => ({ yearMonth, count }))

    const locations = Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))

    const out = {
      totalInSelectedCategory: selectedCategoryIndices.length,
      totalInSelectedCatAndSub,
      trend,
      locations,
    }

    cacheRef.current.selectionAgg.set(cacheKey, out)
    return out
  }, [base.features, locationDimension, selectedCategory, selectedCategoryIndices, selectedSubcategory, subcategoryField])

  const aggregates = useMemo(() => {
    return {
      totalIncidents: base.features.length,
      uniqueLocations: base.uniqueLocations,
      uniqueNeighborhoods: base.uniqueNeighborhoods,
      categoryCount: base.categoryCount,
      categories: base.categories,
      totalInSelectedCategory: selectedCategory ? selectedCategoryIndices.length : 0,
      subcategories,
      totalInSelectedCatAndSub: selectionAgg.totalInSelectedCatAndSub,
      locations: selectionAgg.locations,
      trend: selectionAgg.trend,
    }
  }, [base, selectedCategory, selectedCategoryIndices, selectionAgg, subcategories])

  // Default the selected category to the largest bucket.
  useEffect(() => {
    if (selectedCategory) return
    const top = aggregates.categories?.[0]?.value
    if (top) setSelectedCategory(top)
  }, [aggregates.categories, selectedCategory])

  // If the subcategory field changes, clear the selected subcategory.
  useEffect(() => {
    setSelectedSubcategory('')
  }, [subcategoryField])

  // If the selected category changes, clear subcategory (it’s category-specific).
  useEffect(() => {
    setSelectedSubcategory('')
  }, [selectedCategory])

  const topCategory = aggregates.categories?.[0]?.value || 'N/A'

  const subcategoryShare = useMemo(() => {
    if (!selectedCategory) return { labels: [], pct: [], raw: [] }
    const rows = aggregates.subcategories || []
    const total = aggregates.totalInSelectedCategory || 0
    if (total <= 0 || rows.length === 0) return { labels: [], pct: [], raw: [] }

    const TOP_N = 12
    const top = rows.slice(0, TOP_N)
    const otherCount = rows.slice(TOP_N).reduce((sum, r) => sum + r.count, 0)

    const combined = otherCount > 0 ? [...top, { value: 'Other', count: otherCount }] : top
    return {
      labels: combined.map(r => (r.value.length > 42 ? `${r.value.slice(0, 42)}…` : r.value)),
      pct: combined.map(r => Math.round((r.count / total) * 1000) / 10),
      raw: combined.map(r => r.count),
    }
  }, [aggregates.subcategories, aggregates.totalInSelectedCategory, selectedCategory])

  const shareChart = useMemo(() => {
    return {
      labels: subcategoryShare.labels,
      datasets: [
        {
          label: 'Percent of Category',
          data: subcategoryShare.pct,
          backgroundColor: 'rgba(6, 182, 212, 0.5)',
          borderColor: 'rgba(6, 182, 212, 0.9)',
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    }
  }, [subcategoryShare.labels, subcategoryShare.pct])

  const DARK_SCALE = {
    grid: { color: 'rgba(255,255,255,0.06)' },
    ticks: { color: '#9ca3af' },
    title: { color: '#9ca3af' },
  }
  const DARK_TOOLTIP = {
    backgroundColor: '#1f2937',
    titleColor: '#f9fafb',
    bodyColor: '#9ca3af',
    borderColor: '#374151',
    borderWidth: 1,
  }

  const shareOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...DARK_TOOLTIP,
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex
            const pct = ctx.parsed.x
            const raw = subcategoryShare.raw[idx]
            return ` ${pct}% (${(raw || 0).toLocaleString()} incidents)`
          },
        },
      },
    },
    scales: {
      x: {
        ...DARK_SCALE,
        beginAtZero: true,
        suggestedMax: 100,
        ticks: { ...DARK_SCALE.ticks, callback: (v) => `${v}%` },
      },
      y: {
        ...DARK_SCALE,
        ticks: { ...DARK_SCALE.ticks, autoSkip: false },
      },
    },
  }), [subcategoryShare.raw])

  const trendChart = useMemo(() => {
    const labels = aggregates.trend.map(r => r.yearMonth)
    const counts = aggregates.trend.map(r => r.count)
    return {
      labels,
      datasets: [
        {
          label: 'Incidents',
          data: counts,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }
  }, [aggregates.trend])

  const trendOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...DARK_TOOLTIP,
        callbacks: {
          label: (ctx) => ` ${formatNumber(ctx.parsed?.y ?? 0)} incidents`,
        },
      },
    },
    scales: {
      x: { ...DARK_SCALE, ticks: { ...DARK_SCALE.ticks, maxTicksLimit: 12 } },
      y: { ...DARK_SCALE, beginAtZero: true, ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) } },
    },
  }), [])

  const locationsChart = useMemo(() => {
    const TOP_N = 15
    const top = aggregates.locations.slice(0, TOP_N)
    return {
      labels: top.map(r => (r.value.length > 32 ? `${r.value.slice(0, 32)}…` : r.value)),
      datasets: [
        {
          label: 'Incidents',
          data: top.map(r => r.count),
          backgroundColor: 'rgba(167, 139, 250, 0.55)',
          borderColor: 'rgba(167, 139, 250, 0.9)',
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    }
  }, [aggregates.locations])

  const locationsOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...DARK_TOOLTIP,
        callbacks: {
          label: (ctx) => ` ${formatNumber(ctx.parsed?.x ?? 0)} incidents`,
        },
      },
    },
    scales: {
      x: { ...DARK_SCALE, beginAtZero: true, ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) } },
      y: { ...DARK_SCALE, ticks: { ...DARK_SCALE.ticks, autoSkip: false } },
    },
  }), [])

  const selectStyle = {
    width: '100%', padding: '0.4375rem 0.625rem',
    background: '#0d1117', border: '1px solid #374151',
    borderRadius: '0.375rem', color: '#f9fafb', fontSize: '0.8125rem',
    outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const chartCardStyle = { background: '#0d1117', border: '1px solid #1f2937', borderRadius: '0.5rem', padding: '1rem' }
  const chartHeaderStyle = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }
  const emptyStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4b5563', fontSize: '0.875rem' }

  const statCards = [
    { label: 'Incidents in Selection', value: aggregates.totalIncidents, color: '#06b6d4' },
    { label: 'Unique Locations', value: aggregates.uniqueLocations, color: '#22c55e' },
    { label: 'Neighborhoods', value: aggregates.uniqueNeighborhoods, color: '#a78bfa' },
    { label: 'Crime Categories', value: aggregates.categoryCount, color: '#f97316' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f9fafb' }}>Detailed Analysis</h2>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Drill into category → subcategory share, trend, and location breakdown.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedCategory(topCategory === 'N/A' ? '' : topCategory)
            setSelectedSubcategory('')
            setSubcategoryField('CrimeType')
            setLocationDimension('zip')
          }}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: 'transparent', border: '1px solid #374151', borderRadius: '0.375rem', color: '#9ca3af', cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Category</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={selectStyle}>
            {aggregates.categories.map((c) => (
              <option key={c.value} value={c.value}>{c.value} ({c.count.toLocaleString()})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Subcategory Field</label>
          <select value={subcategoryField} onChange={(e) => setSubcategoryField(e.target.value)} style={selectStyle}>
            {subcategoryFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Subcategory</label>
          <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} style={selectStyle}>
            <option value="">All Subcategories</option>
            {aggregates.subcategories.slice(0, 100).map((s) => (
              <option key={s.value} value={s.value}>{s.value} ({s.count.toLocaleString()})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Location Dimension</label>
          <select value={locationDimension} onChange={(e) => setLocationDimension(e.target.value)} style={selectStyle}>
            <option value="zip">Zip Code</option>
            <option value="DIVISION">Division</option>
            <option value="NEIGHBORHD">Neighborhood</option>
          </select>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9fafb' }}>Subcategory Share</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {selectedCategory || '—'} · {aggregates.totalInSelectedCategory.toLocaleString()} incidents
            </span>
          </div>
          <div style={{ height: '420px' }}>
            {shareChart.labels.length > 0 ? (
              <Bar data={shareChart} options={shareOptions} />
            ) : (
              <div style={emptyStyle}>No subcategory data available.</div>
            )}
          </div>
        </div>

        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9fafb' }}>Trend Over Time</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {selectedSubcategory ? `${selectedCategory} → ${selectedSubcategory}` : 'Select a subcategory'}
            </span>
          </div>
          <div style={{ height: '420px' }}>
            {selectedSubcategory && trendChart.labels.length > 0 ? (
              <Line data={trendChart} options={trendOptions} />
            ) : (
              <div style={emptyStyle}>Pick a subcategory to see the monthly trend.</div>
            )}
          </div>
        </div>

        <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
          <div style={chartHeaderStyle}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9fafb' }}>Location Breakdown</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {selectedSubcategory ? `Top ${locationDimension === 'zip' ? 'zip codes' : locationDimension === 'DIVISION' ? 'divisions' : 'neighborhoods'} for selection` : 'Select a subcategory'}
            </span>
          </div>
          <div style={{ height: '520px' }}>
            {selectedSubcategory && locationsChart.labels.length > 0 ? (
              <Bar data={locationsChart} options={locationsOptions} />
            ) : (
              <div style={emptyStyle}>Pick a subcategory to see the top locations.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(DetailedAnalysis)
