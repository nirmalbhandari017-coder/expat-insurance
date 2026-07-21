import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, pct, FREQUENCY_LABELS, today } from '../lib/format.js'

const BLANK = {
  name: '', company: '', email: '', phone: '', product_type: '',
  start_date: today(), premium: '', currency: 'USD', commission_pct: '',
  frequency: 'monthly', status: 'active', notes: '',
}

export default function Clients() {
  const { role } = useSession()
  const isAdmin = role === 'admin'
  const [clients, setClients] = useState(null)
  const [consultants, setConsultants] = useState([])
  const [links, setLinks] = useState([]) // client_consultants
  const [editing, setEditing] = useState(null) // {client, splits: [{consultant_id, payout_pct_override}]}
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  async function load() {
    const [c, co, cc] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('consultants').select('*').eq('active', true).order('name'),
      supabase.from('client_consultants').select('*'),
    ])
    setClients(c.data || [])
    setConsultants(co.data || [])
    setLinks(cc.data || [])
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing({ client: { ...BLANK }, splits: [], id: null })
  }
  function openEdit(client) {
    setEditing({
      client: { ...client },
      splits: links
        .filter((l) => l.client_id === client.id)
        .map((l) => ({ consultant_id: l.consultant_id, payout_pct_override: l.payout_pct_override ?? '' })),
      id: client.id,
    })
  }

  async function save() {
    setError('')
    const c = editing.client
    const payload = {
      name: c.name, company: c.company, email: c.email, phone: c.phone,
      product_type: c.product_type, start_date: c.start_date,
      premium: Number(c.premium) || 0, currency: c.currency,
      commission_pct: Number(c.commission_pct) || 0,
      frequency: c.frequency, status: c.status, notes: c.notes,
    }
    let clientId = editing.id
    if (clientId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', clientId)
      if (error) return setError(error.message)
    } else {
      const { data, error } = await supabase.from('clients').insert(payload).select('id').single()
      if (error) return setError(error.message)
      clientId = data.id
    }
    // reconcile splits
    await supabase.from('client_consultants').delete().eq('client_id', clientId)
    const rows = editing.splits
      .filter((s) => s.consultant_id)
      .map((s) => ({
        client_id: clientId,
        consultant_id: s.consultant_id,
        payout_pct_override: s.payout_pct_override === '' ? null : Number(s.payout_pct_override),
      }))
    if (rows.length) {
      const { error } = await supabase.from('client_consultants').insert(rows)
      if (error) return setError(error.message)
    }
    setEditing(null)
    load()
  }

  async function remove(client) {
    if (!confirm(`Delete client "${client.name}" and all their commission records?`)) return
    await supabase.from('clients').delete().eq('id', client.id)
    load()
  }

  const consultantName = (id) => consultants.find((c) => c.id === id)?.name || '—'
  const shown = (clients || []).filter((c) => filter === 'all' || c.status === filter)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p>Affiliate clients and their commission agreements.</p>
        </div>
        {isAdmin && <button className="btn primary" onClick={openNew}>+ New client</button>}
      </div>

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="lapsed">Lapsed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Product</th><th className="num">Premium</th>
                <th className="num">Comm. %</th><th>Frequency</th><th>Consultants</th>
                <th>Start</th><th>Status</th>{isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {clients === null ? null : shown.length === 0 ? (
                <tr><td colSpan={9}><Empty>No clients yet{isAdmin && ' — add your first one'}.</Empty></td></tr>
              ) : shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.company && <span className="cell-sub">{c.company}</span>}
                  </td>
                  <td>{c.product_type || '—'}</td>
                  <td className="num">{money(c.premium, c.currency)}</td>
                  <td className="num">{pct(c.commission_pct)}</td>
                  <td>{FREQUENCY_LABELS[c.frequency]}</td>
                  <td>
                    {links.filter((l) => l.client_id === c.id).map((l) => (
                      <span key={l.id} className="badge navy" style={{ marginRight: 4 }}>
                        {consultantName(l.consultant_id)}
                        {l.payout_pct_override != null && ` · ${l.payout_pct_override}%`}
                      </span>
                    ))}
                  </td>
                  <td>{fmtDate(c.start_date)}</td>
                  <td><Badge status={c.status} /></td>
                  {isAdmin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn outline sm" onClick={() => openEdit(c)}>Edit</button>{' '}
                      <button className="btn danger-ghost sm" onClick={() => remove(c)}>Delete</button>
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
          title={editing.id ? 'Edit client' : 'New client'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" onClick={save}>Save client</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <ClientForm
            value={editing}
            consultants={consultants}
            onChange={setEditing}
          />
        </Modal>
      )}
    </>
  )
}

function ClientForm({ value, consultants, onChange }) {
  const c = value.client
  const set = (k, v) => onChange({ ...value, client: { ...c, [k]: v } })
  const setSplits = (splits) => onChange({ ...value, splits })

  return (
    <>
      <div className="form-row">
        <Field label="Client name *">
          <input value={c.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Company">
          <input value={c.company || ''} onChange={(e) => set('company', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Email">
          <input type="email" value={c.email || ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <input value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Product / policy type">
          <input value={c.product_type || ''} onChange={(e) => set('product_type', e.target.value)} placeholder="e.g. International health plan" />
        </Field>
        <Field label="Policy start date *">
          <input type="date" value={c.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
      </div>
      <div className="form-row-3">
        <Field label="Premium / policy value *">
          <input type="number" step="0.01" value={c.premium} onChange={(e) => set('premium', e.target.value)} />
        </Field>
        <Field label="Currency">
          <select value={c.currency} onChange={(e) => set('currency', e.target.value)}>
            <option>USD</option><option>THB</option>
          </select>
        </Field>
        <Field label="Commission % *">
          <input type="number" step="0.01" value={c.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Payment frequency" hint="Expected commission = premium × commission %, generated on this cadence.">
          <select value={c.frequency} onChange={(e) => set('frequency', e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi_annual">Semi-annual</option>
            <option value="annual">Annual</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={c.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="lapsed">Lapsed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>

      <Field
        label="Assigned consultants"
        hint="Leave the % blank to use each consultant's default payout %. The % is that consultant's share of the received commission."
      >
        {value.splits.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              style={{ flex: 2 }}
              value={s.consultant_id}
              onChange={(e) => {
                const splits = [...value.splits]
                splits[i] = { ...s, consultant_id: e.target.value }
                setSplits(splits)
              }}
            >
              <option value="">Select consultant…</option>
              {consultants.map((co) => (
                <option key={co.id} value={co.id}>{co.name} (default {co.default_payout_pct}%)</option>
              ))}
            </select>
            <input
              style={{ flex: 1 }}
              type="number"
              step="0.01"
              placeholder="% override"
              value={s.payout_pct_override}
              onChange={(e) => {
                const splits = [...value.splits]
                splits[i] = { ...s, payout_pct_override: e.target.value }
                setSplits(splits)
              }}
            />
            <button
              className="btn danger-ghost sm"
              type="button"
              onClick={() => setSplits(value.splits.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="btn outline sm"
          type="button"
          onClick={() => setSplits([...value.splits, { consultant_id: '', payout_pct_override: '' }])}
        >
          + Add consultant
        </button>
      </Field>

      <Field label="Notes">
        <textarea rows={2} value={c.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </>
  )
}
