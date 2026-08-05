import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, today, FREQUENCY_LABELS } from '../lib/format.js'
import { downloadCsv, stampedName } from '../lib/csv.js'

/** Instalments per year, so an annual figure can be split down and back up. */
const PER_YEAR = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 }

/** "2026-09" for a date, and for the month after today. */
const monthKey = (d) => (d ? String(d).slice(0, 7) : '')
function keyOf(d) {
  // Built by hand, not via toISOString — east of UTC that would shift the
  // first of the month back into the previous one.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nextMonthKey() {
  const d = new Date()
  return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}
const thisMonthKey = () => keyOf(new Date())

export default function Commissions() {
  const [rows, setRows] = useState(null)
  const [clients, setClients] = useState([])
  const [receiving, setReceiving] = useState(null) // {row, received_date, received_amount}
  const [filter, setFilter] = useState('open') // open | received | all
  const [view, setView] = useState('client') // client | instalment
  const [error, setError] = useState('')

  async function load() {
    // generate upcoming records + refresh overdue flags, then fetch
    await supabase.rpc('generate_due_commissions', { horizon_days: 400 })
    const [c, cl] = await Promise.all([
      supabase.from('commissions').select('*, clients(name, company)').order('due_date', { ascending: true }),
      supabase.from('clients').select('*').neq('status', 'cancelled').order('name'),
    ])
    setRows(c.data || [])
    setClients(cl.data || [])
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

  /**
   * One line per client (spec item 4): the annual commission, how it is
   * actually collected, and when the next slice falls due.
   */
  const perClient = useMemo(() => {
    const next = nextMonthKey()
    const now = thisMonthKey()
    return clients.map((c) => {
      const mine = (rows || []).filter((r) => r.client_id === c.id)
      const perYear = PER_YEAR[c.frequency] ?? 1
      const annual = (Number(c.premium) || 0) * (Number(c.commission_pct) || 0) / 100

      const open = mine.filter((r) => r.status !== 'received')
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
      const nextDue = open[0] || null
      const received = mine.filter((r) => r.status === 'received')

      const key = monthKey(nextDue?.due_date)
      const timing = !nextDue ? null
        : nextDue.status === 'overdue' ? 'overdue'
          : key === next ? 'next'
            : key === now ? 'this'
              : 'later'

      return {
        client: c,
        annual,
        perPayment: annual / perYear,
        perYear,
        nextDue,
        timing,
        receivedTotal: received.reduce((s, r) => s + Number(r.received_amount || 0), 0),
        receivedCount: received.length,
        openCount: open.length,
      }
    }).sort((a, b) => {
      // Anything needing attention first: overdue, then due next month.
      const rank = (x) => (x.timing === 'overdue' ? 0 : x.timing === 'this' ? 1 : x.timing === 'next' ? 2 : 3)
      return rank(a) - rank(b) || String(a.nextDue?.due_date).localeCompare(String(b.nextDue?.due_date))
    })
  }, [clients, rows])

  const dueNextMonth = perClient.filter((p) => p.timing === 'next')
  const currency = clients[0]?.currency || 'USD'
  const annualTotal = perClient.reduce((s, p) => s + p.annual, 0)

  function exportCsv() {
    if (view === 'client') {
      downloadCsv(stampedName('commissions-by-client'), [
        { header: 'Client', format: (p) => p.client.name },
        { header: 'Policy number', format: (p) => p.client.policy_number ?? '' },
        { header: 'Premium (annual)', format: (p) => p.client.premium },
        { header: 'Commission %', format: (p) => p.client.commission_pct },
        { header: 'Commission (annual)', format: (p) => p.annual.toFixed(2) },
        { header: 'Paid', format: (p) => FREQUENCY_LABELS[p.client.frequency] },
        { header: 'Per payment', format: (p) => p.perPayment.toFixed(2) },
        { header: 'Currency', format: (p) => p.client.currency },
        { header: 'Next due', format: (p) => p.nextDue?.due_date ?? '' },
        { header: 'Due next month', format: (p) => (p.timing === 'next' ? 'Yes' : 'No') },
        { header: 'Received to date', format: (p) => p.receivedTotal.toFixed(2) },
      ], perClient)
    } else {
      downloadCsv(stampedName('commissions'), [
        { header: 'Client', format: (r) => r.clients?.name ?? '' },
        { key: 'due_date', header: 'Due date' },
        { key: 'expected_amount', header: 'Expected' },
        { key: 'received_amount', header: 'Received' },
        { key: 'received_date', header: 'Received date' },
        { key: 'tax_reserve_amount', header: 'Tax reserve' },
        { key: 'currency', header: 'Currency' },
        { key: 'status', header: 'Status' },
      ], shown)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Commissions</h1>
          <p>Expected commission income, auto-generated from each client's payment cycle.</p>
        </div>
        <button className="btn outline" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="filters">
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="client">One row per client (annual)</option>
          <option value="instalment">Every commission payment</option>
        </select>
        {view === 'instalment' && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">Pending & overdue</option>
            <option value="received">Received</option>
            <option value="all">All</option>
          </select>
        )}
      </div>

      {view === 'client' ? (
        <>
          <div className="kpi-grid">
            <div className="kpi accent">
              <div className="label">Commission per year</div>
              <div className="value">{money(annualTotal, currency)}</div>
              <div className="sub">across {perClient.length} client{perClient.length !== 1 && 's'}</div>
            </div>
            <div className="kpi warn">
              <div className="label">Due next month</div>
              <div className="value">
                {money(dueNextMonth.reduce((s, p) => s + Number(p.nextDue?.expected_amount || 0), 0), currency)}
              </div>
              <div className="sub">
                {dueNextMonth.length
                  ? dueNextMonth.map((p) => p.client.name).join(', ')
                  : 'nothing falls due next month'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th><th>Paid</th>
                    <th className="num">Commission / year</th>
                    <th className="num">Per payment</th>
                    <th>Next due</th>
                    <th className="num">Received to date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows === null ? null : perClient.length === 0 ? (
                    <tr><td colSpan={6}><Empty>No active clients yet.</Empty></td></tr>
                  ) : perClient.map((p) => (
                    <tr key={p.client.id}>
                      <td>
                        <Link to={`/clients/${p.client.id}`} style={{ fontWeight: 600 }}>{p.client.name}</Link>
                        {p.client.company && <span className="cell-sub">{p.client.company}</span>}
                      </td>
                      <td>
                        <span className="badge navy">{FREQUENCY_LABELS[p.client.frequency]}</span>
                      </td>
                      <td className="num">
                        <strong>{money(p.annual, p.client.currency)}</strong>
                        <span className="cell-sub">
                          {money(p.client.premium, p.client.currency)} × {p.client.commission_pct}%
                        </span>
                      </td>
                      <td className="num">
                        {money(p.perPayment, p.client.currency)}
                        {p.perYear > 1 && <span className="cell-sub">× {p.perYear} a year</span>}
                      </td>
                      <td>
                        {!p.nextDue ? <span className="muted">—</span> : (
                          <>
                            {fmtDate(p.nextDue.due_date)}
                            <span className="cell-sub">
                              {money(p.nextDue.expected_amount, p.nextDue.currency)}
                            </span>
                            {p.timing === 'overdue' && <span className="badge red">Overdue</span>}
                            {p.timing === 'this' && <span className="badge yellow">Due this month</span>}
                            {p.timing === 'next' && <span className="badge yellow">Due next month</span>}
                          </>
                        )}
                      </td>
                      <td className="num">
                        {money(p.receivedTotal, p.client.currency)}
                        <span className="cell-sub">
                          {p.receivedCount} payment{p.receivedCount !== 1 && 's'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
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
                    <td>
                      {fmtDate(r.due_date)}
                      {r.status !== 'received' && monthKey(r.due_date) === nextMonthKey() && (
                        <span className="cell-sub" style={{ color: '#B4740A', fontWeight: 600 }}>due next month</span>
                      )}
                    </td>
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
      )}

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
