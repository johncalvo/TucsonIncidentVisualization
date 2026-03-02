import React, { useMemo, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, BarElement, LineElement, Filler, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, LineElement, Filler, Title, Tooltip, Legend)

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

function categoryColor(idx) {
  const hue = (idx * 137.5) % 360
  return `hsl(${hue}, 65%, 52%)`
}

function TimelineVolumeChart({ data }) {
  const [view, setView] = useState('stacked') // 'stacked' | 'volume'
  const [avgWindow, setAvgWindow] = useState(6)

  const chartData = useMemo(() => {
    if (!data?.features?.length) return { labels: [], barDatasets: [], lineDatasets: [] }

    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const monthMap = {}
    monthOrder.forEach((m, i) => { monthMap[m] = String(i + 1).padStart(2, '0') })

    const incidentsByYM = {}
    const categoryByYM = {}

    for (const f of data.features) {
      const month = f.properties.MONTH_OCCU_String
      const year = f.properties.YEAR_OCCU
      if (!month || !year) continue
      const ym = `${year}-${monthMap[month]}`
      incidentsByYM[ym] = (incidentsByYM[ym] || 0) + 1
      if (!categoryByYM[ym]) categoryByYM[ym] = {}
      const cat = f.properties.CrimeCategory || 'Unknown'
      categoryByYM[ym][cat] = (categoryByYM[ym][cat] || 0) + 1
    }

    const sortedYMs = Object.keys(incidentsByYM).sort()
    const allCats = [...new Set(Object.values(categoryByYM).flatMap(c => Object.keys(c)))].sort()

    const barDatasets = allCats.map((cat, idx) => {
      const color = categoryColor(idx)
      return {
        label: cat,
        data: sortedYMs.map(ym => categoryByYM[ym]?.[cat] || 0),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        borderRadius: 0,
      }
    })

    const totals = sortedYMs.map(ym => incidentsByYM[ym] || 0)

    const rollingAvg = (arr, w) => {
      const out = new Array(arr.length)
      let sum = 0
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i]
        if (i >= w) sum -= arr[i - w]
        out[i] = Math.round(sum / Math.min(i + 1, w))
      }
      return out
    }

    const lineDatasets = [
      {
        label: 'Monthly Total',
        data: totals,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: `${avgWindow}-Mo Avg`,
        data: rollingAvg(totals, avgWindow),
        borderColor: '#f97316',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      },
    ]

    return { labels: sortedYMs, barDatasets, lineDatasets }
  }, [data, avgWindow])

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'right',
        maxHeight: 500,
        labels: { color: '#9ca3af', boxWidth: 10, padding: 8, font: { size: 11 } },
      },
      title: { display: false },
      tooltip: {
        ...DARK_TOOLTIP,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
            const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw
            return ` ${lbl}${formatNumber(val)}`
          },
        },
      },
    },
    scales: {
      x: {
        ...DARK_SCALE,
        stacked: true,
        title: { ...DARK_SCALE.title, display: true, text: 'Year–Month' },
        ticks: { ...DARK_SCALE.ticks, maxTicksLimit: 15 },
      },
      y: {
        ...DARK_SCALE,
        stacked: true,
        beginAtZero: true,
        title: { ...DARK_SCALE.title, display: true, text: 'Incidents' },
        ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) },
      },
    },
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: '#9ca3af', boxWidth: 12 } },
      title: { display: false },
      tooltip: {
        ...DARK_TOOLTIP,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
            const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw
            return ` ${lbl}${formatNumber(val)}`
          },
        },
      },
    },
    scales: {
      x: {
        ...DARK_SCALE,
        title: { ...DARK_SCALE.title, display: true, text: 'Year–Month' },
        ticks: { ...DARK_SCALE.ticks, maxTicksLimit: 15 },
      },
      y: {
        ...DARK_SCALE,
        beginAtZero: true,
        title: { ...DARK_SCALE.title, display: true, text: 'Incident Count' },
        ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) },
      },
    },
  }

  const btnBase = { padding: '0.3rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s' }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        {['stacked', 'volume'].map((mode) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            style={{
              ...btnBase,
              borderColor: view === mode ? '#06b6d4' : '#374151',
              background: view === mode ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: view === mode ? '#06b6d4' : '#6b7280',
            }}
          >
            {mode === 'stacked' ? 'Stacked Bars' : 'Volume + Avg'}
          </button>
        ))}

        {view === 'volume' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Avg window:</span>
            {[1, 3, 6].map((w) => (
              <button
                key={w}
                onClick={() => setAvgWindow(w)}
                style={{
                  ...btnBase,
                  borderColor: avgWindow === w ? '#f97316' : '#374151',
                  background: avgWindow === w ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: avgWindow === w ? '#f97316' : '#6b7280',
                  padding: '0.2rem 0.5rem',
                }}
              >
                {w} mo
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: '520px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          view === 'stacked' ? (
            <Bar data={{ labels: chartData.labels, datasets: chartData.barDatasets }} options={barOptions} />
          ) : (
            <Line data={{ labels: chartData.labels, datasets: chartData.lineDatasets }} options={lineOptions} />
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: '0.875rem' }}>
            No data available for the selected filters
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1f2937', fontSize: '0.8125rem', color: '#6b7280' }}>
        <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatNumber(data?.features?.length || 0)}</span> incidents
        {view === 'stacked' ? (
          <> · <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{chartData.barDatasets.length}</span> crime categories · stacked monthly counts</>
        ) : (
          <> · volume with <span style={{ color: '#f97316', fontWeight: 600 }}>{avgWindow}-month</span> rolling average</>
        )}
      </div>
    </div>
  )
}

export default TimelineVolumeChart
