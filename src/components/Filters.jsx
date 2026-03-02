import React, { useState, useMemo, useEffect, useRef } from 'react'
import VirtualList from './VirtualList'
import { formatNumber } from '../utils/format'

function Filters({ data, visibleData, filters, setFilters, filterMetadata, summaryStats, drilldownFocus }) {
  const [expandedSection, setExpandedSection] = useState(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [highlightKey, setHighlightKey] = useState(null)
  const advancedCardRefs = useRef({})
  const [searchTerms, setSearchTerms] = useState({
    year: '',
    crime: '',
    month: '',
    zip: '',
    division: ''
  })
  const [advancedSearchTerms, setAdvancedSearchTerms] = useState({})

  const ORDERED_DYNAMIC_KEYS = useMemo(() => ([
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
  ]), [])

  // Memoized unique values for base filters
  const baseFeatures = visibleData?.features || data?.features || []
  const uniqueValues = useMemo(() => ({
    crimeCategories: baseFeatures.length ? [...new Set(baseFeatures.map(f => f.properties.CrimeCategory).filter(v => v))].sort() : [],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    zipCodes: baseFeatures.length ? [...new Set(baseFeatures.map(f => f.properties.zip).filter(v => v))].sort() : [],
    divisions: baseFeatures.length ? [...new Set(baseFeatures.map(f => f.properties.DIVISION).filter(v => v))].sort() : [],
    years: baseFeatures.length ? [...new Set(baseFeatures.map(f => f.properties.YEAR_OCCU).filter(v => v))].sort() : []
  }), [baseFeatures])

  // Global totals for comparison (full dataset)
  const allUniqueValues = useMemo(() => ({
    crimeCategories: data?.features ? [...new Set(data.features.map(f => f.properties.CrimeCategory).filter(v => v))].sort() : [],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    zipCodes: data?.features ? [...new Set(data.features.map(f => f.properties.zip).filter(v => v))].sort() : [],
    divisions: data?.features ? [...new Set(data.features.map(f => f.properties.DIVISION).filter(v => v))].sort() : [],
    years: data?.features ? [...new Set(data.features.map(f => f.properties.YEAR_OCCU).filter(v => v))].sort() : []
  }), [data])

  // Debounced search states
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState(searchTerms)
  const [debouncedAdvancedSearchTerms, setDebouncedAdvancedSearchTerms] = useState(advancedSearchTerms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerms(searchTerms), 250)
    return () => clearTimeout(t)
  }, [searchTerms])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAdvancedSearchTerms(advancedSearchTerms), 300)
    return () => clearTimeout(t)
  }, [advancedSearchTerms])

  // If a chart drilldown targets an advanced field, auto-open Advanced Filters and scroll to the field.
  useEffect(() => {
    const key = drilldownFocus?.key
    if (!key) return
    setAdvancedOpen(true)
    setHighlightKey(key)

    const t1 = setTimeout(() => {
      const el = advancedCardRefs.current?.[key]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 60)

    const t2 = setTimeout(() => {
      setHighlightKey((prev) => (prev === key ? null : prev))
    }, 2200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [drilldownFocus?.ts])

  const handleCrimeCategoryChange = (category) => {
    setFilters(prev => ({
      ...prev,
      crimeCategory: prev.crimeCategory.includes(category)
        ? prev.crimeCategory.filter(c => c !== category)
        : [...prev.crimeCategory, category]
    }))
  }

  const handleMonthChange = (month) => {
    setFilters(prev => ({
      ...prev,
      months: prev.months.includes(month)
        ? prev.months.filter(m => m !== month)
        : [...prev.months, month]
    }))
  }

  const handleZipCodeChange = (zip) => {
    setFilters(prev => ({
      ...prev,
      zipCodes: prev.zipCodes.includes(zip)
        ? prev.zipCodes.filter(z => z !== zip)
        : [...prev.zipCodes, zip]
    }))
  }

  const handleDivisionChange = (division) => {
    setFilters(prev => ({
      ...prev,
      divisions: prev.divisions.includes(division)
        ? prev.divisions.filter(d => d !== division)
        : [...prev.divisions, division]
    }))
  }

  const handleAddressChange = (e) => {
    setFilters(prev => ({
      ...prev,
      address: e.target.value
    }))
  }

  const handleYearChange = (year) => {
    setFilters(prev => ({
      ...prev,
      years: prev.years.includes(year)
        ? prev.years.filter(y => y !== year)
        : [...prev.years, year]
    }))
  }

  const handleResetFilters = () => {
    setSearchTerms({ year: '', crime: '', month: '', zip: '', division: '' })
    setAdvancedSearchTerms({})
    setFilters({
      crimeCategory: uniqueValues.crimeCategories,
      months: uniqueValues.months,
      zipCodes: uniqueValues.zipCodes,
      address: '',
      divisions: uniqueValues.divisions,
      years: uniqueValues.years,
      dynamic: {},
      dynamicText: {}
    })
  }

  const handleSelectAll = (filterType, values) => {
    if (filterType === 'year') {
      setFilters(prev => ({ ...prev, years: values }))
    } else if (filterType === 'crime') {
      setFilters(prev => ({ ...prev, crimeCategory: values }))
    } else if (filterType === 'month') {
      setFilters(prev => ({ ...prev, months: values }))
    } else if (filterType === 'zip') {
      setFilters(prev => ({ ...prev, zipCodes: values }))
    } else if (filterType === 'division') {
      setFilters(prev => ({ ...prev, divisions: values }))
    }
  }

  const handleClearAll = (filterType) => {
    if (filterType === 'year') {
      setFilters(prev => ({ ...prev, years: [] }))
    } else if (filterType === 'crime') {
      setFilters(prev => ({ ...prev, crimeCategory: [] }))
    } else if (filterType === 'month') {
      setFilters(prev => ({ ...prev, months: [] }))
    } else if (filterType === 'zip') {
      setFilters(prev => ({ ...prev, zipCodes: [] }))
    } else if (filterType === 'division') {
      setFilters(prev => ({ ...prev, divisions: [] }))
    }
  }

  const toggleDynamicValue = (key, value) => {
    setFilters(prev => {
      const prevVals = prev.dynamic?.[key] || []
      const nextVals = prevVals.includes(value)
        ? prevVals.filter(v => v !== value)
        : [...prevVals, value]
      return {
        ...prev,
        dynamic: { ...prev.dynamic, [key]: nextVals }
      }
    })
  }

  const toggleAdvancedValue = (key, value, allValuesList) => {
    setFilters(prev => {
      const dyn = prev.dynamic && typeof prev.dynamic === 'object' ? prev.dynamic : {}
      const current = Array.isArray(dyn[key]) ? dyn[key] : allValuesList
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]

      const nextDynamic = { ...dyn }
      if (next.length === allValuesList.length) {
        // Back to implicit "All"
        delete nextDynamic[key]
      } else {
        nextDynamic[key] = next
      }
      return { ...prev, dynamic: nextDynamic }
    })
  }

  const setDynamicText = (key, text) => {
    setFilters(prev => ({
      ...prev,
      dynamicText: { ...(prev.dynamicText || {}), [key]: text }
    }))
  }

  const dynamicPropsArray = useMemo(() => {
    if (!filterMetadata) return []
    // Prefer explicit ordering; include any extra keys at the end if worker ever sends more.
    const available = new Set(Object.keys(filterMetadata))
    const ordered = ORDERED_DYNAMIC_KEYS.filter(k => available.has(k))
    const extras = Object.keys(filterMetadata).filter(k => !ORDERED_DYNAMIC_KEYS.includes(k)).sort()
    return [...ordered, ...extras]
  }, [filterMetadata, ORDERED_DYNAMIC_KEYS])

  const downloadText = (filename, text, mime = 'text/plain') => {
    try {
      const blob = new Blob([text], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed', e)
    }
  }

  const exportFieldsJson = () => {
    if (!filterMetadata) return
    const rows = dynamicPropsArray.map((key) => {
      const meta = filterMetadata[key] || {}
      return {
        key,
        totalUnique: meta.totalUnique ?? null,
        totalNonEmpty: meta.totalNonEmpty ?? null,
        truncated: !!meta.truncated,
        topValues: Array.isArray(meta.topValues) ? meta.topValues : [],
      }
    })

    const payload = {
      generatedAt: new Date().toISOString(),
      fieldCount: rows.length,
      fields: rows,
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadText(`tucson-incident-fields-${date}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[\n\r,\"]/g.test(s) ? `"${s.replace(/\"/g, '""')}"` : s
  }

  const exportFieldsCsv = () => {
    if (!filterMetadata) return
    const header = ['key', 'totalUnique', 'totalNonEmpty', 'truncated', 'top1', 'top1Count', 'top2', 'top2Count', 'top3', 'top3Count']
    const lines = [header.join(',')]
    for (const key of dynamicPropsArray) {
      const meta = filterMetadata[key] || {}
      const tops = Array.isArray(meta.topValues) ? meta.topValues : []
      const row = [
        key,
        meta.totalUnique ?? '',
        meta.totalNonEmpty ?? '',
        !!meta.truncated,
        tops[0]?.value ?? '',
        tops[0]?.count ?? '',
        tops[1]?.value ?? '',
        tops[1]?.count ?? '',
        tops[2]?.value ?? '',
        tops[2]?.count ?? '',
      ]
      lines.push(row.map(csvEscape).join(','))
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadText(`tucson-incident-fields-${date}.csv`, lines.join('\n'), 'text/csv')
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
      {/* Header row matching reference style */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Filter Database</h2>
          {summaryStats && (
            <p className="text-xs text-gray-600 mt-1">
              Incidents: <span className="font-medium">{formatNumber(summaryStats.filteredIncidents)}</span> of {formatNumber(summaryStats.totalIncidents)} •
              {' '}Crime Categories: <span className="font-medium">{formatNumber(summaryStats.filteredCrimeCategories)}</span> of {formatNumber(summaryStats.totalCrimeCategories)} •
              {' '}Zip Codes: <span className="font-medium">{formatNumber(summaryStats.filteredZips)}</span> of {formatNumber(summaryStats.totalZips)}
            </p>
          )}
        </div>
        <button
          onClick={handleResetFilters}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Reset All
        </button>
      </div>

      {/* Smart filters banner */}
      <div className="mb-4 text-xs text-blue-700 bg-blue-50 rounded px-3 py-2 border border-blue-100">
        Smart filters: Options adjust based on selected filters
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Year Filter */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'year' ? null : 'year')}
            className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="text-sm">Years</span>
            <span className="text-xs text-gray-600">
              {formatNumber(filters.years.filter(y => uniqueValues.years.includes(y)).length)} of {formatNumber(uniqueValues.years.length)} available
            </span>
            <span className="ml-2 text-gray-400">{expandedSection === 'year' ? '▾' : '▸'}</span>
          </button>
          {expandedSection === 'year' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerms.year}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, year: e.target.value }))}
                className="w-full px-2 py-1 mb-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleSelectAll('year', uniqueValues.years || [])} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Select All</button>
                <button onClick={() => handleClearAll('year')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md">Clear All</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Selected: {filters.years.filter(y => uniqueValues.years.includes(y)).length === uniqueValues.years.length ? 'All' : formatNumber(filters.years.filter(y => uniqueValues.years.includes(y)).length)} of {formatNumber(uniqueValues.years.length)} available
              </div>
              {uniqueValues.years.length < allUniqueValues.years.length && (
                <div className="text-xs text-orange-600 mb-2">Data may be incomplete</div>
              )}
              {(uniqueValues.years?.length > 120) ? (
                <VirtualList
                  items={uniqueValues.years.filter(y => y && String(y).toLowerCase().includes(debouncedSearchTerms.year.toLowerCase()))}
                  height={192}
                  itemHeight={28}
                  renderItem={(year) => (
                    <label key={year} className="flex items-center cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={filters.years.includes(year)}
                        onChange={() => handleYearChange(year)}
                        className="mr-2"
                      />
                      <span className="text-sm">{year}</span>
                    </label>
                  )}
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uniqueValues.years?.filter(y => y && String(y).toLowerCase().includes(debouncedSearchTerms.year.toLowerCase())).map(year => (
                    <label key={year} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.years.includes(year)}
                        onChange={() => handleYearChange(year)}
                        className="mr-2"
                      />
                      <span className="text-sm">{year}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crime Category Filter */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'crime' ? null : 'crime')}
            className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="text-sm">Categories</span>
            <span className="text-xs text-gray-600">
              {formatNumber(filters.crimeCategory.filter(c => uniqueValues.crimeCategories.includes(c)).length)} of {formatNumber(uniqueValues.crimeCategories.length)} available
            </span>
            <span className="ml-2 text-gray-400">{expandedSection === 'crime' ? '▾' : '▸'}</span>
          </button>
          {expandedSection === 'crime' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerms.crime}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, crime: e.target.value }))}
                className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleSelectAll('crime', uniqueValues.crimeCategories || [])} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Select All</button>
                <button onClick={() => handleClearAll('crime')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md">Clear All</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Selected: {filters.crimeCategory.filter(c => uniqueValues.crimeCategories.includes(c)).length === uniqueValues.crimeCategories.length ? 'All' : formatNumber(filters.crimeCategory.filter(c => uniqueValues.crimeCategories.includes(c)).length)} of {formatNumber(uniqueValues.crimeCategories.length)} available
              </div>
              {uniqueValues.crimeCategories.length < allUniqueValues.crimeCategories.length && (
                <div className="text-xs text-orange-600 mb-2">Data may be incomplete</div>
              )}
              {(uniqueValues.crimeCategories?.length > 150) ? (
                <VirtualList
                  items={uniqueValues.crimeCategories.filter(c => c && c.toLowerCase().includes(debouncedSearchTerms.crime.toLowerCase()))}
                  height={192}
                  itemHeight={28}
                  renderItem={(category) => (
                    <label key={category} className="flex items-center cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={filters.crimeCategory.includes(category)}
                        onChange={() => handleCrimeCategoryChange(category)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category}</span>
                    </label>
                  )}
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uniqueValues.crimeCategories?.filter(c => c && c.toLowerCase().includes(debouncedSearchTerms.crime.toLowerCase())).map(category => (
                    <label key={category} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.crimeCategory.includes(category)}
                        onChange={() => handleCrimeCategoryChange(category)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Month Filter */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'month' ? null : 'month')}
            className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="text-sm">Months</span>
            <span className="text-xs text-gray-600">
              {formatNumber(filters.months.filter(m => uniqueValues.months.includes(m)).length)} of {formatNumber(uniqueValues.months.length)} available
            </span>
            <span className="ml-2 text-gray-400">{expandedSection === 'month' ? '▾' : '▸'}</span>
          </button>
          {expandedSection === 'month' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerms.month}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, month: e.target.value }))}
                className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleSelectAll('month', uniqueValues.months || [])} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Select All</button>
                <button onClick={() => handleClearAll('month')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md">Clear All</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Selected: {filters.months.filter(m => uniqueValues.months.includes(m)).length === uniqueValues.months.length ? 'All' : formatNumber(filters.months.filter(m => uniqueValues.months.includes(m)).length)} of {formatNumber(uniqueValues.months.length)} available
              </div>
              {uniqueValues.months.length < allUniqueValues.months.length && (
                <div className="text-xs text-orange-600 mb-2">Data may be incomplete</div>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uniqueValues.months?.filter(m => m && m.toLowerCase().includes(debouncedSearchTerms.month.toLowerCase())).map(month => (
                  <label key={month} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.months.includes(month)}
                      onChange={() => handleMonthChange(month)}
                      className="rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{month}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zip Code Filter */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'zip' ? null : 'zip')}
            className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="text-sm">Zip Codes</span>
            <span className="text-xs text-gray-600">
              {formatNumber(filters.zipCodes.filter(z => uniqueValues.zipCodes.includes(z)).length)} of {formatNumber(uniqueValues.zipCodes.length)} available
            </span>
            <span className="ml-2 text-gray-400">{expandedSection === 'zip' ? '▾' : '▸'}</span>
          </button>
          {expandedSection === 'zip' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerms.zip}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, zip: e.target.value }))}
                className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleSelectAll('zip', uniqueValues.zipCodes || [])} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Select All</button>
                <button onClick={() => handleClearAll('zip')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md">Clear All</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Selected: {filters.zipCodes.filter(z => uniqueValues.zipCodes.includes(z)).length === uniqueValues.zipCodes.length ? 'All' : formatNumber(filters.zipCodes.filter(z => uniqueValues.zipCodes.includes(z)).length)} of {formatNumber(uniqueValues.zipCodes.length)} available
              </div>
              {uniqueValues.zipCodes.length < allUniqueValues.zipCodes.length && (
                <div className="text-xs text-orange-600 mb-2">Data may be incomplete</div>
              )}
              {(uniqueValues.zipCodes?.length > 200) ? (
                <VirtualList
                  items={uniqueValues.zipCodes.filter(z => z && String(z).toLowerCase().includes(debouncedSearchTerms.zip.toLowerCase()))}
                  height={192}
                  itemHeight={28}
                  renderItem={(zip) => (
                    <label key={zip} className="flex items-center cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={filters.zipCodes.includes(zip)}
                        onChange={() => handleZipCodeChange(zip)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{zip}</span>
                    </label>
                  )}
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uniqueValues.zipCodes?.filter(z => z && String(z).toLowerCase().includes(debouncedSearchTerms.zip.toLowerCase())).map(zip => (
                    <label key={zip} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.zipCodes.includes(zip)}
                        onChange={() => handleZipCodeChange(zip)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{zip}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Division Filter */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'division' ? null : 'division')}
            className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="text-sm">Divisions</span>
            <span className="text-xs text-gray-600">
              {formatNumber(filters.divisions.filter(d => uniqueValues.divisions.includes(d)).length)} of {formatNumber(uniqueValues.divisions.length)} available
            </span>
            <span className="ml-2 text-gray-400">{expandedSection === 'division' ? '▾' : '▸'}</span>
          </button>
          {expandedSection === 'division' && (
            <div className="mt-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerms.division}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, division: e.target.value }))}
                className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleSelectAll('division', uniqueValues.divisions || [])} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Select All</button>
                <button onClick={() => handleClearAll('division')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md">Clear All</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Selected: {filters.divisions.filter(d => uniqueValues.divisions.includes(d)).length === uniqueValues.divisions.length ? 'All' : formatNumber(filters.divisions.filter(d => uniqueValues.divisions.includes(d)).length)} of {formatNumber(uniqueValues.divisions.length)} available
              </div>
              {uniqueValues.divisions.length < allUniqueValues.divisions.length && (
                <div className="text-xs text-orange-600 mb-2">Data may be incomplete</div>
              )}
              {(uniqueValues.divisions?.length > 150) ? (
                <VirtualList
                  items={uniqueValues.divisions.filter(d => d && d.toLowerCase().includes(debouncedSearchTerms.division.toLowerCase()))}
                  height={192}
                  itemHeight={28}
                  renderItem={(division) => (
                    <label key={division} className="flex items-center cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={filters.divisions.includes(division)}
                        onChange={() => handleDivisionChange(division)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 truncate">{division}</span>
                    </label>
                  )}
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uniqueValues.divisions?.filter(d => d && d.toLowerCase().includes(debouncedSearchTerms.division.toLowerCase())).map(division => (
                    <label key={division} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.divisions.includes(division)}
                        onChange={() => handleDivisionChange(division)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 truncate">{division}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Address Filter */}
        <div>
          <label className="block font-semibold text-gray-700 mb-2">Address Search</label>
          <input
            type="text"
            placeholder="Search address..."
            value={filters.address}
            onChange={handleAddressChange}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Advanced Filters - Show ALL properties from metadata */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-600">
            Export the discovered field list for analysis.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportFieldsJson}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
              disabled={!filterMetadata}
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={exportFieldsCsv}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
              disabled={!filterMetadata}
            >
              Export CSV
            </button>
          </div>
        </div>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full text-left font-medium text-gray-800 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex justify-between items-center"
        >
          Advanced Filters ({formatNumber(dynamicPropsArray.length)} properties)
          <span className="ml-2 text-gray-400">{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && filterMetadata && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dynamicPropsArray.map(key => {
              const meta = filterMetadata[key]
              const selected = filters.dynamic?.[key] || []
              const search = debouncedAdvancedSearchTerms[key] || ''

              const values = (Array.isArray(meta.allValues) && meta.allValues.length > 0)
                ? meta.allValues
                : (meta.topValues || [])

              const allValuesList = values
                .map(tv => tv?.value)
                .filter(v => typeof v === 'string' && v.length > 0)

              const explicitSelected = filters.dynamic?.[key]
              const effectiveSelected = Array.isArray(explicitSelected) ? explicitSelected : allValuesList

              const filtered = values.filter(tv => tv && tv.value && tv.value.toLowerCase().includes(search.toLowerCase()))
              const isHighCardinality = !!meta.truncated
              const textVal = (filters.dynamicText && typeof filters.dynamicText === 'object') ? (filters.dynamicText[key] || '') : ''
              const isNoOp = (!explicitSelected || explicitSelected.length === 0) && !String(textVal || '').trim()
              
              return (
                <div
                  key={key}
                  ref={(el) => {
                    if (el) advancedCardRefs.current[key] = el
                  }}
                  className={
                    `border rounded p-3 bg-white ` +
                    (highlightKey === key ? 'ring-2 ring-blue-400 border-blue-300' : '')
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm truncate" title={key}>{key}</h3>
                    <span className="text-xs text-gray-500">{isNoOp ? 'All' : `${formatNumber(effectiveSelected.length)} selected`}</span>
                  </div>

                  {isHighCardinality && (
                    <div className="mb-2">
                      <label className="block text-[11px] text-gray-600 mb-1">Text filter (contains)</label>
                      <input
                        type="text"
                        placeholder="Type to filter…"
                        value={textVal}
                        onChange={(e) => setDynamicText(key, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setAdvancedSearchTerms(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Select All / Clear All */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setFilters(prev => {
                        const nextDynamic = { ...(prev.dynamic || {}) }
                        // Implicit "All" (no filter)
                        delete nextDynamic[key]
                        return { ...prev, dynamic: nextDynamic }
                      })}
                      className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        dynamic: (() => {
                          const nextDynamic = { ...(prev.dynamic || {}) }
                          delete nextDynamic[key]
                          return nextDynamic
                        })(),
                        dynamicText: { ...(prev.dynamicText || {}), [key]: '' }
                      }))}
                      className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Top values checkboxes with virtualization when long */}
                  {filtered.length > 200 ? (
                    <VirtualList
                      items={filtered}
                      height={160}
                      itemHeight={28}
                      renderItem={(tv) => (
                        tv && tv.value ? (
                          <label key={tv.value} className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={effectiveSelected.includes(tv.value)}
                              onChange={() => toggleAdvancedValue(key, tv.value, allValuesList)}
                              className="mr-2"
                            />
                            <span className="truncate flex-1">{tv.value}</span>
                            <span className="ml-auto text-gray-400 flex-shrink-0">{formatNumber(tv.count)}</span>
                          </label>
                        ) : null
                      )}
                    />
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filtered.map(tv => tv && tv.value ? (
                        <label key={tv.value} className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={effectiveSelected.includes(tv.value)}
                            onChange={() => toggleAdvancedValue(key, tv.value, allValuesList)}
                            className="mr-2"
                          />
                          <span className="truncate flex-1">{tv.value}</span>
                          <span className="ml-auto text-gray-400 flex-shrink-0">{formatNumber(tv.count)}</span>
                        </label>
                      ) : null)}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {meta.truncated ? 'Showing top ' : 'Showing '}
                    {formatNumber(values.filter(tv => tv && tv.value).length)} of {formatNumber(meta.totalUnique)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(Filters)
