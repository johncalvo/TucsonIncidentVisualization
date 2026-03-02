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
    zipCodes: baseFeatures.length ? [...new Set(baseFeatures.map(f => f.properties.zip).filter(v => v && /^\d{5}$/.test(String(v))))].sort() : [],
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

  const filterBtnStyle = {
    width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid #374151',
    borderRadius: '0.5rem', cursor: 'pointer',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }
  const expandedPanelStyle = {
    marginTop: '0.5rem', padding: '0.75rem',
    background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid #1f2937',
  }
  const inputStyle = {
    width: '100%', padding: '0.375rem 0.625rem', background: '#0a0f1e',
    border: '1px solid #374151', borderRadius: '0.375rem', color: '#f9fafb',
    fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem',
  }
  const checkboxListStyle = {
    maxHeight: '192px', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
  }
  const checkLabelStyle = {
    display: 'flex', alignItems: 'center', cursor: 'pointer',
    padding: '0.125rem 0.25rem', borderRadius: '0.25rem',
  }
  const allBtnStyle = {
    flex: 1, padding: '0.25rem',
    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
    borderRadius: '0.25rem', color: '#06b6d4', fontSize: '0.75rem', cursor: 'pointer',
  }
  const noneBtnStyle = {
    flex: 1, padding: '0.25rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '0.25rem', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f9fafb' }}>Filters</h2>
          {summaryStats && (
            <p style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.25rem', lineHeight: 1.5 }}>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatNumber(summaryStats.filteredIncidents)}</span>
              {' / '}{formatNumber(summaryStats.totalIncidents)} incidents
            </p>
          )}
        </div>
        <button
          onClick={handleResetFilters}
          style={{ fontSize: '0.75rem', fontWeight: 600, color: '#06b6d4', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', flexShrink: 0, marginLeft: '0.5rem' }}
        >
          Reset
        </button>
      </div>

      {/* Smart filters note */}
      <div style={{ marginBottom: '0.75rem', fontSize: '0.6875rem', color: '#06b6d4', background: 'rgba(6,182,212,0.06)', borderRadius: '0.375rem', padding: '0.375rem 0.625rem', border: '1px solid rgba(6,182,212,0.15)' }}>
        Options adjust based on current selection
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Year Filter */}
        <div>
          <button onClick={() => setExpandedSection(expandedSection === 'year' ? null : 'year')} style={filterBtnStyle}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>Years</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {formatNumber(filters.years.filter(y => uniqueValues.years.includes(y)).length)}/{formatNumber(uniqueValues.years.length)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{expandedSection === 'year' ? '▾' : '▸'}</span>
            </div>
          </button>
          {expandedSection === 'year' && (
            <div style={expandedPanelStyle}>
              <input type="text" placeholder="Search..." value={searchTerms.year}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, year: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => handleSelectAll('year', uniqueValues.years || [])} style={allBtnStyle}>All</button>
                <button onClick={() => handleClearAll('year')} style={noneBtnStyle}>None</button>
              </div>
              {uniqueValues.years.length < allUniqueValues.years.length && (
                <div style={{ fontSize: '0.6875rem', color: '#f97316', marginBottom: '0.5rem' }}>Data may be incomplete</div>
              )}
              {(uniqueValues.years?.length > 120) ? (
                <VirtualList items={uniqueValues.years.filter(y => y && String(y).toLowerCase().includes(debouncedSearchTerms.year.toLowerCase()))}
                  height={192} itemHeight={28}
                  renderItem={(year) => (
                    <label key={year} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.years.includes(year)} onChange={() => handleYearChange(year)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{year}</span>
                    </label>
                  )} />
              ) : (
                <div style={checkboxListStyle}>
                  {uniqueValues.years?.filter(y => y && String(y).toLowerCase().includes(debouncedSearchTerms.year.toLowerCase())).map(year => (
                    <label key={year} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.years.includes(year)} onChange={() => handleYearChange(year)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{year}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crime Category Filter */}
        <div>
          <button onClick={() => setExpandedSection(expandedSection === 'crime' ? null : 'crime')} style={filterBtnStyle}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>Categories</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {formatNumber(filters.crimeCategory.filter(c => uniqueValues.crimeCategories.includes(c)).length)}/{formatNumber(uniqueValues.crimeCategories.length)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{expandedSection === 'crime' ? '▾' : '▸'}</span>
            </div>
          </button>
          {expandedSection === 'crime' && (
            <div style={expandedPanelStyle}>
              <input type="text" placeholder="Search..." value={searchTerms.crime}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, crime: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => handleSelectAll('crime', uniqueValues.crimeCategories || [])} style={allBtnStyle}>All</button>
                <button onClick={() => handleClearAll('crime')} style={noneBtnStyle}>None</button>
              </div>
              {uniqueValues.crimeCategories.length < allUniqueValues.crimeCategories.length && (
                <div style={{ fontSize: '0.6875rem', color: '#f97316', marginBottom: '0.5rem' }}>Data may be incomplete</div>
              )}
              {(uniqueValues.crimeCategories?.length > 150) ? (
                <VirtualList items={uniqueValues.crimeCategories.filter(c => c && c.toLowerCase().includes(debouncedSearchTerms.crime.toLowerCase()))}
                  height={192} itemHeight={28}
                  renderItem={(category) => (
                    <label key={category} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.crimeCategory.includes(category)} onChange={() => handleCrimeCategoryChange(category)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{category}</span>
                    </label>
                  )} />
              ) : (
                <div style={checkboxListStyle}>
                  {uniqueValues.crimeCategories?.filter(c => c && c.toLowerCase().includes(debouncedSearchTerms.crime.toLowerCase())).map(category => (
                    <label key={category} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.crimeCategory.includes(category)} onChange={() => handleCrimeCategoryChange(category)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{category}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Month Filter */}
        <div>
          <button onClick={() => setExpandedSection(expandedSection === 'month' ? null : 'month')} style={filterBtnStyle}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>Months</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {formatNumber(filters.months.filter(m => uniqueValues.months.includes(m)).length)}/{formatNumber(uniqueValues.months.length)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{expandedSection === 'month' ? '▾' : '▸'}</span>
            </div>
          </button>
          {expandedSection === 'month' && (
            <div style={expandedPanelStyle}>
              <input type="text" placeholder="Search..." value={searchTerms.month}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, month: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => handleSelectAll('month', uniqueValues.months || [])} style={allBtnStyle}>All</button>
                <button onClick={() => handleClearAll('month')} style={noneBtnStyle}>None</button>
              </div>
              <div style={checkboxListStyle}>
                {uniqueValues.months?.filter(m => m && m.toLowerCase().includes(debouncedSearchTerms.month.toLowerCase())).map(month => (
                  <label key={month} style={checkLabelStyle}>
                    <input type="checkbox" checked={filters.months.includes(month)} onChange={() => handleMonthChange(month)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                    <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{month}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zip Code Filter */}
        <div>
          <button onClick={() => setExpandedSection(expandedSection === 'zip' ? null : 'zip')} style={filterBtnStyle}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>Zip Codes</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {formatNumber(filters.zipCodes.filter(z => uniqueValues.zipCodes.includes(z)).length)}/{formatNumber(uniqueValues.zipCodes.length)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{expandedSection === 'zip' ? '▾' : '▸'}</span>
            </div>
          </button>
          {expandedSection === 'zip' && (
            <div style={expandedPanelStyle}>
              <input type="text" placeholder="Search..." value={searchTerms.zip}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, zip: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => handleSelectAll('zip', uniqueValues.zipCodes || [])} style={allBtnStyle}>All</button>
                <button onClick={() => handleClearAll('zip')} style={noneBtnStyle}>None</button>
              </div>
              {uniqueValues.zipCodes.length < allUniqueValues.zipCodes.length && (
                <div style={{ fontSize: '0.6875rem', color: '#f97316', marginBottom: '0.5rem' }}>Data may be incomplete</div>
              )}
              {(uniqueValues.zipCodes?.length > 200) ? (
                <VirtualList items={uniqueValues.zipCodes.filter(z => z && String(z).toLowerCase().includes(debouncedSearchTerms.zip.toLowerCase()))}
                  height={192} itemHeight={28}
                  renderItem={(zip) => (
                    <label key={zip} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.zipCodes.includes(zip)} onChange={() => handleZipCodeChange(zip)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{zip}</span>
                    </label>
                  )} />
              ) : (
                <div style={checkboxListStyle}>
                  {uniqueValues.zipCodes?.filter(z => z && String(z).toLowerCase().includes(debouncedSearchTerms.zip.toLowerCase())).map(zip => (
                    <label key={zip} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.zipCodes.includes(zip)} onChange={() => handleZipCodeChange(zip)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{zip}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Division Filter */}
        <div>
          <button onClick={() => setExpandedSection(expandedSection === 'division' ? null : 'division')} style={filterBtnStyle}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>Divisions</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                {formatNumber(filters.divisions.filter(d => uniqueValues.divisions.includes(d)).length)}/{formatNumber(uniqueValues.divisions.length)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{expandedSection === 'division' ? '▾' : '▸'}</span>
            </div>
          </button>
          {expandedSection === 'division' && (
            <div style={expandedPanelStyle}>
              <input type="text" placeholder="Search..." value={searchTerms.division}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, division: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => handleSelectAll('division', uniqueValues.divisions || [])} style={allBtnStyle}>All</button>
                <button onClick={() => handleClearAll('division')} style={noneBtnStyle}>None</button>
              </div>
              {uniqueValues.divisions.length < allUniqueValues.divisions.length && (
                <div style={{ fontSize: '0.6875rem', color: '#f97316', marginBottom: '0.5rem' }}>Data may be incomplete</div>
              )}
              {(uniqueValues.divisions?.length > 150) ? (
                <VirtualList items={uniqueValues.divisions.filter(d => d && d.toLowerCase().includes(debouncedSearchTerms.division.toLowerCase()))}
                  height={192} itemHeight={28}
                  renderItem={(division) => (
                    <label key={division} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.divisions.includes(division)} onChange={() => handleDivisionChange(division)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{division}</span>
                    </label>
                  )} />
              ) : (
                <div style={checkboxListStyle}>
                  {uniqueValues.divisions?.filter(d => d && d.toLowerCase().includes(debouncedSearchTerms.division.toLowerCase())).map(division => (
                    <label key={division} style={checkLabelStyle}>
                      <input type="checkbox" checked={filters.divisions.includes(division)} onChange={() => handleDivisionChange(division)} style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{division}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Address Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb', marginBottom: '0.375rem' }}>Address Search</label>
          <input
            type="text"
            placeholder="Search address..."
            value={filters.address}
            onChange={handleAddressChange}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Export field list:</span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button type="button" onClick={exportFieldsJson} disabled={!filterMetadata}
              style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>
              JSON
            </button>
            <button type="button" onClick={exportFieldsCsv} disabled={!filterMetadata}
              style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', borderRadius: '0.25rem', color: '#9ca3af', cursor: 'pointer' }}>
              CSV
            </button>
          </div>
        </div>
        <button onClick={() => setAdvancedOpen(!advancedOpen)} style={filterBtnStyle}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#e5e7eb' }}>
            Advanced Filters ({formatNumber(dynamicPropsArray.length)} properties)
          </span>
          <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && filterMetadata && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dynamicPropsArray.map(key => {
              const meta = filterMetadata[key]
              const search = debouncedAdvancedSearchTerms[key] || ''
              const values = (Array.isArray(meta.allValues) && meta.allValues.length > 0)
                ? meta.allValues : (meta.topValues || [])
              const allValuesList = values.map(tv => tv?.value).filter(v => typeof v === 'string' && v.length > 0)
              const explicitSelected = filters.dynamic?.[key]
              const effectiveSelected = Array.isArray(explicitSelected) ? explicitSelected : allValuesList
              const filtered = values.filter(tv => tv && tv.value && tv.value.toLowerCase().includes(search.toLowerCase()))
              const isHighCardinality = !!meta.truncated
              const textVal = (filters.dynamicText && typeof filters.dynamicText === 'object') ? (filters.dynamicText[key] || '') : ''
              const isNoOp = (!explicitSelected || explicitSelected.length === 0) && !String(textVal || '').trim()

              return (
                <div key={key}
                  ref={(el) => { if (el) advancedCardRefs.current[key] = el }}
                  style={{
                    border: `1px solid ${highlightKey === key ? '#06b6d4' : '#1f2937'}`,
                    borderRadius: '0.5rem', padding: '0.75rem', background: '#0d1117',
                    boxShadow: highlightKey === key ? '0 0 0 2px rgba(6,182,212,0.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={key}>{key}</h3>
                    <span style={{ fontSize: '0.6875rem', color: '#6b7280', flexShrink: 0, marginLeft: '0.5rem' }}>{isNoOp ? 'All' : `${formatNumber(effectiveSelected.length)} sel`}</span>
                  </div>

                  {isHighCardinality && (
                    <div style={{ marginBottom: '0.375rem' }}>
                      <input type="text" placeholder="Text filter (contains)…" value={textVal}
                        onChange={(e) => setDynamicText(key, e.target.value)}
                        style={{ ...inputStyle, fontSize: '0.75rem', marginBottom: '0.25rem' }} />
                    </div>
                  )}

                  <input type="text" placeholder="Search…" value={search}
                    onChange={(e) => setAdvancedSearchTerms(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ ...inputStyle, fontSize: '0.75rem' }} />

                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
                    <button onClick={() => setFilters(prev => {
                      const nextDynamic = { ...(prev.dynamic || {}) }
                      delete nextDynamic[key]
                      return { ...prev, dynamic: nextDynamic }
                    })} style={{ ...allBtnStyle, fontSize: '0.6875rem' }}>All</button>
                    <button onClick={() => setFilters(prev => ({
                      ...prev,
                      dynamic: (() => { const d = { ...(prev.dynamic || {}) }; delete d[key]; return d })(),
                      dynamicText: { ...(prev.dynamicText || {}), [key]: '' }
                    }))} style={{ ...noneBtnStyle, fontSize: '0.6875rem' }}>Clear</button>
                  </div>

                  {filtered.length > 200 ? (
                    <VirtualList items={filtered} height={160} itemHeight={28}
                      renderItem={(tv) => tv && tv.value ? (
                        <label key={tv.value} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                          <input type="checkbox" checked={effectiveSelected.includes(tv.value)}
                            onChange={() => toggleAdvancedValue(key, tv.value, allValuesList)}
                            style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, color: '#d1d5db' }}>{tv.value}</span>
                          <span style={{ marginLeft: 'auto', color: '#4b5563', flexShrink: 0 }}>{formatNumber(tv.count)}</span>
                        </label>
                      ) : null} />
                  ) : (
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                      {filtered.map(tv => tv && tv.value ? (
                        <label key={tv.value} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                          <input type="checkbox" checked={effectiveSelected.includes(tv.value)}
                            onChange={() => toggleAdvancedValue(key, tv.value, allValuesList)}
                            style={{ marginRight: '0.5rem', accentColor: '#06b6d4' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, color: '#d1d5db' }}>{tv.value}</span>
                          <span style={{ marginLeft: 'auto', color: '#4b5563', flexShrink: 0 }}>{formatNumber(tv.count)}</span>
                        </label>
                      ) : null)}
                    </div>
                  )}
                  <p style={{ fontSize: '0.6875rem', color: '#4b5563', marginTop: '0.375rem' }}>
                    {meta.truncated ? 'Top ' : ''}{formatNumber(values.filter(tv => tv && tv.value).length)} of {formatNumber(meta.totalUnique)}
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
