import React, { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function colorForLabel(label, idx) {
  // Stable-ish color: hash label into a hue.
  let h = 0
  const s = String(label)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = (h % 360)
  const sat = 70
  const light = 48
  const alpha = 0.55
  // fallback: spread by idx a bit
  const adjHue = (hue + idx * 17) % 360
  return {
    fill: `hsla(${adjHue}, ${sat}%, ${light}%, ${alpha})`,
    stroke: `hsl(${adjHue}, ${sat}%, ${Math.max(25, light - 10)}%)`,
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
        if (!onSeriesClick) return
        if (!elements || elements.length === 0) return
        const el = elements[0]
        const datasetIndex = el?.datasetIndex
        if (datasetIndex === null || datasetIndex === undefined) return
        const label = chart?.data?.datasets?.[datasetIndex]?.label
        if (!label) return
        onSeriesClick(fieldKey, label)
      } catch (e) {
        // ignore
      }
    },
    plugins: {
      legend: { position: 'right', maxHeight: 420 },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
            const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw
            return `${label}${formatNumber(val)}`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { maxTicksLimit: 15 },
        title: { display: true, text: 'Year-Month' },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { callback: (v) => formatNumber(v) },
        title: { display: true, text: 'Incident Count' },
      },
    },
  }), [fieldKey, onSeriesClick])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="text-xs text-gray-600">{formatNumber(totalIncidents || 0)} incidents</div>
      </div>

      <div style={{ height: '520px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No data available for the selected filters</p>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Stacked monthly counts for top values (with “Other” bucket).
      </p>
    </div>
  )
}

export default FieldTimelineChart
