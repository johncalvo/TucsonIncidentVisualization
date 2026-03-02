import React, { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, Title, Tooltip, Legend)

const CATEGORY_COLORS = {
  'Violent':          '#ef4444',
  'Property':         '#06b6d4',
  'Quality of Life':  '#f97316',
  'Violation':        '#a78bfa',
  'Emergency':        '#dc2626',
  'Traffic':          '#22c55e',
  'Other':            '#6b7280',
}

function categoryColor(cat, idx) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]
  const hue = (idx * 137.5) % 360
  return `hsl(${hue}, 65%, 55%)`
}

const DARK_SCALE = {
  grid: { color: 'rgba(255,255,255,0.06)' },
  ticks: { color: '#9ca3af' },
  title: { color: '#9ca3af' },
}

function TimelineChart({ data }) {
  const chartData = useMemo(() => {
    if (!data?.features?.length) return { labels: [], datasets: [] }

    const counts = {}
    for (const f of data.features) {
      const cat = f.properties.CrimeCategory || 'Unknown'
      counts[cat] = (counts[cat] || 0) + 1
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const labels = sorted.map(([k]) => k)
    const values = sorted.map(([, v]) => v)

    return {
      labels,
      datasets: [{
        label: 'Incidents',
        data: values,
        backgroundColor: labels.map((cat, i) => categoryColor(cat, i)),
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 3,
      }],
    }
  }, [data])

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f9fafb',
        bodyColor: '#9ca3af',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => ` ${formatNumber(ctx.parsed.x)} incidents`,
        },
      },
    },
    scales: {
      x: {
        ...DARK_SCALE,
        beginAtZero: true,
        title: { ...DARK_SCALE.title, display: true, text: 'Number of Incidents' },
        ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) },
      },
      y: {
        ...DARK_SCALE,
        title: { ...DARK_SCALE.title, display: false },
      },
    },
  }

  const total = data?.features?.length || 0
  const topCat = chartData.labels?.[0] || 'N/A'
  const catCount = chartData.labels?.length || 0
  const avgPerCat = catCount > 0 && total > 0 ? Math.round(total / catCount) : 0

  return (
    <div>
      <div style={{ height: '360px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: '0.875rem' }}>
            No data available for the selected filters
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
        {[
          { label: 'Total Incidents', value: formatNumber(total), color: '#06b6d4' },
          { label: 'Top Category',    value: topCat,              color: '#22c55e', small: true },
          { label: 'Categories',      value: formatNumber(catCount), color: '#f97316' },
          { label: 'Avg per Category', value: formatNumber(avgPerCat), color: '#a78bfa' },
        ].map(({ label, value, color, small }) => (
          <div key={label} style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</p>
            <p style={{ fontSize: small ? '0.75rem' : '1rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TimelineChart
