import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, Badge, Empty } from '../components/ui.jsx'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [consultants, setConsultants] = useState([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [s, p, c] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('consultants').select('id, name').order('name'),
    ])
    setSettings(s.data)
    setProfiles(p.data || [])
    setConsultants(c.data || [])
  }
  useEffect(() => { load() }, [])

  async function saveTax() {
    setError(''); setSaved(false)
    const { error } = await supabase
      .from('app_settings')
      .update({
        incoming_tax_reserve_pct: Number(settings.incoming_tax_reserve_pct),
        default_withholding_pct: Number(settings.default_withholding_pct),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    if (error) return setError(error.message)
    setSaved(true)
  }

  async function updateProfile(id, patch) {
    setError('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  if (!settings || !profiles) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Tax configuration and team access.</p>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="card">
        <div className="card-title">Tax rates</div>
        <div className="card-body">
          <div className="form-row">
            <Field
              label="Incoming tax reserve %"
              hint="Set aside from every received commission for the company's own tax liability. Shown on each commission — does not reduce consultant payouts."
            >
              <input
                type="number" step="0.01"
                value={settings.incoming_tax_reserve_pct}
                onChange={(e) => setSettings({ ...settings, incoming_tax_reserve_pct: e.target.value })}
              />
            </Field>
            <Field
              label="Default consultant withholding %"
              hint="Deducted from consultant payouts before payment. Can be overridden per consultant."
            >
              <input
                type="number" step="0.01"
                value={settings.default_withholding_pct}
                onChange={(e) => setSettings({ ...settings, default_withholding_pct: e.target.value })}
              />
            </Field>
          </div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Rate changes apply to commissions received <em>after</em> the change — already-received
            records keep the rate that was snapshotted at receipt.
          </p>
          <button className="btn primary" onClick={saveTax}>Save tax settings</button>
          {saved && <span className="small" style={{ color: 'var(--green)', marginLeft: 12 }}>Saved ✓</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Team access</div>
        <div className="card-body">
          <p className="small muted" style={{ marginBottom: 0 }}>
            Team members sign up themselves on the login page, then you assign their role here.
            New accounts default to <strong>consultant</strong> with no linked consultant record —
            they can see nothing until you link them.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Role</th><th>Linked consultant</th></tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr><td colSpan={3}><Empty>No users yet.</Empty></td></tr>
              ) : profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.full_name || p.email}</strong>
                    <span className="cell-sub">{p.email}</span>
                  </td>
                  <td>
                    <select
                      value={p.role}
                      onChange={(e) => updateProfile(p.id, { role: e.target.value })}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'var(--font)' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="bookkeeper">Bookkeeper</option>
                      <option value="consultant">Consultant</option>
                    </select>
                  </td>
                  <td>
                    {p.role === 'consultant' ? (
                      <select
                        value={p.consultant_id || ''}
                        onChange={(e) => updateProfile(p.id, { consultant_id: e.target.value || null })}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'var(--font)' }}
                      >
                        <option value="">— not linked (no access) —</option>
                        {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <Badge status={p.role} />
                    )}
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
