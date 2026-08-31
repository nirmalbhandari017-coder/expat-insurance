import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { money, fmtDate, FREQUENCY_LABELS } from '../lib/format.js'

/**
 * Activations Regency has sent that are not yet clients.
 *
 * The Apps Script parses each Certificate of Insurance into
 * inbound_activations; nothing becomes a client until someone presses Import
 * here. That review step is deliberate — Regency's figures have needed
 * correcting before (a premium, two dates, and commission rates that turn out
 * to vary per client), and a wrong premium propagates straight through the
 * commission and both owner payouts.
 */
export default function InboundActivations() {
  const { role } = useSession()
  const isAdmin = role === 'admin'

  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const { data, error } = await supabase
      .from('inbound_activations')
      .select('*')
      .eq('status', 'new')
      .order('email_date', { ascending: false })
    if (error) setError(error.message)
    setRows(data || [])
    setBusy(false)
    return data || []
  }, [])

  useEffect(() => { load() }, [load])

  async function refresh() {
    const found = await load()
    setNote(found.length
      ? `${found.length} activation${found.length > 1 ? 's' : ''} waiting to be imported.`
      : 'Nothing new from Regency.')
  }

  async function importOne(row) {
    setError('')
    setImporting(row.id)
    // The rate is not on the certificate — Regency sets it per client — so it
    // starts at the standard 37.5% and is checked against the next statement.
    const { error } = await supabase.rpc('import_activation', {
      p_activation_id: row.id,
      p_commission_pct: Number(row._pct ?? 37.5),
    })
    setImporting(null)
    if (error) return setError(error.message)
    setNote(`${row.client_name} imported.`)
    load()
  }

  async function ignore(row) {
    if (!confirm(`Hide ${row.client_name || row.policy_number} from this list?`)) return
    await supabase.from('inbound_activations').update({ status: 'ignored' }).eq('id', row.id)
    load()
  }

  const setPct = (id, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _pct: value } : r)))

  // Stay out of the way when there is nothing to act on.
  if (rows === null || (rows.length === 0 && !note)) return null

  return (
    <div className="card inbound" style={{ marginTop: 16 }}>
      <div className="card-title inbound-head">
        <span>From Regency</span>
        <button className="btn outline sm" onClick={refresh} disabled={busy}>
          {busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {rows.length === 0 ? (
        <div className="attn-empty">{note}</div>
      ) : (
        <>
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            Parsed from the Certificate of Insurance. Check the figures before importing —
            the commission rate is a default, not something the certificate states.
          </p>

          {rows.map((r) => (
            <div key={r.id} className="inbound-row">
              <div className="inbound-main">
                <strong>{r.client_name || '(name not parsed)'}</strong>
                <span className="cell-sub">{r.policy_number} · {r.plan_name || '—'}</span>
                {r.parse_warnings?.length > 0 && (
                  <span className="cell-sub warn-text">
                    Check manually: {r.parse_warnings.join(', ')}
                  </span>
                )}
              </div>

              <div className="inbound-facts">
                <span><b>{money(r.premium, r.currency)}</b> {FREQUENCY_LABELS[r.frequency] || ''}</span>
                <span className="cell-sub">
                  starts {fmtDate(r.commencement_date)} · paid {fmtDate(r.email_date)}
                </span>
              </div>

              {isAdmin && (
                <div className="inbound-actions">
                  <label className="pct">
                    <input
                      type="number" step="0.01" style={{ width: 68 }}
                      value={r._pct ?? 37.5}
                      onChange={(e) => setPct(r.id, e.target.value)}
                    />
                    <span>%</span>
                  </label>
                  <button
                    className="btn primary sm"
                    disabled={importing === r.id || !r.premium || !r.commencement_date}
                    onClick={() => importOne(r)}
                  >
                    {importing === r.id ? 'Importing…' : 'Import'}
                  </button>
                  <button className="btn danger-ghost sm" onClick={() => ignore(r)}>Hide</button>
                </div>
              )}
            </div>
          ))}

          {!isAdmin && (
            <p className="small muted">Only an admin can import these.</p>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>
            Imported clients appear under <Link to="/clients">Clients</Link>.
          </p>
        </>
      )}
    </div>
  )
}
