import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, today, EXPENSE_CATEGORIES } from '../lib/format.js'

const BLANK = {
  category: EXPENSE_CATEGORIES[0], description: '', amount: '', currency: 'THB',
  expense_date: today(), recurring: false, client_id: '', receipt_url: '',
}

export default function Expenses() {
  const [rows, setRows] = useState(null)
  const [clients, setClients] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    await supabase.rpc('generate_recurring_expenses')
    const [e, c] = await Promise.all([
      supabase.from('expenses').select('*, clients(name)').order('expense_date', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setRows(e.data || [])
    setClients(c.data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setError('')
    const v = editing.value
    const payload = {
      category: v.category,
      description: v.description,
      amount: Number(v.amount) || 0,
      currency: v.currency,
      expense_date: v.expense_date,
      recurring: v.recurring,
      is_draft: false, // saving a draft confirms it
      client_id: v.client_id || null,
      receipt_url: v.receipt_url || null,
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Business costs. Recurring expenses auto-create a draft each month for you to confirm.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({ value: { ...BLANK }, id: null })}>
          + New expense
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Category</th><th>Description</th>
                <th className="num">Amount</th><th>Client</th><th>Flags</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : rows.length === 0 ? (
                <tr><td colSpan={7}><Empty>No expenses logged yet.</Empty></td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={r.is_draft ? { opacity: 0.65 } : undefined}>
                  <td>{fmtDate(r.expense_date)}</td>
                  <td>{r.category}</td>
                  <td>
                    {r.description || '—'}
                    {r.receipt_url && <span className="cell-sub"><a href={r.receipt_url} target="_blank" rel="noreferrer">receipt</a></span>}
                  </td>
                  <td className="num">{money(r.amount, r.currency)}</td>
                  <td>{r.clients?.name || <span className="muted">—</span>}</td>
                  <td>
                    {r.recurring && <Badge status="teal">recurring</Badge>}{' '}
                    {r.is_draft && <Badge status="draft">draft — confirm</Badge>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn outline sm"
                      onClick={() => setEditing({
                        value: { ...r, amount: r.amount ?? '', client_id: r.client_id || '', receipt_url: r.receipt_url || '' },
                        id: r.id,
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
          <ExpenseForm value={editing.value} clients={clients} onChange={(v) => setEditing({ ...editing, value: v })} />
        </Modal>
      )}
    </>
  )
}

function ExpenseForm({ value: v, clients, onChange }) {
  const set = (k, val) => onChange({ ...v, [k]: val })
  return (
    <>
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
      <div className="form-row">
        <Field label="Amount *">
          <input type="number" step="0.01" value={v.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Currency">
          <select value={v.currency} onChange={(e) => set('currency', e.target.value)}>
            <option>THB</option><option>USD</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <input value={v.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Meta Ads — June campaign" />
      </Field>
      <div className="form-row">
        <Field label="Linked client (optional)" hint="Link ad spend to a client for ROI tracking.">
          <select value={v.client_id} onChange={(e) => set('client_id', e.target.value)}>
            <option value="">— none / general overhead —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Recurring monthly?" hint="A draft copy is auto-created each month.">
          <select value={v.recurring ? 'yes' : 'no'} onChange={(e) => set('recurring', e.target.value === 'yes')}>
            <option value="no">No — one-time</option>
            <option value="yes">Yes — recurring</option>
          </select>
        </Field>
      </div>
      <Field label="Receipt URL (optional)">
        <input value={v.receipt_url} onChange={(e) => set('receipt_url', e.target.value)} placeholder="https://…" />
      </Field>
    </>
  )
}
