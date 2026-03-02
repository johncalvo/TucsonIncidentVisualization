import React, { useMemo, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, BarElement, LineElement, Filler, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, LineElement, Filler, Title, Tooltip, Legend)

function TimelineVolumeChart({ data }) {
  const [view, setView] = useState('stacked') // 'stacked' | 'volume'
  const [avgWindow, setAvgWindow] = useState(6) // months for rolling average

  const chartData = useMemo(() => {
    if (!data || !data.features || data.features.length === 0) {
      return { labels: [], barDatasets: [], lineDatasets: [] }
    }

    // Group incidents by YEAR-MONTH and category
    const incidentsByYearMonth = {}
    const categoryByYearMonth = {}
    
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const monthMap = {}
    monthOrder.forEach((month, idx) => {
      monthMap[month] = (idx + 1).toString().padStart(2, '0')
    })

    for (const feature of data.features) {
      const month = feature.properties.MONTH_OCCU_String
      const year = feature.properties.YEAR_OCCU || 'Unknown'
      if (!month || year === 'Unknown') continue

      const yearMonth = `${year}-${monthMap[month]}`

      if (!incidentsByYearMonth[yearMonth]) {
        incidentsByYearMonth[yearMonth] = 0
        categoryByYearMonth[yearMonth] = {}
      }
      incidentsByYearMonth[yearMonth]++

      const category = feature.properties.CrimeCategory || 'Unknown'
      categoryByYearMonth[yearMonth][category] = (categoryByYearMonth[yearMonth][category] || 0) + 1
    }

    // Sort by year-month chronologically
    const sortedYearMonths = Object.keys(incidentsByYearMonth).sort()

    const allCategories = [...new Set(
      Object.values(categoryByYearMonth).flatMap(cats => Object.keys(cats))
    )].sort()

    // Colors for categories
    const getColorForCategory = (idx) => {
      const hue = (idx * 137.5) % 360
      return `hsl(${hue}, 70%, 50%)`
    }

    // Stacked bar datasets per category
    const barDatasets = allCategories.map((category, idx) => {
      const color = getColorForCategory(idx)
      return {
        label: category,
        data: sortedYearMonths.map(yearMonth => categoryByYearMonth[yearMonth]?.[category] || 0),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      }
    })

    // Totals per month for volume view
    const totals = sortedYearMonths.map((ym) => incidentsByYearMonth[ym] || 0)

    // Rolling average helper
    const rollingAvg = (arr, window) => {
      const w = Math.max(1, window | 0)
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
        label: 'Incidents',
        data: totals,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.25)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: `Rolling Avg (${avgWindow} Mo)`,
        data: rollingAvg(totals, avgWindow),
        borderColor: '#1e40af',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      },
    ]

    return {
      labels: sortedYearMonths,
      barDatasets,
      lineDatasets,
    }
  }, [data, avgWindow])

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'right',
        maxHeight: 500
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const label = context.dataset?.label ? `${context.dataset.label}: ` : ''
            const val = typeof context.parsed?.y === 'number' ? context.parsed.y : context.raw
            return `${label}${formatNumber(val)}`
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Year-Month (2021-2025)'
        },
        ticks: {
          maxTicksLimit: 15
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Incidents'
        },
        ticks: {
          callback: (value) => formatNumber(value)
        }
      }
    }
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const label = context.dataset?.label ? `${context.dataset.label}: ` : ''
            const val = typeof context.parsed?.y === 'number' ? context.parsed.y : context.raw
            return `${label}${formatNumber(val)}`
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Year-Month (2021-2025)' },
        ticks: { maxTicksLimit: 15 },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Incident Count' },
        ticks: { callback: (value) => formatNumber(value) },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setView('stacked')}
            className={`px-3 py-1 rounded-md text-sm font-semibold ${view === 'stacked' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Stacked Bars
          </button>
          <button
            onClick={() => setView('volume')}
            className={`px-3 py-1 rounded-md text-sm font-semibold ${view === 'volume' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Volume + Avg
          </button>
        </div>
        {view === 'volume' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Avg Window:</span>
            {[1, 3, 6].map((w) => (
              <button
                key={w}
                onClick={() => setAvgWindow(w)}
                className={`px-2 py-1 rounded-md ${avgWindow === w ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700'}`}
              >
                {w} Mo
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: '600px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          view === 'stacked' ? (
            <Bar data={{ labels: chartData.labels, datasets: chartData.barDatasets }} options={barOptions} />
          ) : (
            <Line data={{ labels: chartData.labels, datasets: chartData.lineDatasets }} options={lineOptions} />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No data available for the selected filters</p>
          </div>
        )}
      </div>

      <div className="bg-gray-50 p-3 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>{formatNumber(data?.features?.length || 0)}</strong> total incidents • 
          {view === 'stacked' ? (
            <>
              <strong> {formatNumber(chartData.barDatasets.length)}</strong> crime types • Stacked monthly counts by category
            </>
          ) : (
            <>
              Volume with <strong>{avgWindow} Mo</strong> rolling average
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export default TimelineVolumeChart
