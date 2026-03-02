import React, { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatNumber } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, Title, Tooltip, Legend)

function TimelineChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || !data.features || data.features.length === 0) {
      return { labels: [], datasets: [] }
    }

    console.time('Crime category chart generation')

    // Group incidents by crime category
    const incidentsByCategory = {}

    data.features.forEach(feature => {
      const category = feature.properties.CrimeCategory || 'Unknown'
      incidentsByCategory[category] = (incidentsByCategory[category] || 0) + 1
    })

    // Sort categories by incident count (highest to lowest)
    const sortedCategories = Object.entries(incidentsByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
    
    const categoryIncidents = sortedCategories.map(cat => incidentsByCategory[cat])

    console.log('Crime categories found:', sortedCategories)

    const categoryColors = {
      'Violent': '#e74c3c',
      'Property': '#3498db',
      'Quality of Life': '#f39c12',
      'Violation': '#95a5a6',
      'Emergency': '#c0392b',
      'Traffic': '#16a085',
      'Other': '#9b59b6'
    }

    const dataset = {
      label: 'Incidents',
      data: categoryIncidents,
      backgroundColor: sortedCategories.map(cat => categoryColors[cat] || `hsl(${Math.random() * 360}, 70%, 60%)`),
      borderColor: sortedCategories.map(cat => categoryColors[cat] || `hsl(${Math.random() * 360}, 70%, 40%)`),
      borderWidth: 2
    }

    console.timeEnd('Crime category chart generation')

    return {
      labels: sortedCategories,
      datasets: [dataset]
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
        callbacks: {
          label: (context) => `${formatNumber(context.parsed.x)} incidents`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: { display: true, text: 'Number of Incidents' },
        ticks: { callback: (value) => formatNumber(value) },
      },
      y: {
        title: { display: true, text: 'Crime Category' },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div style={{ height: '400px', position: 'relative' }}>
        {chartData.labels.length > 0 ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No data available for the selected filters</p>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-gray-600">Total Events</p>
          <p className="font-bold text-blue-600">{formatNumber(data?.features?.length || 0)}</p>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <p className="text-gray-600">Top Category</p>
          <p className="font-bold text-green-600 text-xs">
            {chartData.labels?.[0] || 'N/A'}
          </p>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <p className="text-gray-600">Categories</p>
          <p className="font-bold text-red-600">{formatNumber(chartData.labels?.length || 0)}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <p className="text-gray-600">Avg per Cat</p>
          <p className="font-bold text-purple-600">
            {data?.features?.length > 0 && chartData.labels?.length > 0
              ? formatNumber(Math.round(data.features.length / chartData.labels.length))
              : 'N/A'
            }
          </p>
        </div>
      </div>
    </div>
  )
}

export default TimelineChart
