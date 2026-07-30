import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Badge, Empty } from '../components/ui.jsx'
import { fmtDate, today } from '../lib/format.js'
import { useCurrency, fmt, sumIn } from '../lib/currency.jsx'

/** Period presets. Current month is the default (spec §14). */
function periodRange(mode, anchor, custom) {
  if (mode === 'custom') return [custom.from || null, custom.to || null]
  const d = new Date(anchor + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth()
  const iso = (x) => x.toISOString().slice(0, 10)
  if (mode === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  if (mode === 'last_month') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
  if (mode === 'quarter') {
    const q = Math.floor(m / 3)
    return [iso(new Date(y, q * 3, 1)), iso(new Date(y, q * 3 + 3, 0))]
  }
  if (mode === 'year') return [iso(new Date(y, 0, 1)), iso(new Date(y, 12, 0))]
  return [null, null]
}

const inRange = (date, from, to) =>
  !!date && (!from || date >= from) && (!to || date <= to)

export default function Dashboard() {
  const { display, rate } = useCurrency()
  const [data, setData] = useState(null)
  const [mode, setMode] = useState('month')
  const [anchor, setAnchor] = useState(today())
  const [custom, setCustom] = useState({ from: '', to: '' })

  useEffect(() => {
    (async () => {
      await supabase.rpc('generate_due_commissions', { horizon_days: 60 })
      const [schedule, commissions, payouts, expenses] = await Promise.all([
        supabase.from('premium_payments').select('*, clients(id, name)').order('due_date'),
        supabase.from('commissions').select('*, clients(id, name)').order('due_date'),
        supabase.from('payouts')
          .select('*, person:people(full_name, is_owner), premium_payment:premium_payments(client_id, received_date)'),
        supabase.from('expenses').select('*').eq('is_draft', false),
      ])
      setData({
        schedule: schedule.data || [],
        commissions: commissions.data || [],
        payouts: payouts.data || [],
        expenses: expenses.data || [],
      })
    })()
  }, [])

  const [from, to] = periodRange(mode, anchor, custom)

  const m = useMemo(() => {
    if (!data) return null
    const { schedule, commissions, payouts, expenses } = data

    // Premium: the whole book, versus what has actually landed in the period.
    const totalPremium = sumIn(
      schedule.filter((s) => s.status !== 'cancelled'),
      display, rate, { amount: 'amount_due' },
    )
    const premiumReceived = sumIn(
      schedule.filter((s) => inRange(s.received_date, from, to)),
      display, rate, { amount: 'amount_received' },
    )
    const premiumOutstanding = sumIn(
      schedule.filter((s) => s.status !== 'cancelled' && s.status !== 'paid'),
      display, rate, { amount: 'amount_due' },
    ) - sumIn(
      schedule.filter((s) => s.status === 'partially_paid'),
      display, rate, { amount: 'amount_received' },
    )

    const commissionEarned = sumIn(
      commissions.filter((c) => inRange(c.due_date, from, to)),
      display, rate, { amount: 'expected_amount' },
    )
    const commissionReceived = sumIn(
      commissions.filter((c) => c.status === 'received' && inRange(c.received_date, from, to)),
      display, rate, { amount: 'received_amount' },
    )

    // A payout belongs to the period it was paid in; unpaid ones are shown
    // separately so they aren't mistaken for money already out the door.
    const paidInPeriod = payouts.filter((p) => p.status === 'paid' && inRange(p.paid_date, from, to))
    const consultantPayouts = sumIn(
      paidInPeriod.filter((p) => !p.person?.is_owner),
      display, rate, { amount: 'net_amount' },
    )
    const ownerPayouts = sumIn(
      paidInPeriod.filter((p) => p.person?.is_owner),
      display, rate, { amount: 'net_amount' },
    )
    const pendingPayouts = sumIn(
      payouts.filter((p) => p.status !== 'paid' && p.status !== 'cancelled'),
      display, rate, { amount: 'net_amount' },
    )

    const expenseTotal = sumIn(
      expenses.filter((e) => inRange(e.expense_date, from, to)),
      display, rate,
    )

    // Owner distributions are a share of profit, not a cost of earning it, so
    // profit is struck before them and the retained figure comes after.
    const netProfit = commissionReceived - consultantPayouts - expenseTotal
    const retained = netProfit - ownerPayouts

    const overdueCommissions = commissions.filter((c) => c.status === 'overdue')
    const overdueInstalments = schedule.filter((s) => s.status === 'overdue')
    const upcoming = schedule
      .filter((s) => s.status === 'scheduled' || s.status === 'overdue')
      .slice(0, 8)

    return {
      totalPremium, premiumReceived, premiumOutstanding,
      commissionEarned, commissionReceived,
      consultantPayouts, ownerPayouts, pendingPayouts,
      expenseTotal, netProfit, retained,
      overdueCommissions, overdueInstalments, upcoming,
      duePayouts: payouts.filter((p) => p.status !== 'paid' && p.status !== 'cancelled').slice(0, 8),
    }
  }, [data, display, rate, from, to])

  if (!m) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const money = (v) => fmt(v, display)
  const periodLabel = from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : 'All dates'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{periodLabel} · shown in {display}</p>
        </div>
      </div>

      <div className="filters">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="month">This month</option>
          <option value="last_month">Last month</option>
          <option value="quarter">This quarter</option>
          <option value="year">This year</option>
          <option value="custom">Custom range</option>
        </select>
        {mode === 'custom' ? (
          <>
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>
        ) : (
          <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} title="Any date inside the period" />
        )}
      </div>

      {/* Premium — the client's money */}
      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Total premium</div>
          <div className="value">{money(m.totalPremium)}</div>
          <div className="sub">whole book, all instalments</div>
        </div>
        <div className="kpi">
          <div className="label">Premium received</div>
          <div className="value">{money(m.premiumReceived)}</div>
          <div className="sub">in this period</div>
        </div>
        <div className="kpi danger">
          <div className="label">Outstanding premium</div>
          <div className="value">{money(m.premiumOutstanding)}</div>
          <div className="sub">{m.overdueInstalments.length} instalment(s) overdue</div>
        </div>
      </div>

      {/* Company revenue and what goes out */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Commission earned</div>
          <div className="value">{money(m.commissionEarned)}</div>
          <div className="sub">due in period</div>
        </div>
        <div className="kpi accent">
          <div className="label">Commission received</div>
          <div className="value">{money(m.commissionReceived)}</div>
          <div className="sub">{m.overdueCommissions.length} overdue</div>
        </div>
        <div className="kpi warn">
          <div className="label">Consultant payouts</div>
          <div className="value">{money(m.consultantPayouts)}</div>
          <div className="sub">paid in period</div>
        </div>
        <div className="kpi warn">
          <div className="label">Owner payouts</div>
          <div className="value">{money(m.ownerPayouts)}</div>
          <div className="sub">distributed in period</div>
        </div>
        <div className="kpi">
          <div className="label">Expenses</div>
          <div className="value">{money(m.expenseTotal)}</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className={m.netProfit >= 0 ? 'kpi accent' : 'kpi danger'}>
          <div className="label">Net profit</div>
          <div className="value">{money(m.netProfit)}</div>
          <div className="sub">commission received − consultant payouts − expenses</div>
        </div>
        <div className={m.retained >= 0 ? 'kpi' : 'kpi danger'}>
          <div className="label">Retained after owner distributions</div>
          <div className="value">{money(m.retained)}</div>
          <div className="sub">net profit − owner payouts</div>
        </div>
        <div className="kpi warn">
          <div className="label">Payouts still owed</div>
          <div className="value">{money(m.pendingPayouts)}</div>
          <div className="sub">all periods, not yet paid</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">
            Upcoming premium instalments
            <Link to="/clients" className="small">Clients →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Client</th><th>Due</th><th className="num">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {m.upcoming.length === 0 ? (
                  <tr><td colSpan={4}><Empty>Nothing scheduled. Generate a schedule from a client&apos;s Financials page.</Empty></td></tr>
                ) : m.upcoming.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/clients/${s.clients?.id}`}>{s.clients?.name ?? '—'}</Link>
                    </td>
                    <td>{fmtDate(s.due_date)}</td>
                    <td className="num">{fmt(Number(s.amount_due), s.currency)}</td>
                    <td>
                      <Badge status={s.status === 'overdue' ? 'overdue' : 'pending'}>{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Payouts owed
            <Link to="/payouts" className="small">All payouts →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Recipient</th><th>Basis</th><th className="num">Net owed</th></tr>
              </thead>
              <tbody>
                {m.duePayouts.length === 0 ? (
                  <tr><td colSpan={3}><Empty>Nothing owed.</Empty></td></tr>
                ) : m.duePayouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.person?.full_name ?? '—'}</strong>
                      {p.person?.is_owner && <span className="cell-sub">owner</span>}
                    </td>
                    <td className="small">{p.basis ?? '—'}</td>
                    <td className="num"><strong>{fmt(Number(p.net_amount), p.currency)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
