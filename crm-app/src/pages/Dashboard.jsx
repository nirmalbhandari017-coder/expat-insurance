import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, monthKey, today } from '../lib/format.js'

export default function Dashboard() {
  const [commissions, setCommissions] = useState(null)
  const [payouts, setPayouts] = useState(null)

  useEffect(() => {
    (async () => {
      await supabase.rpc('generate_due_commissions', { horizon_days: 60 })
      const [c, p] = await Promise.all([
        supabase.from('commissions').select('*, clients(name)').order('due_date'),
        supabase.from('payouts').select('*, consultants(name), commissions(clients(name))').eq('status', 'pending'),
      ])
      setCommissions(c.data || [])
      setPayouts(p.data || [])
    })()
  }, [])

  if (commissions === null || payouts === null) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>
  }

  const thisMonth = monthKey(today())
  const sum = (rows, f) => rows.reduce((a, r) => a + Number(f(r) || 0), 0)
  const byCur = (rows, f) => ({
    USD: sum(rows.filter((r) => r.currency === 'USD'), f),
    THB: sum(rows.filter((r) => r.currency === 'THB'), f),
  })

  const receivedThisMonth = commissions.filter(
    (c) => c.status === 'received' && monthKey(c.received_date) === thisMonth
  )
  const overdue = commissions.filter((c) => c.status === 'overdue')
  const upcoming = commissions.filter((c) => c.status !== 'received').slice(0, 8)

  const recIn = byCur(receivedThisMonth, (r) => r.received_amount)
  const overdueAmt = byCur(overdue, (r) => r.expected_amount)
  const pendingOut = byCur(payouts, (r) => r.net_amount)

  const fmtPair = (o) => [
    o.USD ? money(o.USD, 'USD') : null,
    o.THB ? money(o.THB, 'THB') : null,
  ].filter(Boolean).join(' + ') || money(0, 'USD')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Live view of money in, money owed, and money out.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Received this month</div>
          <div className="value">{fmtPair(recIn)}</div>
          <div className="sub">{receivedThisMonth.length} commission{receivedThisMonth.length !== 1 && 's'}</div>
        </div>
        <div className="kpi danger">
          <div className="label">Overdue commissions</div>
          <div className="value">{fmtPair(overdueAmt)}</div>
          <div className="sub">{overdue.length} record{overdue.length !== 1 && 's'} past due</div>
        </div>
        <div className="kpi warn">
          <div className="label">Pending payouts (net)</div>
          <div className="value">{fmtPair(pendingOut)}</div>
          <div className="sub">{payouts.length} awaiting payment</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">
            Upcoming & overdue commissions
            <Link to="/commissions" className="small">View all →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Client</th><th>Due</th><th className="num">Expected</th><th>Status</th></tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr><td colSpan={4}><Empty>Nothing due — add clients to start tracking.</Empty></td></tr>
                ) : upcoming.map((r) => (
                  <tr key={r.id}>
                    <td>{r.clients?.name}</td>
                    <td>{fmtDate(r.due_date)}</td>
                    <td className="num">{money(r.expected_amount, r.currency)}</td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Pending consultant payouts
            <Link to="/payouts" className="small">View all →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Consultant</th><th>Client</th><th className="num">Net due</th></tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr><td colSpan={3}><Empty>No pending payouts.</Empty></td></tr>
                ) : payouts.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{r.consultants?.name}</td>
                    <td>{r.commissions?.clients?.name}</td>
                    <td className="num"><strong>{money(r.net_amount, r.currency)}</strong></td>
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
