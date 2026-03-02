import React, { useState, useMemo, useCallback } from 'react'

function VirtualList({
  items,
  height = 200,
  itemHeight = 28,
  overscan = 8,
  renderItem,
  className = ''
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const totalHeight = (items?.length || 0) * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2
  const endIndex = Math.min(items.length, startIndex + visibleCount)
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex])

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div
      className={`relative overflow-y-auto ${className}`}
      style={{ height }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, idx) => {
          const i = startIndex + idx
          const top = i * itemHeight
          return (
            <div key={i} style={{ position: 'absolute', top, height: itemHeight, left: 0, right: 0 }}>
              {renderItem(item, i)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(VirtualList)
