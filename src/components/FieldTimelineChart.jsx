import React, { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const DARK_SCALE = {
  grid: { color: 'rgba(255,255,255,0.06)' },
  ticks: { color: '#9ca3af' },
  title: { color: '#9ca3af' },
}

function colorForLabel(label, idx) {
  let h = 0
  const s = String(label)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = ((h % 360) + idx * 17) % 360
  return {
    fill: `hsla(${hue}, 65%, 50%, 0.65)`,
    stroke: `hsl(${hue}, 65%, 38%)`,
  }
}

function FieldTimelineChart({ fieldKey, title, labels, series, totalIncidents, onSeriesClick }) {
  const chartData = useMemo(() => {
    const datasets = (series || []).map((s, idx) => {
      const c = colorForLabel(s.label, idx)
      return {
        label: s.label,
        data: s.data,
        backgroundColor: c.fill,
        borderColor: c.stroke,
        borderWidth: 1,
      }
    })
    return { labels: labels || [], datasets }
  }, [labels, series])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_event, elements, chart) => {
      try {
        if (!onSeriesClick || !elements?.length) return
        const label = chart?.data?.datasets?.[elements[0]?.datasetIndex]?.label
        if (label) onSeriesClick(fieldKey, label)
      } catch (e) { /* ignore */ }
    },
    plugins: {
      legend: {
        position: 'right',
        maxHeight: 420,
        labels: { color: '#9ca3af', boxWidth: 10, padding: 8, font: { size: 11 } },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f9fafb',
        bodyColor: '#9ca3af',
        borderColor: '#374151',
        borderWidth: 1,
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
        ticks: { ...DARK_SCALE.ticks, maxTicksLimit: 15 },
        title: { ...DARK_SCALE.title, display: true, text: 'Year–Month' },
      },
      y: {
        ...DARK_SCALE,
        stacked: true,
        beginAtZero: true,
        ticks: { ...DARK_SCALE.ticks, callback: (v) => formatNumber(v) },
        title: { ...DARK_SCALE.title, display: true, text: 'Incident Count' },
      },
    },
  }), [fieldKey, onSeriesClick])

  return (
    <div>
      <div style={{ height: '520px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: '0.875rem' }}>
            No data available for the selected filters
          </div>
        )}
      </div>
      <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#4b5563' }}>
        Click a series in the chart to filter by that value. Stacked monthly counts, top values + "Other" bucket.
      </p>
    </div>
  )
}

export default FieldTimelineChart
