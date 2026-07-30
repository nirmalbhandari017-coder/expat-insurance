import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Empty } from '../components/ui.jsx'
import { money, fmtDate, monthKey } from '../lib/format.js'

export default function Reports() {
  const [commissions, setCommissions] = useState(null)
  const [payouts, setPayouts] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [currency, setCurrency] = useState('USD')
  const [granularity, setGranularity] = useState('month') // month | quarter | year

  useEffect(() => {
    (async () => {
      const [c, p, e] = await Promise.all([
        supabase.from('commissions').select('*'),
        supabase.from('payouts').select('*, commissions(received_date)'),
        supabase.from('expenses').select('*').eq('is_draft', false),
      ])
      setCommissions(c.data || [])
      setPayouts(p.data || [])
      setExpenses(e.data || [])
    })()
  }, [])

  const periodOf = (dateStr) => {
    if (!dateStr) return null
    const [y, m] = dateStr.split('-').map(Number)
    if (granularity === 'year') return String(y)
    if (granularity === 'quarter') return `${y} Q${Math.ceil(m / 3)}`
    return dateStr.slice(0, 7)
  }

  const pnl = useMemo(() => {
    if (!commissions || !payouts || !expenses) return []
    const rows = {}
    const bucket = (key) => (rows[key] ??= { income: 0, taxReserve: 0, payouts: 0, expenses: 0 })

    for (const c of commissions) {
      if (c.status !== 'received' || c.currency !== currency) continue
      const k = periodOf(c.received_date)
      if (!k) continue
      const b = bucket(k)
      b.income += Number(c.received_amount || 0)
      b.taxReserve += Number(c.tax_reserve_amount || 0)
    }
    for (const p of payouts) {
      if (p.currency !== currency) continue
      const k = periodOf(p.commissions?.received_date)
      if (!k) continue
      bucket(k).payouts += Number(p.net_amount || 0)
    }
    for (const e of expenses) {
      if (e.currency !== currency) continue
      const k = periodOf(e.expense_date)
      if (!k) continue
      bucket(k).expenses += Number(e.amount || 0)
    }
    return Object.entries(rows)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, v]) => ({
        period, ...v,
        net: v.income - v.payouts - v.taxReserve - v.expenses,
      }))
  }, [commissions, payouts, expenses, currency, granularity])

  const forecast = useMemo(() => {
    if (!commissions) return []
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 90)
    return commissions
      .filter((c) => c.status !== 'received' && c.currency === currency)
      .filter((c) => new Date(c.due_date) <= horizon)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [commissions, currency])

  const forecastByMonth = useMemo(() => {
    const m = {}
    for (const c of forecast) {
      const k = monthKey(c.due_date)
      m[k] = (m[k] || 0) + Number(c.expected_amount)
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
  }, [forecast])

  if (!commissions) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Profit & loss and cash-flow forecast. Each currency is reported separately — no FX conversion.</p>
        </div>
      </div>

      <div className="filters">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="USD">USD</option>
          <option value="THB">THB</option>
        </select>
        <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
          <option value="month">Monthly</option>
          <option value="quarter">Quarterly</option>
          <option value="year">Annual</option>
        </select>
      </div>

      <div className="card">
        <div className="card-title">Profit & Loss ({currency})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Commissions received</th>
                <th className="num">Consultant payouts (net)</th>
                <th className="num">Tax reserve</th>
                <th className="num">Expenses</th>
                <th className="num">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {pnl.length === 0 ? (
                <tr><td colSpan={6}><Empty>No received commissions or expenses in {currency} yet.</Empty></td></tr>
              ) : pnl.map((r) => (
                <tr key={r.period}>
                  <td><strong>{r.period}</strong></td>
                  <td className="num">{money(r.income, currency)}</td>
                  <td className="num">{money(r.payouts, currency)}</td>
                  <td className="num">{money(r.taxReserve, currency)}</td>
                  <td className="num">{money(r.expenses, currency)}</td>
                  <td className="num" style={{ color: r.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    <strong>{money(r.net, currency)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Cash-flow forecast — next 90 days ({currency})</div>
        <div className="card-body">
          {forecastByMonth.length === 0 ? (
            <Empty>No upcoming {currency} commissions in the next 90 days.</Empty>
          ) : (
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              {forecastByMonth.map(([m, amt]) => (
                <div className="kpi accent" key={m}>
                  <div className="label">{m}</div>
                  <div className="value">{money(amt, currency)}</div>
                  <div className="sub">expected commissions due</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {forecast.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Due date</th><th className="num">Expected</th><th>Status</th></tr>
              </thead>
              <tbody>
                {forecast.slice(0, 12).map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.due_date)}</td>
                    <td className="num">{money(c.expected_amount, currency)}</td>
                    <td className="muted small">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
