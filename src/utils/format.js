const US_NUMBER = new Intl.NumberFormat('en-US')

export function formatNumber(value) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '0'
  return US_NUMBER.format(n)
}
