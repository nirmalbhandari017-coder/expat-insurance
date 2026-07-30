const FMT = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  THB: new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }),
}

export function money(amount, currency = 'USD') {
  if (amount == null || isNaN(amount)) return '—'
  return (FMT[currency] || FMT.USD).format(amount)
}

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function pct(v) {
  if (v == null) return '—'
  return `${Number(v)}%`
}

export const today = () => new Date().toISOString().slice(0, 10)

export function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''
}

export const FREQUENCY_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
}

export const EXPENSE_CATEGORIES = [
  'Advertising',
  'Software / Subscriptions',
  'Contractor / Freelancer',
  'Office / Admin',
  'Other',
]
