import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

/**
 * Display currency is a *view* setting only. Every transaction keeps its own
 * original amount and currency in the database; these helpers just choose which
 * stored equivalent to show. Nothing here ever converts and saves.
 */
const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [display, setDisplay] = useState(() => localStorage.getItem('crm.display') || 'USD')
  const [rate, setRate] = useState(36.5)

  useEffect(() => {
    supabase
      ?.from('app_settings')
      .select('default_usd_thb_rate, display_currency')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (!data) return
        setRate(Number(data.default_usd_thb_rate) || 36.5)
        // A saved preference on this device wins over the org default.
        if (!localStorage.getItem('crm.display')) setDisplay(data.display_currency || 'USD')
      })
  }, [])

  function choose(cur) {
    setDisplay(cur)
    localStorage.setItem('crm.display', cur)
  }

  return (
    <CurrencyContext.Provider value={{ display, setDisplay: choose, rate }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)

const FMT = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  THB: new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }),
}

/** Format a raw amount in a known currency (no conversion). */
export function fmt(amount, currency = 'USD') {
  if (amount == null || isNaN(amount)) return '—'
  return (FMT[currency] || FMT.USD).format(amount)
}

/**
 * Show a stored row in the chosen display currency, preferring the pre-computed
 * amount_usd / amount_thb columns and falling back to a live conversion at the
 * given rate when a row predates them.
 */
export function displayAmount(row, display, rate, keys = {}) {
  const amtKey = keys.amount ?? 'amount'
  const curKey = keys.currency ?? 'currency'
  const usdKey = keys.usd ?? 'amount_usd'
  const thbKey = keys.thb ?? 'amount_thb'

  const original = Number(row?.[amtKey])
  const currency = row?.[curKey] ?? 'USD'
  if (original == null || isNaN(original)) return '—'

  if (display === currency) return fmt(original, currency)

  const stored = display === 'USD' ? row?.[usdKey] : row?.[thbKey]
  if (stored != null) return fmt(Number(stored), display)

  const r = Number(rate) || 36.5
  const converted = display === 'USD' ? original / r : original * r
  return fmt(converted, display)
}

/** Sum a list into the display currency, converting per row as needed. */
export function sumIn(rows, display, rate, keys = {}) {
  const amtKey = keys.amount ?? 'amount'
  const curKey = keys.currency ?? 'currency'
  const usdKey = keys.usd ?? 'amount_usd'
  const thbKey = keys.thb ?? 'amount_thb'
  const r = Number(rate) || 36.5

  return (rows ?? []).reduce((total, row) => {
    const original = Number(row?.[amtKey])
    if (original == null || isNaN(original)) return total
    const currency = row?.[curKey] ?? 'USD'
    if (display === currency) return total + original

    const stored = display === 'USD' ? row?.[usdKey] : row?.[thbKey]
    if (stored != null) return total + Number(stored)
    return total + (display === 'USD' ? original / r : original * r)
  }, 0)
}

/** Convert a single figure for display, given its own currency. */
export function convert(amount, from, display, rate) {
  const a = Number(amount)
  if (a == null || isNaN(a)) return null
  if (from === display) return a
  const r = Number(rate) || 36.5
  return display === 'USD' ? a / r : a * r
}
