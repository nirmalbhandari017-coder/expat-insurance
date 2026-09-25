import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Empty } from '../components/ui.jsx'
import InboundActivations from '../components/InboundActivations.jsx'
import { useCurrency, fmt, sumIn, convert } from '../lib/currency.jsx'
import { downloadCsv, stampedName } from '../lib/csv.js'

/**
 * Sales dashboard.
 *
 * How many clients were written each month, the premium they brought, the
 * commission that earned and at what rate. Deliberately not a P&L — expenses,
 * payouts and profit belong on their own pages.
 *
 * A sale counts in the month the client FIRST paid, not the month cover begins
 * and not once per instalment. A monthly-paying client pays twelve times a year
 * but is one sale, and Brett Wilson paid on 30 Jun for a policy starting 1 Sep,
 * so he is a June sale.
 */

const monthKey = (d) => (d ? String(d).slice(0, 7) : '')
const monthLabel = (key) =>
  new Date(key + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export default function Dashboard() {
  const { display, rate } = useCurrency()
  const [data, setData] = useState(null)

  useEffect(() => {
    (async () => {
      await supabase.rpc('generate_due_commissions', { horizon_days: 400 })
      const [clients, schedule, commissions] = await Promise.all([
        supabase.from('clients').select('*').neq('status', 'cancelled'),
        supabase.from('premium_payments')
          .select('client_id, received_date, amount_received, amount_usd, amount_thb, currency, status'),
        supabase.from('commissions')
          .select('client_id, status, expected_amount, received_amount, currency'),
      ])
      setData({
        clients: clients.data || [],
        schedule: schedule.data || [],
        commissions: commissions.data || [],
      })
    })()
  }, [])

  const m = useMemo(() => {
    if (!data) return null
    const { clients, schedule, commissions } = data
    const live = schedule.filter((s) => s.status !== 'cancelled')

    // The month a client was won = their earliest receipt.
    const firstPaid = new Map()
    for (const s of live) {
      if (!(Number(s.amount_received) > 0 && s.received_date)) continue
      const prev = firstPaid.get(s.client_id)
      if (!prev || s.received_date < prev) firstPaid.set(s.client_id, s.received_date)
    }

    const cur = (c) => c.currency || 'USD'
    const premiumOf = (c) => convert(Number(c.premium) || 0, cur(c), display, rate) || 0
    const commissionOf = (c) =>
      convert((Number(c.premium) || 0) * (Number(c.commission_pct) || 0) / 100,
        cur(c), display, rate) || 0

    // One bucket per month in which at least one client was won.
    const buckets = new Map()
    for (const c of clients) {
      const won = firstPaid.get(c.id)
      if (!won) continue
      const key = monthKey(won)
      const b = buckets.get(key) || { key, clients: 0, premium: 0, commission: 0, names: [] }
      b.clients += 1
      b.premium += premiumOf(c)
      b.commission += commissionOf(c)
      b.names.push(c.name)
      buckets.set(key, b)
    }
    const months = [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key))

    const written = clients.filter((c) => firstPaid.has(c.id))
    const totalPremiumWritten = written.reduce((t, c) => t + premiumOf(c), 0)
    const totalCommissionWritten = written.reduce((t, c) => t + commissionOf(c), 0)

    // Cash actually banked, as against business written.
    const premiumReceived = sumIn(live, display, rate, { amount: 'amount_received' })
    const commissionReceived = commissions
      .filter((c) => c.status === 'received')
      .reduce((t, c) => t + (convert(Number(c.received_amount) || 0, c.currency || 'USD', display, rate) || 0), 0)
    const commissionOutstanding = commissions
      .filter((c) => c.status !== 'received')
      .reduce((t, c) => t + (convert(Number(c.expected_amount) || 0, c.currency || 'USD', display, rate) || 0), 0)

    // Weighted, not the mean of the rates: 29.5% on a $9,885 premium matters
    // more than 37.5% on $912, and a plain mean would hide that.
    const avgRate = totalPremiumWritten > 0
      ? (totalCommissionWritten / totalPremiumWritten) * 100
      : 0

    return {
      months,
      peak: months.reduce((n, b) => Math.max(n, b.clients), 0),
      thisMonth: months[0],
      clientCount: written.length,
      totalPremiumWritten, totalCommissionWritten,
      premiumReceived, commissionReceived, commissionOutstanding,
      avgRate,
      unpaidClients: clients.length - written.length,
    }
  }, [data, display, rate])

  if (!m) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const money = (v) => fmt(v, display)

  function exportCsv() {
    downloadCsv(stampedName('sales-by-month'), [
      { key: 'key', header: 'Month' },
      { key: 'clients', header: 'Clients' },
      { header: 'Premium', format: (b) => b.premium.toFixed(2) },
      { header: 'Commission', format: (b) => b.commission.toFixed(2) },
      { header: 'Average rate %', format: (b) => (b.premium > 0 ? (b.commission / b.premium * 100).toFixed(2) : '') },
      { header: 'Currency', format: () => display },
      { header: 'Clients won', format: (b) => b.names.join(' / ') },
    ], m.months)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Business written, by the month the client paid · {display}</p>
        </div>
        <button className="btn outline" onClick={exportCsv} disabled={!m.months.length}>
          Export CSV
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Clients written</div>
          <div className="value">{m.clientCount}</div>
          <div className="sub">
            {m.thisMonth ? `${m.thisMonth.clients} in ${monthLabel(m.thisMonth.key)}` : 'none yet'}
          </div>
        </div>

        <div className="kpi">
          <div className="label">Total premium</div>
          <div className="value">{money(m.totalPremiumWritten)}</div>
          <div className="sub">{money(m.premiumReceived)} banked to date</div>
        </div>

        <div className="kpi">
          <div className="label">Commission received</div>
          <div className="value">{money(m.commissionReceived)}</div>
          <div className="sub">{money(m.commissionOutstanding)} still to come</div>
        </div>

        <div className="kpi">
          <div className="label">Average commission rate</div>
          <div className="value">{m.avgRate.toFixed(2)}%</div>
          <div className="sub">weighted by premium</div>
        </div>
      </div>

      <InboundActivations />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Each month</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Clients</th>
                <th className="num">Premium</th>
                <th className="num">Commission</th>
                <th className="num">Avg rate</th>
              </tr>
            </thead>
            <tbody>
              {m.months.length === 0 ? (
                <tr><td colSpan={5}><Empty>No premium received yet.</Empty></td></tr>
              ) : m.months.map((b) => (
                <tr key={b.key}>
                  <td>
                    <strong>{monthLabel(b.key)}</strong>
                    <span className="cell-sub" title={b.names.join(', ')}>
                      {b.names.slice(0, 3).join(', ')}
                      {b.names.length > 3 && ` +${b.names.length - 3} more`}
                    </span>
                  </td>
                  <td>
                    <div className="month-bar">
                      <span style={{ width: `${m.peak ? (b.clients / m.peak) * 100 : 0}%` }} />
                      <b>{b.clients}</b>
                    </div>
                  </td>
                  <td className="num">{money(b.premium)}</td>
                  <td className="num">{money(b.commission)}</td>
                  <td className="num">
                    {b.premium > 0 ? `${(b.commission / b.premium * 100).toFixed(2)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {m.months.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td>
                    Total
                    <span className="cell-sub">
                      {m.months.length} month{m.months.length !== 1 && 's'}
                    </span>
                  </td>
                  <td>{m.clientCount}</td>
                  <td className="num">{money(m.totalPremiumWritten)}</td>
                  <td className="num">{money(m.totalCommissionWritten)}</td>
                  <td className="num">{m.avgRate.toFixed(2)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {m.unpaidClients > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            {m.unpaidClients} client{m.unpaidClients !== 1 && 's'} with no premium received yet,
            not counted above. <Link to="/clients">See clients →</Link>
          </p>
        )}
      </div>
    </>
  )
}
