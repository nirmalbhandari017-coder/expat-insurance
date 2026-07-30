import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { pct } from '../lib/format.js'

const BLANK = {
  first_name: '', last_name: '', role: 'consultant', email: '', phone: '',
  payment_details: '', default_payout_pct: '', default_basis: 'premium',
  default_fixed_amount: '', withholding_applies: false, withholding_pct_override: '',
  is_owner: false, active: true, notes: '',
}

const ROLES = [
  ['owner', 'Owner'],
  ['consultant', 'Consultant'],
  ['referral_partner', 'Referral partner'],
  ['lead_generator', 'Lead generator'],
  ['affiliate', 'Affiliate'],
  ['other', 'Other recipient'],
]

const BASES = [
  ['premium', 'Premium received'],
  ['commission', 'Company commission'],
  ['profit', 'Profit'],
  ['fixed', 'Fixed amount'],
]

const BASIS_LABEL = Object.fromEntries(BASES)
const ROLE_LABEL = Object.fromEntries(ROLES)

export default function People() {
  const { role } = useSession()
  const isAdmin = role === 'admin'
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('people').select('*').order('full_name')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setError('')
    const v = editing.value
    const num = (x) => (x === '' || x == null ? null : Number(x))
    const payload = {
      first_name: v.first_name,
      last_name: v.last_name || '',
      role: v.role,
      email: v.email || null,
      phone: v.phone || null,
      payment_details: v.payment_details || null,
      default_payout_pct: v.default_basis === 'fixed' ? null : num(v.default_payout_pct),
      default_basis: v.default_basis,
      default_fixed_amount: v.default_basis === 'fixed' ? num(v.default_fixed_amount) : null,
      withholding_applies: v.withholding_applies,
      withholding_pct_override: v.withholding_applies ? num(v.withholding_pct_override) : null,
      is_owner: v.role === 'owner' ? true : v.is_owner,
      active: v.active,
      notes: v.notes || null,
    }
    const q = editing.id
      ? supabase.from('people').update(payload).eq('id', editing.id)
      : supabase.from('people').insert(payload)
    const { error } = await q
    if (error) return setError(error.message)
    setEditing(null)
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>
            Owners, consultants and any other payout recipient. Each person has a percentage
            <em> and</em> a basis — Simon&apos;s 10% comes off the premium, owner splits come off
            the commission.
          </p>
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={() => setEditing({ value: { ...BLANK }, id: null })}>
            + New person
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Contact</th>
                <th className="num">Default rate</th><th>Calculated from</th>
                <th className="num">Withholding</th><th>Status</th>{isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows === null ? null : rows.length === 0 ? (
                <tr><td colSpan={8}><Empty>No people yet.</Empty></td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.full_name}</strong>
                    {r.is_owner && <span className="cell-sub">part owner</span>}
                  </td>
                  <td><Badge status={r.role === 'owner' ? 'admin' : 'consultant'}>{ROLE_LABEL[r.role]}</Badge></td>
                  <td>
                    {r.email || '—'}
                    {r.phone && <span className="cell-sub">{r.phone}</span>}
                  </td>
                  <td className="num">
                    {r.default_basis === 'fixed'
                      ? (r.default_fixed_amount != null ? r.default_fixed_amount : '—')
                      : (r.default_payout_pct != null ? pct(r.default_payout_pct) : <span className="muted">per client</span>)}
                  </td>
                  <td className="small">{BASIS_LABEL[r.default_basis]}</td>
                  <td className="num">
                    {r.withholding_applies
                      ? (r.withholding_pct_override != null ? pct(r.withholding_pct_override) : <span className="muted">default</span>)
                      : <span className="muted">none</span>}
                  </td>
                  <td><Badge status={r.active ? 'active' : 'cancelled'}>{r.active ? 'active' : 'inactive'}</Badge></td>
                  {isAdmin && (
                    <td>
                      <button
                        className="btn outline sm"
                        onClick={() => setEditing({
                          id: r.id,
                          value: {
                            ...r,
                            default_payout_pct: r.default_payout_pct ?? '',
                            default_fixed_amount: r.default_fixed_amount ?? '',
                            withholding_pct_override: r.withholding_pct_override ?? '',
                            email: r.email ?? '',
                            phone: r.phone ?? '',
                            payment_details: r.payment_details ?? '',
                            notes: r.notes ?? '',
                          },
                        })}
                      >
                        Edit
                      </button>
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
          title={editing.id ? 'Edit person' : 'New person'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" onClick={save}>Save</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <PersonForm value={editing.value} onChange={(v) => setEditing({ ...editing, value: v })} />
        </Modal>
      )}
    </>
  )
}

function PersonForm({ value: v, onChange }) {
  const set = (k, val) => onChange({ ...v, [k]: val })
  const isFixed = v.default_basis === 'fixed'

  return (
    <>
      <div className="form-row">
        <Field label="First name *">
          <input value={v.first_name} onChange={(e) => set('first_name', e.target.value)} />
        </Field>
        <Field label="Last name">
          <input value={v.last_name} onChange={(e) => set('last_name', e.target.value)} />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Role">
          <select
            value={v.role}
            onChange={(e) => set('role', e.target.value)}
          >
            {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Active">
          <select value={v.active ? 'yes' : 'no'} onChange={(e) => set('active', e.target.value === 'yes')}>
            <option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
      </div>

      <div className="form-row">
        <Field label="Email">
          <input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <input value={v.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
      </div>

      <Field
        label="Calculated from"
        hint="This is the important one. A consultant's percentage is normally taken from the premium received; an owner's share comes out of the company commission."
      >
        <select value={v.default_basis} onChange={(e) => set('default_basis', e.target.value)}>
          {BASES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Field>

      <div className="form-row">
        {isFixed ? (
          <Field label="Fixed amount">
            <input
              type="number" step="0.01"
              value={v.default_fixed_amount}
              onChange={(e) => set('default_fixed_amount', e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Default rate %" hint="Leave blank if it's always set per client (owners usually are).">
            <input
              type="number" step="0.0001"
              value={v.default_payout_pct}
              onChange={(e) => set('default_payout_pct', e.target.value)}
              placeholder="per client"
            />
          </Field>
        )}
        <Field label="Withholding tax applies?">
          <select
            value={v.withholding_applies ? 'yes' : 'no'}
            onChange={(e) => set('withholding_applies', e.target.value === 'yes')}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>

      {v.withholding_applies && (
        <Field label="Withholding % override" hint="Leave blank to use the company default from Settings.">
          <input
            type="number" step="0.0001"
            value={v.withholding_pct_override}
            onChange={(e) => set('withholding_pct_override', e.target.value)}
            placeholder="default"
          />
        </Field>
      )}

      <Field label="Payment details">
        <textarea rows={2} value={v.payment_details} onChange={(e) => set('payment_details', e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </>
  )
}
