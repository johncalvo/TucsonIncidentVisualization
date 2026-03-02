import React from 'react'

/**
 * Pulsing "LIVE" badge with elapsed time, shown when a court session is active.
 */
function LiveIndicator({ startedAt }) {
  const [elapsed, setElapsed] = React.useState('')

  React.useEffect(() => {
    if (!startedAt) return

    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      if (h > 0) {
        setElapsed(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      } else {
        setElapsed(`${m}:${String(s).padStart(2, '0')}`)
      }
    }

    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt])

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.25rem 0.625rem',
        background: 'rgba(239,68,68,0.15)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#ef4444',
        letterSpacing: '0.05em',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#ef4444',
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }}
      />
      LIVE
      {elapsed && (
        <span style={{ fontWeight: 400, color: '#fca5a5', marginLeft: '0.125rem' }}>
          {elapsed}
        </span>
      )}
    </span>
  )
}

export default LiveIndicator
