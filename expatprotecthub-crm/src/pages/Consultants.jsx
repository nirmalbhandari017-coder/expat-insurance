import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { pct } from '../lib/format.js'

const BLANK = {
  name: '', email: '', phone: '', payment_details: '',
  default_payout_pct: '', withholding_pct_override: '', active: true,
}

export default function Consultants() {
  const { role } = useSession()
  const isAdmin = role === 'admin'
  const [rows, setRows] = useState(null)
  const [linkCounts, setLinkCounts] = useState({})
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const [co, cc] = await Promise.all([
      supabase.from('consultants').select('*').order('name'),
      supabase.from('client_consultants').select('consultant_id'),
    ])
    setRows(co.data || [])
    const counts = {}
    for (const l of cc.data || []) counts[l.consultant_id] = (counts[l.consultant_id] || 0) + 1
    setLinkCounts(counts)
  }
  useEffect(() => { load() }, [])

  async function save() {
    setError('')
    const v = editing.value
    const payload = {
      name: v.name, email: v.email, phone: v.phone, payment_details: v.payment_details,
      default_payout_pct: Number(v.default_payout_pct) || 0,
      withholding_pct_override: v.withholding_pct_override === '' ? null : Number(v.withholding_pct_override),
      active: v.active,
    }
    const q = editing.id
      ? supabase.from('consultants').update(payload).eq('id', editing.id)
      : supabase.from('consultants').insert(payload)
    const { error } = await q
    if (error) return setError(error.message)
    setEditing(null)
    load()
  }

  async function remove(row) {
    if (!confirm(`Delete consultant "${row.name}"? Their payout history will also be removed.`)) return
    await supabase.from('consultants').delete().eq('id', row.id)
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Consultants</h1>
          <p>Sales consultants and their payout terms.</p>
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={() => setEditing({ value: { ...BLANK }, id: null })}>
            + New consultant
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Contact</th><th className="num">Default payout %</th>
                <th className="num">WHT override</th><th className="num">Clients</th>
                <th>Status</th>{isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : rows.length === 0 ? (
                <tr><td colSpan={7}><Empty>No consultants yet.</Empty></td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>
                    {r.email || '—'}
                    {r.phone && <span className="cell-sub">{r.phone}</span>}
                  </td>
                  <td className="num">{pct(r.default_payout_pct)}</td>
                  <td className="num">{r.withholding_pct_override != null ? pct(r.withholding_pct_override) : <span className="muted">default</span>}</td>
                  <td className="num">{linkCounts[r.id] || 0}</td>
                  <td><Badge status={r.active ? 'active' : 'cancelled'}>{r.active ? 'active' : 'inactive'}</Badge></td>
                  {isAdmin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn outline sm"
                        onClick={() => setEditing({
                          value: {
                            ...r,
                            default_payout_pct: r.default_payout_pct ?? '',
                            withholding_pct_override: r.withholding_pct_override ?? '',
                          },
                          id: r.id,
                        })}
                      >
                        Edit
                      </button>{' '}
                      <button className="btn danger-ghost sm" onClick={() => remove(r)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edit consultant' : 'New consultant'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" onClick={save}>Save</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <ConsultantForm value={editing.value} onChange={(v) => setEditing({ ...editing, value: v })} />
        </Modal>
      )}
    </>
  )
}

function ConsultantForm({ value: v, onChange }) {
  const set = (k, val) => onChange({ ...v, [k]: val })
  return (
    <>
      <div className="form-row">
        <Field label="Name *">
          <input value={v.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" value={v.email || ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Phone">
          <input value={v.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Default payout % *" hint="Their share of each received commission, unless overridden per client.">
          <input type="number" step="0.01" value={v.default_payout_pct} onChange={(e) => set('default_payout_pct', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Withholding tax % override" hint="Leave blank to use the company default (Settings).">
          <input type="number" step="0.01" value={v.withholding_pct_override} onChange={(e) => set('withholding_pct_override', e.target.value)} placeholder="default" />
        </Field>
        <Field label="Active">
          <select value={v.active ? 'yes' : 'no'} onChange={(e) => set('active', e.target.value === 'yes')}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      <Field label="Payment details" hint="Bank account / PromptPay / wire instructions for payouts.">
        <textarea rows={2} value={v.payment_details || ''} onChange={(e) => set('payment_details', e.target.value)} />
      </Field>
    </>
  )
}
