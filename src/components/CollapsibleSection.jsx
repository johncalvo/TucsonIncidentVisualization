import React, { useState } from 'react'

function CollapsibleSection({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="bg-white rounded-lg shadow border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p> : null}
        </div>
        <span className="text-gray-400 text-lg leading-none">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  )
}

export default CollapsibleSection
