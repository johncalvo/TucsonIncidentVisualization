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
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    }
  }, [subcategoryShare.labels, subcategoryShare.pct])

  const shareOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex
            const pct = ctx.parsed.x
            const raw = subcategoryShare.raw[idx]
            return `${pct}% (${(raw || 0).toLocaleString()} incidents)`
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (v) => `${v}%`,
        },
        suggestedMax: 100,
      },
      y: {
        ticks: {
          autoSkip: false,
        },
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
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.18)',
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
        callbacks: {
          label: (ctx) => `${formatNumber(ctx.parsed?.y ?? 0)} incidents`,
        },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 12 },
      },
      y: { beginAtZero: true, ticks: { callback: (v) => formatNumber(v) } },
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
          backgroundColor: 'rgba(139, 92, 246, 0.55)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1,
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
        callbacks: {
          label: (ctx) => `${formatNumber(ctx.parsed?.x ?? 0)} incidents`,
        },
      },
    },
    scales: {
      x: { beginAtZero: true, ticks: { callback: (v) => formatNumber(v) } },
      y: { ticks: { autoSkip: false } },
    },
  }), [])

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Detailed Analysis</h2>
          <p className="text-xs text-gray-600 mt-1">
            Use the global filters above to narrow the dataset, then drill into category → subcategory share, trend, and location.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedCategory(topCategory === 'N/A' ? '' : topCategory)
            setSelectedSubcategory('')
            setSubcategoryField('CrimeType')
            setLocationDimension('zip')
          }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
        >
          Reset Analysis
        </button>
      </div>

      {/* Analysis controls */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {aggregates.categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory Field</label>
          <select
            value={subcategoryField}
            onChange={(e) => setSubcategoryField(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {subcategoryFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
          <select
            value={selectedSubcategory}
            onChange={(e) => setSelectedSubcategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Subcategories</option>
            {aggregates.subcategories.slice(0, 100).map((s) => (
              <option key={s.value} value={s.value}>
                {s.value} ({s.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location Dimension</label>
          <select
            value={locationDimension}
            onChange={(e) => setLocationDimension(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="zip">Zip Code</option>
            <option value="DIVISION">Division</option>
            <option value="NEIGHBORHD">Neighborhood</option>
          </select>
        </div>
      </div>

      {/* Summary Stats (reflects current global filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-gray-600">Total Incidents</p>
          <p className="text-2xl font-bold text-blue-600">{aggregates.totalIncidents.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-gray-600">Unique Locations</p>
          <p className="text-2xl font-bold text-green-600">
            {aggregates.uniqueLocations.toLocaleString()}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-gray-600">Neighborhoods</p>
          <p className="text-2xl font-bold text-purple-600">
            {aggregates.uniqueNeighborhoods.toLocaleString()}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-gray-600">Crime Categories</p>
          <p className="text-2xl font-bold text-orange-600">
            {aggregates.categoryCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Subcategory Share</h3>
            <div className="text-xs text-gray-600">
              {selectedCategory || '—'} • {aggregates.totalInSelectedCategory.toLocaleString()} incidents
            </div>
          </div>
          <div style={{ height: '420px' }}>
            {shareChart.labels.length > 0 ? (
              <Bar data={shareChart} options={shareOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No subcategory data available.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Trend Over Time</h3>
            <div className="text-xs text-gray-600">
              {selectedSubcategory ? `${selectedCategory} → ${selectedSubcategory}` : 'Select a subcategory to enable'}
            </div>
          </div>
          <div style={{ height: '420px' }}>
            {selectedSubcategory && trendChart.labels.length > 0 ? (
              <Line data={trendChart} options={trendOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Pick a subcategory to see the monthly trend.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Location Breakdown</h3>
            <div className="text-xs text-gray-600">
              {selectedSubcategory ? `${locationDimension}: top locations for selection` : 'Select a subcategory to enable'}
            </div>
          </div>
          <div style={{ height: '520px' }}>
            {selectedSubcategory && locationsChart.labels.length > 0 ? (
              <Bar data={locationsChart} options={locationsOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Pick a subcategory to see the top locations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(DetailedAnalysis)
