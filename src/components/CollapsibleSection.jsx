import React, { useState } from 'react'

function CollapsibleSection({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section style={{ background: '#111827', borderRadius: '0.75rem', border: '1px solid #1f2937' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f9fafb' }}>{title}</h2>
          {subtitle ? <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{subtitle}</p> : null}
        </div>
        <span style={{ color: '#4b5563', fontSize: '1rem', lineHeight: 1, marginLeft: '0.75rem', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div style={{ padding: '0 1.25rem 1.25rem' }}>{children}</div> : null}
    </section>
  )
}

export default CollapsibleSection
