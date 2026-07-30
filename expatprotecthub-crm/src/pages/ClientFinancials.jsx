import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { fmtDate, pct, today, FREQUENCY_LABELS } from '../lib/format.js'
import { useCurrency, fmt, displayAmount, sumIn, convert } from '../lib/currency.jsx'

const BASIS_LABEL = {
  premium: 'premium received',
  commission: 'company commission',
  profit: 'profit',
  fixed: 'fixed amount',
}

/**
 * The client's whole financial picture: the premium schedule, what the company
 * earns, who gets paid out of it, and what's left. Payout rules live here
 * because the split between owners varies per client (spec §3).
 */
export default function ClientFinancials() {
  const { id } = useParams()
  const { role } = useSession()
  const isAdmin = role === 'admin'
  const { display, rate } = useCurrency()

  const [client, setClient] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [commissions, setCommissions] = useState([])
  const [payouts, setPayouts] = useState([])
  const [rules, setRules] = useState([])
  const [people, setPeople] = useState([])
  const [receiving, setReceiving] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const [c, s, cm, p, r, pe] = await Promise.all([
      supabase.from('clients')
        .select('*, generator:lead_generators(name, is_referral), referred_by:people(full_name)')
        .eq('id', id).single(),
      supabase.from('premium_payments').select('*').eq('client_id', id).order('installment_no'),
      supabase.from('commissions').select('*').eq('client_id', id).order('due_date'),
      supabase.from('payouts')
        .select('*, person:people(full_name, role), premium_payment:premium_payments(installment_no)')
        .order('created_at'),
      supabase.from('client_payout_rules').select('*, person:people(full_name, role, is_owner)').eq('client_id', id),
      supabase.from('people').select('id, full_name, role, is_owner, default_payout_pct, default_basis').eq('active', true).order('full_name'),
    ])
    setClient(c.data)
    setSchedule(s.data || [])
    setCommissions(cm.data || [])
    const scheduleIds = new Set((s.data || []).map((x) => x.id))
    const commissionIds = new Set((cm.data || []).map((x) => x.id))
    setPayouts((p.data || []).filter(
      (x) => scheduleIds.has(x.premium_payment_id) || commissionIds.has(x.commission_id),
    ))
    setRules(r.data || [])
    setPeople(pe.data || [])
  }
  useEffect(() => { load() }, [id])

  if (!client) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const cur = client.currency
  const premiumTotal = Number(client.premium) || 0
  const premiumReceived = schedule.reduce((a, s) => a + Number(s.amount_received || 0), 0)
  const premiumOutstanding = schedule
    .filter((s) => s.status !== 'cancelled')
    .reduce((a, s) => a + (Number(s.amount_due) - Number(s.amount_received || 0)), 0)

  const commissionEarned = commissions.reduce((a, c) => a + Number(c.expected_amount || 0), 0)
  const commissionReceived = commissions
    .filter((c) => c.status === 'received')
    .reduce((a, c) => a + Number(c.received_amount || 0), 0)

  const payoutTotal = payouts.reduce((a, p) => a + Number(p.net_amount || 0), 0)
  const payoutPaid = payouts.filter((p) => p.status === 'paid').reduce((a, p) => a + Number(p.net_amount || 0), 0)
  const payoutPending = payoutTotal - payoutPaid

  // Contribution = what the company keeps from this client, before any general
  // overheads. Operating expenses are deliberately excluded (spec §13).
  const contribution = commissionReceived - payoutTotal

  const show = (v) => fmt(convert(v, cur, display, rate), display)

  async function generateSchedule() {
    setError('')
    const { error } = await supabase.rpc('generate_premium_schedule', { p_client_id: id, p_years: 2 })
    if (error) return setError(error.message)
    load()
  }

  async function recordPayment() {
    setError('')
    const { error } = await supabase.rpc('record_premium_payment', {
      p_installment_id: receiving.row.id,
      p_amount: Number(receiving.amount),
      p_received_date: receiving.date,
      p_fx_rate: receiving.fxRate ? Number(receiving.fxRate) : null,
    })
    if (error) return setError(error.message)
    setReceiving(null)
    load()
  }

  async function saveRule() {
    setError('')
    const v = editingRule
    const payload = {
      client_id: id,
      person_id: v.person_id,
      enabled: v.enabled,
      basis: v.basis,
      payout_pct: v.basis === 'fixed' ? null : Number(v.payout_pct),
      fixed_amount: v.basis === 'fixed' ? Number(v.fixed_amount) : null,
      notes: v.notes || null,
    }
    const q = v.id
      ? supabase.from('client_payout_rules').update(payload).eq('id', v.id)
      : supabase.from('client_payout_rules').insert(payload)
    const { error } = await q
    if (error) return setError(error.message)
    setEditingRule(null)
    load()
  }

  async function toggleRule(r) {
    await supabase.from('client_payout_rules').update({ enabled: !r.enabled }).eq('id', r.id)
    load()
  }

  // Owner allocation guard (spec §3): enabled commission-basis rules shouldn't
  // add up to more than the commission actually available.
  const ownerPctTotal = rules
    .filter((r) => r.enabled && r.basis === 'commission' && r.payout_pct != null)
    .reduce((a, r) => a + Number(r.payout_pct), 0)

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/clients" className="small">← Clients</Link>
          <h1>{client.name}</h1>
          <p>
            {client.company || '—'} · {FREQUENCY_LABELS[client.frequency]} ·{' '}
            {client.generator?.name ?? 'No source set'}
            {client.referred_by?.full_name && ` · referred by ${client.referred_by.full_name}`}
          </p>
        </div>
        <Badge status={client.status} />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="label">Premium</div>
          <div className="value">{show(premiumTotal)}</div>
          <div className="sub">{pct(client.commission_pct)} commission rate</div>
        </div>
        <div className="kpi">
          <div className="label">Premium received</div>
          <div className="value">{show(premiumReceived)}</div>
          <div className="sub">{show(premiumOutstanding)} outstanding</div>
        </div>
        <div className="kpi">
          <div className="label">Commission received</div>
          <div className="value">{show(commissionReceived)}</div>
          <div className="sub">of {show(commissionEarned)} earned</div>
        </div>
        <div className="kpi warn">
          <div className="label">Payouts</div>
          <div className="value">{show(payoutTotal)}</div>
          <div className="sub">{show(payoutPending)} still pending</div>
        </div>
        <div className={contribution >= 0 ? 'kpi accent' : 'kpi danger'}>
          <div className="label">Contribution</div>
          <div className="value">{show(contribution)}</div>
          <div className="sub">commission received − payouts</div>
        </div>
      </div>

      {/* ---------- Premium schedule ---------- */}
      <div className="card">
        <div className="card-title">
          Premium schedule
          {isAdmin && schedule.length === 0 && (
            <button className="btn outline sm" onClick={generateSchedule}>Generate schedule</button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Due</th><th className="num">Due amount</th>
                <th className="num">Received</th><th>Received on</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {schedule.length === 0 ? (
                <tr><td colSpan={7}><Empty>No schedule yet — generate one from the payment frequency.</Empty></td></tr>
              ) : schedule.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.installment_no}</td>
                  <td>{fmtDate(s.due_date)}</td>
                  <td className="num">{displayAmount(s, display, rate, { amount: 'amount_due' })}</td>
                  <td className="num">
                    {Number(s.amount_received) > 0
                      ? displayAmount(s, display, rate, { amount: 'amount_received' })
                      : '—'}
                  </td>
                  <td>{fmtDate(s.received_date)}</td>
                  <td><Badge status={s.status === 'paid' ? 'received' : s.status === 'overdue' ? 'overdue' : 'pending'}>
                    {s.status.replace(/_/g, ' ')}
                  </Badge></td>
                  <td>
                    {s.status !== 'paid' && s.status !== 'cancelled' && (
                      <button
                        className="btn primary sm"
                        onClick={() => setReceiving({
                          row: s,
                          amount: s.amount_due,
                          date: today(),
                          fxRate: '',
                        })}
                      >
                        Record payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Payout rules ---------- */}
      <div className="card">
        <div className="card-title">
          Who gets paid on this client
          {isAdmin && (
            <button
              className="btn outline sm"
              onClick={() => setEditingRule({
                person_id: '', enabled: true, basis: 'premium', payout_pct: '', fixed_amount: '', notes: '',
              })}
            >
              + Add recipient
            </button>
          )}
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <p className="small muted">
            A percentage taken from the <strong>premium</strong> is paid as each instalment comes in.
            A percentage of the <strong>commission</strong> is the owner distribution.
          </p>
          {ownerPctTotal > 100 && (
            <div className="auth-error" style={{ marginTop: 10 }}>
              Owner allocation totals {ownerPctTotal}% of the commission — more than is available.
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recipient</th><th>Role</th><th className="num">Rate</th>
                <th>Calculated from</th><th>Enabled</th>{isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr><td colSpan={6}><Empty>No recipients configured for this client.</Empty></td></tr>
              ) : rules.map((r) => (
                <tr key={r.id} style={r.enabled ? undefined : { opacity: 0.55 }}>
                  <td><strong>{r.person?.full_name}</strong></td>
                  <td className="small">{r.person?.is_owner ? 'owner' : r.person?.role?.replace(/_/g, ' ')}</td>
                  <td className="num">
                    {r.basis === 'fixed' ? show(r.fixed_amount) : pct(r.payout_pct)}
                  </td>
                  <td className="small">{BASIS_LABEL[r.basis]}</td>
                  <td>
                    <Badge status={r.enabled ? 'active' : 'cancelled'}>
                      {r.enabled ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                  {isAdmin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn outline sm" onClick={() => toggleRule(r)}>
                        {r.enabled ? 'Turn off' : 'Turn on'}
                      </button>{' '}
                      <button
                        className="btn outline sm"
                        onClick={() => setEditingRule({
                          id: r.id,
                          person_id: r.person_id,
                          enabled: r.enabled,
                          basis: r.basis,
                          payout_pct: r.payout_pct ?? '',
                          fixed_amount: r.fixed_amount ?? '',
                          notes: r.notes ?? '',
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

      {/* ---------- Payouts generated ---------- */}
      <div className="card">
        <div className="card-title">Payouts on this client</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recipient</th><th>From</th><th className="num">Basis amount</th>
                <th className="num">Rate</th><th className="num">Gross</th>
                <th className="num">Tax</th><th className="num">Net</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr><td colSpan={8}><Empty>No payouts yet — they appear as premium instalments are received.</Empty></td></tr>
              ) : payouts.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.person?.full_name ?? '—'}</strong></td>
                  <td className="small">
                    {p.premium_payment
                      ? `Instalment ${p.premium_payment.installment_no}`
                      : 'Commission'}
                    <span className="cell-sub">{BASIS_LABEL[p.basis] ?? '—'}</span>
                  </td>
                  <td className="num">{p.basis_amount != null ? show(p.basis_amount) : '—'}</td>
                  <td className="num">{p.payout_pct != null ? pct(p.payout_pct) : '—'}</td>
                  <td className="num">{show(p.gross_amount)}</td>
                  <td className="num">
                    {show(p.tax_amount)}
                    {p.tax_pct != null && <span className="cell-sub">{p.tax_pct}%</span>}
                  </td>
                  <td className="num"><strong>{show(p.net_amount)}</strong></td>
                  <td>
                    <Badge status={p.status === 'paid' ? 'paid' : p.status === 'cancelled' ? 'cancelled' : 'pending'}>
                      {p.status}
                    </Badge>
                    {p.is_override && <span className="cell-sub">overridden</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Record payment modal ---------- */}
      {receiving && (
        <Modal
          title={`Record premium payment — instalment ${receiving.row.installment_no}`}
          onClose={() => setReceiving(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setReceiving(null)}>Cancel</button>
              <button className="btn primary" onClick={recordPayment}>Confirm received</button>
            </>
          }
        >
          <p className="small muted" style={{ marginBottom: 14 }}>
            Recording this creates the payouts for everyone paid from the premium, using the
            amount actually received.
          </p>
          <div className="form-row">
            <Field
              label="Amount received"
              hint={`Due: ${fmt(receiving.row.amount_due, cur)}. Enter less for a partial payment.`}
            >
              <input
                type="number" step="0.01"
                value={receiving.amount}
                onChange={(e) => setReceiving({ ...receiving, amount: e.target.value })}
              />
            </Field>
            <Field label="Date received">
              <input
                type="date"
                value={receiving.date}
                onChange={(e) => setReceiving({ ...receiving, date: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="USD↔THB rate used"
            hint="Optional. Leave blank to use the default rate from Settings. The original amount is never overwritten."
          >
            <input
              type="number" step="0.00000001"
              value={receiving.fxRate}
              onChange={(e) => setReceiving({ ...receiving, fxRate: e.target.value })}
              placeholder={`default (${rate})`}
            />
          </Field>
        </Modal>
      )}

      {/* ---------- Payout rule modal ---------- */}
      {editingRule && (
        <Modal
          title={editingRule.id ? 'Edit recipient' : 'Add recipient'}
          onClose={() => setEditingRule(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setEditingRule(null)}>Cancel</button>
              <button className="btn primary" onClick={saveRule}>Save</button>
            </>
          }
        >
          <Field label="Person *">
            <select
              value={editingRule.person_id}
              onChange={(e) => {
                const p = people.find((x) => x.id === e.target.value)
                setEditingRule({
                  ...editingRule,
                  person_id: e.target.value,
                  basis: p?.default_basis ?? editingRule.basis,
                  payout_pct: p?.default_payout_pct ?? editingRule.payout_pct,
                })
              }}
              disabled={!!editingRule.id}
            >
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.is_owner ? 'owner' : p.role.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Calculated from">
              <select
                value={editingRule.basis}
                onChange={(e) => setEditingRule({ ...editingRule, basis: e.target.value })}
              >
                <option value="premium">Premium received</option>
                <option value="commission">Company commission</option>
                <option value="profit">Profit</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            {editingRule.basis === 'fixed' ? (
              <Field label="Fixed amount">
                <input
                  type="number" step="0.01"
                  value={editingRule.fixed_amount}
                  onChange={(e) => setEditingRule({ ...editingRule, fixed_amount: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Rate %">
                <input
                  type="number" step="0.0001"
                  value={editingRule.payout_pct}
                  onChange={(e) => setEditingRule({ ...editingRule, payout_pct: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Enabled" hint="Turn off to keep the arrangement on record without paying it.">
            <select
              value={editingRule.enabled ? 'yes' : 'no'}
              onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option><option value="no">No</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea rows={2} value={editingRule.notes}
              onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </>
  )
}
