import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, pct, FREQUENCY_LABELS } from '../lib/format.js'

// Consultant self-service view: own deals, own %, payout history,
// upcoming expected payouts. RLS guarantees they can't see anything else.
export default function MyEarnings() {
  const { profile } = useSession()
  const [me, setMe] = useState(null)
  const [links, setLinks] = useState([])
  const [clients, setClients] = useState([])
  const [payouts, setPayouts] = useState(null)
  const [upcoming, setUpcoming] = useState([])

  useEffect(() => {
    if (!profile.consultant_id) { setPayouts([]); return }
    (async () => {
      const [c, l, cl, p, u] = await Promise.all([
        supabase.from('consultants').select('*').eq('id', profile.consultant_id).single(),
        supabase.from('client_consultants').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('payouts').select('*, commissions(received_date, clients(name))').order('created_at', { ascending: false }),
        supabase.from('commissions').select('*, clients(name)').neq('status', 'received').order('due_date').limit(10),
      ])
      setMe(c.data)
      setLinks(l.data || [])
      setClients(cl.data || [])
      setPayouts(p.data || [])
      setUpcoming(u.data || [])
    })()
  }, [profile.consultant_id])

  if (!profile.consultant_id) {
    return (
      <div className="card" style={{ marginTop: 40 }}>
        <div className="card-body">
          <h2 style={{ marginBottom: 8 }}>Account not yet activated</h2>
          <p className="muted">
            Your account exists but hasn't been linked to a consultant record yet.
            Ask your administrator to activate it in Settings → Team access.
          </p>
        </div>
      </div>
    )
  }
  if (payouts === null) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const myPct = (clientId) => {
    const link = links.find((l) => l.client_id === clientId)
    return link?.payout_pct_override ?? me?.default_payout_pct
  }

  const pending = payouts.filter((p) => p.status === 'pending')
  const sumBy = (rows, cur) => rows.filter((r) => r.currency === cur).reduce((a, r) => a + Number(r.net_amount), 0)
  const fmtPair = (rows) => [
    sumBy(rows, 'USD') ? money(sumBy(rows, 'USD'), 'USD') : null,
    sumBy(rows, 'THB') ? money(sumBy(rows, 'THB'), 'THB') : null,
  ].filter(Boolean).join(' + ') || money(0, 'USD')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My Earnings</h1>
          <p>Your deals, commission share, and payout history.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi warn">
          <div className="label">Awaiting payment (net)</div>
          <div className="value">{fmtPair(pending)}</div>
          <div className="sub">{pending.length} pending payout{pending.length !== 1 && 's'}</div>
        </div>
        <div className="kpi accent">
          <div className="label">Paid out to date (net)</div>
          <div className="value">{fmtPair(payouts.filter((p) => p.status === 'paid'))}</div>
        </div>
        <div className="kpi">
          <div className="label">Default share</div>
          <div className="value">{pct(me?.default_payout_pct)}</div>
          <div className="sub">of received commission</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">My deals</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Product</th><th>Frequency</th><th className="num">My %</th><th>Status</th></tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr><td colSpan={5}><Empty>No deals assigned yet.</Empty></td></tr>
              ) : clients.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong>{c.company && <span className="cell-sub">{c.company}</span>}</td>
                  <td>{c.product_type || '—'}</td>
                  <td>{FREQUENCY_LABELS[c.frequency]}</td>
                  <td className="num">{pct(myPct(c.id))}</td>
                  <td><Badge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Payout history</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Client</th><th className="num">Gross</th><th className="num">Tax</th><th className="num">Net</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr><td colSpan={5}><Empty>No payouts yet — they appear when your clients' commissions come in.</Empty></td></tr>
                ) : payouts.map((r) => (
                  <tr key={r.id}>
                    <td>{r.commissions?.clients?.name}</td>
                    <td className="num">{money(r.gross_amount, r.currency)}</td>
                    <td className="num">{money(r.tax_amount, r.currency)}</td>
                    <td className="num"><strong>{money(r.net_amount, r.currency)}</strong></td>
                    <td>
                      <Badge status={r.status} />
                      {r.paid_date && <span className="cell-sub">{fmtDate(r.paid_date)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Upcoming commissions on my deals</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Client</th><th>Due</th><th className="num">My expected share</th></tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr><td colSpan={3}><Empty>Nothing upcoming.</Empty></td></tr>
                ) : upcoming.map((c) => {
                  const share = myPct(c.client_id)
                  return (
                    <tr key={c.id}>
                      <td>{c.clients?.name}</td>
                      <td>{fmtDate(c.due_date)}</td>
                      <td className="num">
                        {share != null ? money(c.expected_amount * share / 100, c.currency) : '—'}
                        <span className="cell-sub">before withholding tax</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
