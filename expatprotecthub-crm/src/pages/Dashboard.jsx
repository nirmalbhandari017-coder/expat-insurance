import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Badge, Empty } from '../components/ui.jsx'
import InboundActivations from '../components/InboundActivations.jsx'
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

const inRange = (date, from, to) => !!date && (!from || date >= from) && (!to || date <= to)

export default function Dashboard() {
  const { display, rate } = useCurrency()
  const [data, setData] = useState(null)
  const [mode, setMode] = useState('month')
  const [anchor, setAnchor] = useState(today())
  const [custom, setCustom] = useState({ from: '', to: '' })

  useEffect(() => {
    (async () => {
      await supabase.rpc('generate_due_commissions', { horizon_days: 400 })
      const [schedule, commissions, payouts, expenses] = await Promise.all([
        supabase.from('premium_payments').select('*, clients(id, name)').order('due_date'),
        supabase.from('commissions').select('*, clients(id, name)').order('due_date'),
        supabase.from('payouts')
          .select('*, person:people(full_name, is_owner), premium_payment:premium_payments(client_id)'),
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
    const live = schedule.filter((s) => s.status !== 'cancelled')

    const totalPremium = sumIn(live, display, rate, { amount: 'amount_due' })
    const collectedEver = sumIn(live, display, rate, { amount: 'amount_received' })
    const premiumReceived = sumIn(
      live.filter((s) => inRange(s.received_date, from, to)),
      display, rate, { amount: 'amount_received' },
    )
    const premiumOutstanding = Math.max(totalPremium - collectedEver, 0)

    const commissionEarned = sumIn(
      commissions.filter((c) => inRange(c.due_date, from, to)),
      display, rate, { amount: 'expected_amount' },
    )
    const commissionReceived = sumIn(
      commissions.filter((c) => c.status === 'received' && inRange(c.received_date, from, to)),
      display, rate, { amount: 'received_amount' },
    )

    const paidInPeriod = payouts.filter((p) => p.status === 'paid' && inRange(p.paid_date, from, to))
    const consultantPayouts = sumIn(
      paidInPeriod.filter((p) => !p.person?.is_owner), display, rate, { amount: 'net_amount' },
    )
    const ownerPayouts = sumIn(
      paidInPeriod.filter((p) => p.person?.is_owner), display, rate, { amount: 'net_amount' },
    )
    const owedRows = payouts.filter((p) => p.status !== 'paid' && p.status !== 'cancelled')
    const pendingPayouts = sumIn(owedRows, display, rate, { amount: 'net_amount' })

    const expenseTotal = sumIn(
      expenses.filter((e) => inRange(e.expense_date, from, to)), display, rate,
    )
    const personallyPaid = sumIn(
      expenses.filter((e) => e.paid_by === 'personal' && e.payment_status !== 'reimbursed'),
      display, rate,
    )

    // Owner distributions are a share of profit, not a cost of earning it, so
    // profit is struck before them and the retained figure comes after.
    const netProfit = commissionReceived - consultantPayouts - expenseTotal
    const retained = netProfit - ownerPayouts

    const overdueCommissions = commissions.filter((c) => c.status === 'overdue')
    const overdueInstalments = live.filter((s) => s.status === 'overdue')

    // commissions now link to the instalment that earns them, so each
    // upcoming premium can show what it is actually worth to the business.
    const commissionByInstalment = new Map(
      commissions.filter((cm) => cm.premium_payment_id).map((cm) => [cm.premium_payment_id, cm]),
    );

    return {
      commissionByInstalment,
      totalPremium, premiumReceived, premiumOutstanding, collectedEver,
      commissionEarned, commissionReceived,
      consultantPayouts, ownerPayouts, pendingPayouts, owedRows,
      expenseTotal, personallyPaid, netProfit, retained,
      overdueCommissions, overdueInstalments,
      upcoming: live
        .filter((s) => s.status === 'scheduled' || s.status === 'overdue')
        .slice(0, 6),
    }
  }, [data, display, rate, from, to])

  if (!m) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const money = (v) => fmt(v, display)
  const collectedPct = m.totalPremium > 0
    ? Math.min(100, (m.collectedEver / m.totalPremium) * 100)
    : 0
  const periodLabel = from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : 'All dates'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{periodLabel} · {display}</p>
        </div>
        <div className="filters" style={{ marginBottom: 0 }}>
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
      </div>

      <div className="dash-grid">
        {/* ---------------- Left: the money story ---------------- */}
        <div>
          <div className="hero">
            <div className="hero-label">Net profit · {periodLabel}</div>
            <div className={`hero-value ${m.netProfit < 0 ? 'neg' : ''}`}>{money(m.netProfit)}</div>
            <div className="hero-sub">
              Commission received, less consultant payouts and expenses
            </div>
            <div className="hero-split">
              <div>
                <div className="k">Retained</div>
                <div className="v">{money(m.retained)}</div>
              </div>
              <div>
                <div className="k">Owner distributions</div>
                <div className="v">{money(m.ownerPayouts)}</div>
              </div>
              <div>
                <div className="k">Still owed out</div>
                <div className="v">{money(m.pendingPayouts)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">How the profit is made up</div>
            <div className="pnl">
              <div className="pnl-row">
                <span className="label">Commission received</span>
                <span className="val">{money(m.commissionReceived)}</span>
              </div>
              <div className="pnl-row deduct">
                <span className="label">Consultant payouts</span>
                <span className="val">{money(m.consultantPayouts)}</span>
              </div>
              <div className="pnl-row deduct">
                <span className="label">Expenses</span>
                <span className="val">{money(m.expenseTotal)}</span>
              </div>
              <div className="pnl-row total rule">
                <span className="label">Net profit</span>
                <span className={`val ${m.netProfit >= 0 ? 'pos' : 'neg'}`}>{money(m.netProfit)}</span>
              </div>
              <div className="pnl-row deduct">
                <span className="label">Owner distributions</span>
                <span className="val">{money(m.ownerPayouts)}</span>
              </div>
              <div className="pnl-row total rule">
                <span className="label">Retained in the business</span>
                <span className={`val ${m.retained >= 0 ? 'pos' : 'neg'}`}>{money(m.retained)}</span>
              </div>
              <div className="pnl-row sub">
                <span className="label">Commission earned but not yet received</span>
                <span className="val">
                  {money(Math.max(m.commissionEarned - m.commissionReceived, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- Right: the book, and what needs doing ---------------- */}
        <div>
          <div className="card">
            <div className="card-title">
              Premium collected
              <span className="small muted">{collectedPct.toFixed(0)}% of the book</span>
            </div>
            <div className="progress"><span style={{ width: `${collectedPct}%` }} /></div>
            <div className="stat-strip" style={{ paddingTop: 0 }}>
              <div>
                <div className="k">Total premium</div>
                <div className="v">{money(m.totalPremium)}</div>
                <div className="s">all instalments</div>
              </div>
              <div>
                <div className="k">Received</div>
                <div className="v">{money(m.premiumReceived)}</div>
                <div className="s">this period</div>
              </div>
              <div>
                <div className="k">Outstanding</div>
                <div className={`v ${m.premiumOutstanding > 0 ? 'warn' : 'muted'}`}>
                  {money(m.premiumOutstanding)}
                </div>
                <div className="s">still to collect</div>
              </div>
            </div>
          </div>

          <InboundActivations />

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Needs attention</div>
            <div className="attn">
              {m.overdueInstalments.length === 0
                && m.overdueCommissions.length === 0
                && m.owedRows.length === 0
                && m.personallyPaid === 0 ? (
                <div className="attn-empty">Nothing outstanding. 🎉</div>
              ) : (
                <>
                  {m.overdueInstalments.length > 0 && (
                    <Link to="/clients" className="attn-item">
                      <span className="dot red" />
                      <span className="txt">
                        <span className="t">
                          {m.overdueInstalments.length} premium instalment
                          {m.overdueInstalments.length > 1 ? 's' : ''} overdue
                        </span>
                        <span className="d">Client hasn&apos;t paid — payouts wait on this</span>
                      </span>
                      <span className="amt">
                        {money(sumIn(m.overdueInstalments, display, rate, { amount: 'amount_due' }))}
                      </span>
                    </Link>
                  )}
                  {m.overdueCommissions.length > 0 && (
                    <Link to="/commissions" className="attn-item">
                      <span className="dot red" />
                      <span className="txt">
                        <span className="t">
                          {m.overdueCommissions.length} commission
                          {m.overdueCommissions.length > 1 ? 's' : ''} overdue
                        </span>
                        <span className="d">Owed to you by the insurer</span>
                      </span>
                      <span className="amt">
                        {money(sumIn(m.overdueCommissions, display, rate, { amount: 'expected_amount' }))}
                      </span>
                    </Link>
                  )}
                  {m.owedRows.length > 0 && (
                    <Link to="/payouts" className="attn-item">
                      <span className="dot yellow" />
                      <span className="txt">
                        <span className="t">
                          {m.owedRows.length} payout{m.owedRows.length > 1 ? 's' : ''} to pay
                        </span>
                        <span className="d">Premium received, recipient not yet paid</span>
                      </span>
                      <span className="amt">{money(m.pendingPayouts)}</span>
                    </Link>
                  )}
                  {m.personallyPaid > 0 && (
                    <Link to="/expenses" className="attn-item">
                      <span className="dot yellow" />
                      <span className="txt">
                        <span className="t">Expenses paid personally</span>
                        <span className="d">Not yet reimbursed</span>
                      </span>
                      <span className="amt">{money(m.personallyPaid)}</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">
              Next premium instalments
              <Link to="/clients" className="small">Clients →</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th><th>Due</th>
                    <th className="num">Premium</th>
                    <th className="num">Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.upcoming.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <Empty>
                          Nothing scheduled — generate a schedule from a client&apos;s Financials page.
                        </Empty>
                      </td>
                    </tr>
                  ) : m.upcoming.map((s) => {
                    const cm = m.commissionByInstalment.get(s.id)
                    return (
                      <tr key={s.id}>
                        <td><Link to={`/clients/${s.clients?.id}`}>{s.clients?.name ?? '—'}</Link></td>
                        <td>{fmtDate(s.due_date)}</td>
                        <td className="num">{fmt(Number(s.amount_due), s.currency)}</td>
                        <td className="num">
                          {cm ? (
                            <>
                              <strong>{fmt(Number(cm.expected_amount), cm.currency)}</strong>
                              <span className="cell-sub">due {fmtDate(cm.due_date)}</span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <Badge status={s.status === 'overdue' ? 'overdue' : 'pending'}>{s.status}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
