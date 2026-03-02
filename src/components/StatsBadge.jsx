import React from 'react'
import { formatNumber } from '../utils/format'

/**
 * Floating overlay badge on the map showing filtered/total incident counts.
 */
function StatsBadge({ filteredCount, totalCount, truncated }) {
  const pct = totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 100
  const isFiltered = filteredCount < totalCount

  return (
    <div
      style={{
        position: 'absolute',
        top: '0.75rem',
        right: '0.75rem',
        zIndex: 1000,
        background: 'rgba(17,24,39,0.9)',
        backdropFilter: 'blur(4px)',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        padding: '0.5rem 0.75rem',
        fontSize: '0.8125rem',
        color: '#f9fafb',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isFiltered ? '#f97316' : '#22c55e',
            flexShrink: 0,
          }}
        />
        <span>
          <strong style={{ color: isFiltered ? '#f97316' : '#06b6d4' }}>
            {formatNumber(filteredCount)}
          </strong>
          {isFiltered && (
            <span style={{ color: '#6b7280' }}> / {formatNumber(totalCount)} ({pct}%)</span>
          )}
          <span style={{ color: '#6b7280' }}> incidents</span>
        </span>
      </div>
      {truncated && (
        <div style={{ color: '#f97316', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Map shows top {formatNumber(filteredCount)} (truncated)
        </div>
      )}
    </div>
  )
}

export default StatsBadge
