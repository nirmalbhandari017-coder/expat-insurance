import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, today } from '../lib/format.js'

export default function Commissions() {
  const [rows, setRows] = useState(null)
  const [receiving, setReceiving] = useState(null) // {row, received_date, received_amount}
  const [filter, setFilter] = useState('open') // open | received | all
  const [error, setError] = useState('')

  async function load() {
    // generate upcoming records + refresh overdue flags, then fetch
    await supabase.rpc('generate_due_commissions', { horizon_days: 60 })
    const { data } = await supabase
      .from('commissions')
      .select('*, clients(name, company)')
      .order('due_date', { ascending: true })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function markReceived() {
    setError('')
    const { error } = await supabase
      .from('commissions')
      .update({
        status: 'received',
        received_date: receiving.received_date,
        received_amount: Number(receiving.received_amount),
      })
      .eq('id', receiving.row.id)
    if (error) return setError(error.message)
    setReceiving(null)
    load()
  }

  async function unreceive(row) {
    if (!confirm('Revert this commission to pending? Unpaid payouts generated from it will be removed.')) return
    const { error } = await supabase
      .from('commissions')
      .update({ status: 'pending' })
      .eq('id', row.id)
    if (error) alert(error.message)
    load()
  }

  const shown = (rows || []).filter((r) =>
    filter === 'all' ? true : filter === 'received' ? r.status === 'received' : r.status !== 'received'
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Commissions</h1>
          <p>Expected commission income, auto-generated from each client's payment cycle.</p>
        </div>
      </div>

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Pending & overdue</option>
          <option value="received">Received</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Due date</th><th className="num">Expected</th>
                <th className="num">Received</th><th className="num">Tax reserve</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : shown.length === 0 ? (
                <tr><td colSpan={7}><Empty>Nothing here. Commission records appear automatically once active clients exist.</Empty></td></tr>
              ) : shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.clients?.name}</strong>
                    {r.clients?.company && <span className="cell-sub">{r.clients.company}</span>}
                  </td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td className="num">{money(r.expected_amount, r.currency)}</td>
                  <td className="num">
                    {r.status === 'received' ? money(r.received_amount, r.currency) : '—'}
                    {r.status === 'received' && <span className="cell-sub">{fmtDate(r.received_date)}</span>}
                  </td>
                  <td className="num">
                    {r.tax_reserve_amount != null ? money(r.tax_reserve_amount, r.currency) : '—'}
                    {r.tax_reserve_pct != null && <span className="cell-sub">{r.tax_reserve_pct}%</span>}
                  </td>
                  <td><Badge status={r.status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status !== 'received' ? (
                      <button
                        className="btn primary sm"
                        onClick={() => setReceiving({
                          row: r,
                          received_date: today(),
                          received_amount: r.expected_amount,
                        })}
                      >
                        Mark received
                      </button>
                    ) : (
                      <button className="btn outline sm" onClick={() => unreceive(r)}>Undo</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receiving && (
        <Modal
          title={`Receive commission — ${receiving.row.clients?.name}`}
          onClose={() => setReceiving(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setReceiving(null)}>Cancel</button>
              <button className="btn primary" onClick={markReceived}>Confirm received</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <p className="small muted" style={{ marginBottom: 14 }}>
            Marking this received will automatically create the pending consultant payout(s)
            and calculate the company tax reserve.
          </p>
          <div className="form-row">
            <Field label="Amount actually received" hint={`Expected: ${money(receiving.row.expected_amount, receiving.row.currency)} — adjust for partial/short payments.`}>
              <input
                type="number" step="0.01"
                value={receiving.received_amount}
                onChange={(e) => setReceiving({ ...receiving, received_amount: e.target.value })}
              />
            </Field>
            <Field label="Date received">
              <input
                type="date"
                value={receiving.received_date}
                onChange={(e) => setReceiving({ ...receiving, received_date: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
