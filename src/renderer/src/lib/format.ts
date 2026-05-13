const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const CURRENCY_NO_SIGN = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00'
  return CURRENCY.format(amount)
}

export function formatCurrencyAbs(amount: number): string {
  return `$${CURRENCY_NO_SIGN.format(Math.abs(amount))}`
}

export function formatDate(iso: string): string {
  // Accepts `YYYY-MM-DD`; falls back to `Date.parse` for anything else.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split('-')
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`
  }
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const dt = new Date(t)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export function formatDateLong(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const dt = new Date(t)
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
