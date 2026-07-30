import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, today } from '../lib/format.js'

export default function Payouts() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('pending')

  async function load() {
    const { data } = await supabase
      .from('payouts')
      .select('*, consultants(name), commissions(due_date, received_date, clients(name))')
      .order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function markPaid(row) {
    const { error } = await supabase
      .from('payouts')
      .update({ status: 'paid', paid_date: today() })
      .eq('id', row.id)
    if (error) alert(error.message)
    load()
  }

  async function unpay(row) {
    if (!confirm('Revert this payout to pending?')) return
    const { error } = await supabase
      .from('payouts')
      .update({ status: 'pending', paid_date: null })
      .eq('id', row.id)
    if (error) alert(error.message)
    load()
  }

  const shown = (rows || []).filter((r) => filter === 'all' || r.status === filter)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payouts</h1>
          <p>Consultant payouts, created automatically when a commission is received (pass-through).</p>
        </div>
      </div>

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Consultant</th><th>Client / commission</th>
                <th className="num">Gross</th><th className="num">Tax withheld</th>
                <th className="num">Net</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : shown.length === 0 ? (
                <tr><td colSpan={7}><Empty>No payouts here. They appear when commissions are marked received.</Empty></td></tr>
              ) : shown.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.consultants?.name}</strong></td>
                  <td>
                    {r.commissions?.clients?.name}
                    <span className="cell-sub">received {fmtDate(r.commissions?.received_date)}</span>
                  </td>
                  <td className="num">{money(r.gross_amount, r.currency)}</td>
                  <td className="num">
                    {money(r.tax_amount, r.currency)}
                    <span className="cell-sub">{r.tax_pct}%</span>
                  </td>
                  <td className="num"><strong>{money(r.net_amount, r.currency)}</strong></td>
                  <td>
                    <Badge status={r.status} />
                    {r.paid_date && <span className="cell-sub">{fmtDate(r.paid_date)}</span>}
                  </td>
                  <td>
                    {r.status === 'pending'
                      ? <button className="btn primary sm" onClick={() => markPaid(r)}>Mark paid</button>
                      : <button className="btn outline sm" onClick={() => unpay(r)}>Undo</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
