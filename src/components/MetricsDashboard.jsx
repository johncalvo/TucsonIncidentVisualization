import React, { useMemo } from 'react'
import { formatNumber } from '../utils/format'

const TONE_STYLES = {
  cyan:   { value: '#06b6d4', border: 'rgba(6,182,212,0.3)',   icon: '📊' },
  orange: { value: '#f97316', border: 'rgba(249,115,22,0.3)',  icon: '⚠' },
  green:  { value: '#22c55e', border: 'rgba(34,197,94,0.3)',   icon: '🏘' },
  purple: { value: '#a78bfa', border: 'rgba(167,139,250,0.3)', icon: '🏷' },
  red:    { value: '#ef4444', border: 'rgba(239,68,68,0.3)',   icon: '📍' },
  gray:   { value: '#9ca3af', border: 'rgba(156,163,175,0.2)', icon: '📋' },
}

function KpiCard({ title, value, subtitle, tone = 'cyan', actionLabel, onAction, icon }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.cyan
  const displayIcon = icon || styles.icon

  return (
    <div
      style={{
        background: '#111827',
        border: `1px solid ${styles.border}`,
        borderRadius: '0.75rem',
        padding: '1rem 1.125rem',
        transition: 'border-color 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle glow accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: styles.value,
          opacity: 0.6,
          borderRadius: '0.75rem 0.75rem 0 0',
        }}
      />

      <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '0.5rem' }}>
        {title}
      </p>

      <p style={{ fontSize: '1.625rem', fontWeight: 700, color: styles.value, lineHeight: 1.1 }}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>

      {subtitle && (
        <p style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.375rem' }}>{subtitle}</p>
      )}

      {actionLabel && typeof onAction === 'function' && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: styles.value,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function MetricsDashboard({ totalIncidents, filteredIncidents, crimeCategories, divisions, onClearFilters }) {
  const hidden = Math.max(0, (totalIncidents || 0) - (filteredIncidents || 0))

  const cards = useMemo(() => {
    const base = [
      {
        title: 'Filtered Incidents',
        value: filteredIncidents || 0,
        subtitle: `of ${formatNumber(totalIncidents || 0)} total`,
        tone: 'cyan',
      },
      {
        title: 'Crime Categories',
        value: crimeCategories || 0,
        subtitle: 'in filtered results',
        tone: 'orange',
      },
      {
        title: 'Divisions',
        value: divisions || 0,
        subtitle: 'in filtered results',
        tone: 'purple',
      },
    ]
    if (hidden > 0) {
      base.push({
        title: 'Hidden by Filters',
        value: `+${formatNumber(hidden)}`,
        subtitle: 'Click to clear filters',
        tone: 'red',
        actionLabel: 'Clear filters',
        onAction: onClearFilters,
      })
    }
    return base
  }, [totalIncidents, filteredIncidents, crimeCategories, divisions, hidden, onClearFilters])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  )
}

export default MetricsDashboard
