import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { fmtDate, today, EXPENSE_CATEGORIES } from '../lib/format.js'
import { useCurrency, fmt, displayAmount, sumIn } from '../lib/currency.jsx'

const BLANK = {
  name: '', category: EXPENSE_CATEGORIES[0], description: '', amount: '',
  currency: 'THB', expense_date: today(), recurring: false,
  made_by_person_id: '', paid_by: 'company', payment_status: 'paid',
  client_id: '', receipt_url: '', fx_rate: '',
}

/** Period presets. Monthly is the default view (spec §11). */
function periodRange(mode, anchor) {
  const d = new Date(anchor + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth()
  const iso = (x) => x.toISOString().slice(0, 10)
  if (mode === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  if (mode === 'quarter') {
    const q = Math.floor(m / 3)
    return [iso(new Date(y, q * 3, 1)), iso(new Date(y, q * 3 + 3, 0))]
  }
  if (mode === 'year') return [iso(new Date(y, 0, 1)), iso(new Date(y, 12, 0))]
  return [null, null] // custom
}

export default function Expenses() {
  const { display, rate } = useCurrency()
  const [rows, setRows] = useState(null)
  const [clients, setClients] = useState([])
  const [people, setPeople] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const [mode, setMode] = useState('month')
  const [anchor, setAnchor] = useState(today())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [fCategory, setFCategory] = useState('all')
  const [fPerson, setFPerson] = useState('all')
  const [fCurrency, setFCurrency] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fPaidBy, setFPaidBy] = useState('all')

  async function load() {
    await supabase.rpc('generate_recurring_expenses')
    const [e, c, p] = await Promise.all([
      supabase.from('expenses')
        .select('*, clients(name), made_by:people(full_name)')
        .order('expense_date', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('people').select('id, full_name').eq('active', true).order('full_name'),
    ])
    setRows(e.data || [])
    setClients(c.data || [])
    setPeople(p.data || [])
  }
  useEffect(() => { load() }, [])

  const [from, to] = mode === 'custom'
    ? [customFrom || null, customTo || null]
    : periodRange(mode, anchor)

  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (from && r.expense_date < from) return false
    if (to && r.expense_date > to) return false
    if (fCategory !== 'all' && r.category !== fCategory) return false
    if (fPerson !== 'all' && r.made_by_person_id !== fPerson) return false
    if (fCurrency !== 'all' && r.currency !== fCurrency) return false
    if (fStatus !== 'all' && r.payment_status !== fStatus) return false
    if (fPaidBy !== 'all' && r.paid_by !== fPaidBy) return false
    return true
  }), [rows, from, to, fCategory, fPerson, fCurrency, fStatus, fPaidBy])

  const total = sumIn(shown, display, rate)
  const byCategory = useMemo(() => {
    const m = {}
    for (const r of shown) m[r.category] = (m[r.category] || 0) + sumIn([r], display, rate)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [shown, display, rate])

  // Money an owner fronted personally — needs reimbursing (spec §12).
  const personallyPaid = sumIn(shown.filter((r) => r.paid_by === 'personal'), display, rate)

  async function save() {
    setError('')
    const v = editing.value
    const num = (x) => (x === '' || x == null ? null : Number(x))
    const amount = Number(v.amount) || 0
    const r = num(v.fx_rate) ?? rate
    const payload = {
      name: v.name || null,
      category: v.category,
      description: v.description || null,
      amount,
      currency: v.currency,
      expense_date: v.expense_date,
      recurring: v.recurring,
      is_draft: false,
      made_by_person_id: v.made_by_person_id || null,
      paid_by: v.paid_by,
      payment_status: v.payment_status,
      client_id: v.client_id || null,
      receipt_url: v.receipt_url || null,
      fx_rate_to_usd: r,
      fx_rate_to_thb: r,
      amount_usd: v.currency === 'USD' ? amount : Number((amount / r).toFixed(2)),
      amount_thb: v.currency === 'THB' ? amount : Number((amount * r).toFixed(2)),
    }
    const q = editing.id
      ? supabase.from('expenses').update(payload).eq('id', editing.id)
      : supabase.from('expenses').insert(payload)
    const { error } = await q
    if (error) return setError(error.message)
    setEditing(null)
    load()
  }

  async function remove(row) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', row.id)
    load()
  }

  const periodLabel = mode === 'custom'
    ? (from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : 'All dates')
    : `${fmtDate(from)} – ${fmtDate(to)}`

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>{periodLabel} · shown in {display}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({ value: { ...BLANK }, id: null })}>
          + New expense
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Total this period</div>
          <div className="value">{fmt(total, display)}</div>
          <div className="sub">{shown.length} expense{shown.length !== 1 && 's'}</div>
        </div>
        <div className="kpi warn">
          <div className="label">Paid personally</div>
          <div className="value">{fmt(personallyPaid, display)}</div>
          <div className="sub">may need reimbursing</div>
        </div>
        {byCategory.slice(0, 3).map(([cat, amt]) => (
          <div className="kpi" key={cat}>
            <div className="label">{cat}</div>
            <div className="value">{fmt(amt, display)}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="month">Monthly</option>
          <option value="quarter">Quarterly</option>
          <option value="year">Annual</option>
          <option value="custom">Custom range</option>
        </select>

        {mode === 'custom' ? (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        ) : (
          <input
            type="date" value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            title="Any date inside the period you want to see"
          />
        )}

        <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <select value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
          <option value="all">Anyone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>

        <select value={fPaidBy} onChange={(e) => setFPaidBy(e.target.value)}>
          <option value="all">Company + personal</option>
          <option value="company">Company paid</option>
          <option value="personal">Paid personally</option>
        </select>

        <select value={fCurrency} onChange={(e) => setFCurrency(e.target.value)}>
          <option value="all">Any currency</option>
          <option value="USD">USD</option>
          <option value="THB">THB</option>
        </select>

        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">Any status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="reimbursed">Reimbursed</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Expense</th><th>Category</th>
                <th className="num">Amount</th><th>Made by</th><th>Paid by</th>
                <th>Client</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : shown.length === 0 ? (
                <tr><td colSpan={9}><Empty>No expenses in this period.</Empty></td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} style={r.is_draft ? { opacity: 0.65 } : undefined}>
                  <td>{fmtDate(r.expense_date)}</td>
                  <td>
                    <strong>{r.name || r.description || '—'}</strong>
                    {r.name && r.description && <span className="cell-sub">{r.description}</span>}
                    {r.receipt_url && (
                      <span className="cell-sub">
                        <a href={r.receipt_url} target="_blank" rel="noreferrer">receipt</a>
                      </span>
                    )}
                  </td>
                  <td className="small">{r.category}</td>
                  <td className="num">
                    {displayAmount(r, display, rate)}
                    {r.currency !== display && (
                      <span className="cell-sub">{fmt(r.amount, r.currency)}</span>
                    )}
                  </td>
                  <td className="small">{r.made_by?.full_name ?? <span className="muted">—</span>}</td>
                  <td>
                    <Badge status={r.paid_by === 'personal' ? 'yellow' : 'gray'}>
                      {r.paid_by === 'personal' ? 'personal' : 'company'}
                    </Badge>
                  </td>
                  <td className="small">{r.clients?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <Badge
                      status={
                        r.payment_status === 'paid' ? 'received'
                          : r.payment_status === 'reimbursed' ? 'active'
                            : 'pending'
                      }
                    >
                      {r.payment_status}
                    </Badge>
                    {r.recurring && <span className="cell-sub">recurring</span>}
                    {r.is_draft && <span className="cell-sub">draft — confirm</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn outline sm"
                      onClick={() => setEditing({
                        id: r.id,
                        value: {
                          ...r,
                          name: r.name ?? '',
                          description: r.description ?? '',
                          amount: r.amount ?? '',
                          made_by_person_id: r.made_by_person_id ?? '',
                          client_id: r.client_id ?? '',
                          receipt_url: r.receipt_url ?? '',
                          fx_rate: r.fx_rate_to_usd ?? '',
                        },
                      })}
                    >
                      {r.is_draft ? 'Confirm' : 'Edit'}
                    </button>{' '}
                    <button className="btn danger-ghost sm" onClick={() => remove(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? (editing.value.is_draft ? 'Confirm draft expense' : 'Edit expense') : 'New expense'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" onClick={save}>Save expense</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <ExpenseForm
            value={editing.value}
            clients={clients}
            people={people}
            defaultRate={rate}
            onChange={(v) => setEditing({ ...editing, value: v })}
          />
        </Modal>
      )}
    </>
  )
}

function ExpenseForm({ value: v, clients, people, defaultRate, onChange }) {
  const set = (k, val) => onChange({ ...v, [k]: val })
  return (
    <>
      <Field label="Expense name *">
        <input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Meta Advertising" />
      </Field>

      <div className="form-row">
        <Field label="Category">
          <select value={v.category} onChange={(e) => set('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={v.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
        </Field>
      </div>

      <div className="form-row-3">
        <Field label="Amount *">
          <input type="number" step="0.01" value={v.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Currency">
          <select value={v.currency} onChange={(e) => set('currency', e.target.value)}>
            <option>THB</option><option>USD</option>
          </select>
        </Field>
        <Field label="USD↔THB rate" hint="Blank = default">
          <input
            type="number" step="0.00000001"
            value={v.fx_rate}
            onChange={(e) => set('fx_rate', e.target.value)}
            placeholder={String(defaultRate)}
          />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Expense made by" hint="Who incurred it.">
          <select value={v.made_by_person_id} onChange={(e) => set('made_by_person_id', e.target.value)}>
            <option value="">— not set —</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Paid by" hint="Personal payments can be reimbursed later.">
          <select value={v.paid_by} onChange={(e) => set('paid_by', e.target.value)}>
            <option value="company">Company</option>
            <option value="personal">Paid personally</option>
          </select>
        </Field>
      </div>

      <div className="form-row">
        <Field label="Payment status">
          <select value={v.payment_status} onChange={(e) => set('payment_status', e.target.value)}>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
        </Field>
        <Field label="Recurring monthly?" hint="A draft copy appears each month to confirm.">
          <select value={v.recurring ? 'yes' : 'no'} onChange={(e) => set('recurring', e.target.value === 'yes')}>
            <option value="no">No — one-time</option>
            <option value="yes">Yes — recurring</option>
          </select>
        </Field>
      </div>

      <Field label="Description">
        <input value={v.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <div className="form-row">
        <Field label="Linked client (optional)" hint="Only link it if the cost genuinely belongs to that client.">
          <select value={v.client_id} onChange={(e) => set('client_id', e.target.value)}>
            <option value="">— general overhead —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Receipt URL">
          <input value={v.receipt_url} onChange={(e) => set('receipt_url', e.target.value)} placeholder="https://…" />
        </Field>
      </div>
    </>
  )
}
