import React from 'react'
import { formatNumber } from '../utils/format'

const NAV_TABS = [
  { id: 'map', label: 'Map' },
  { id: 'charts', label: 'Charts' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'courts', label: 'Courts' },
]

function Navigation({ activeTab, onTabChange, totalIncidents, filteredIncidents, lastUpdated, loading }) {
  const pct = totalIncidents > 0 ? Math.round((filteredIncidents / totalIncidents) * 100) : 100

  return (
    <header
      style={{
        background: '#111827',
        borderBottom: '1px solid #1f2937',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        height: '56px',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>🗺</span>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f9fafb', letterSpacing: '-0.01em' }}>
          Tucson Incidents
        </span>
      </div>

      {/* Tab bar */}
      <nav style={{ display: 'flex', gap: '0.125rem' }}>
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0.35rem 0.875rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#06b6d4' : '#6b7280',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = '#6b7280'
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem' }}>
        {loading ? (
          <span style={{ color: '#06b6d4' }}>Loading data…</span>
        ) : (
          <>
            <span style={{ color: '#6b7280' }}>
              <span style={{ color: '#f9fafb', fontWeight: 600 }}>{formatNumber(filteredIncidents)}</span>
              {' '}/ {formatNumber(totalIncidents)} incidents
              {pct < 100 && (
                <span style={{ color: '#f97316', marginLeft: '0.25rem' }}>({pct}%)</span>
              )}
            </span>
            {lastUpdated && (
              <span style={{ color: '#4b5563', borderLeft: '1px solid #1f2937', paddingLeft: '1rem' }}>
                Updated {lastUpdated}
              </span>
            )}
          </>
        )}
      </div>
    </header>
  )
}

export default Navigation
