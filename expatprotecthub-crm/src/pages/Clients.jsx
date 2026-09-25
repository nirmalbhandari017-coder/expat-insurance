import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'
import { Modal, Field, Badge, Empty } from '../components/ui.jsx'
import { money, fmtDate, FREQUENCY_LABELS, today } from '../lib/format.js'
import { downloadCsv, stampedName } from '../lib/csv.js'

const BLANK = {
  name: '', company: '', email: '', phone: '', product_type: '',
  start_date: today(), premium: '', currency: 'USD', commission_pct: '',
  frequency: 'monthly', status: 'active', notes: '',
  generator_id: '', referred_by_id: '', policy_number: '',
}

export default function Clients() {
  const { role } = useSession()
  const isAdmin = role === 'admin'
  const [clients, setClients] = useState(null)
  const [consultants, setConsultants] = useState([])
  const [links, setLinks] = useState([]) // client_consultants
  const [editing, setEditing] = useState(null) // {client, splits: [{consultant_id, payout_pct_override}]}
  const [instalments, setInstalments] = useState([])
  const [generators, setGenerators] = useState([])
  const [people, setPeople] = useState([])
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('pay_desc')
  const [month, setMonth] = useState('all')
  const [error, setError] = useState('')
  const [managers, setManagers] = useState([])     // premium-basis payout rules
  const [selected, setSelected] = useState(() => new Set())
  const [assigning, setAssigning] = useState(null) // { person_id, pct }
  const [saving, setSaving] = useState(false)

  async function load() {
    const [c, co, cc, lg, pe, pp, mg] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('consultants').select('*').eq('active', true).order('name'),
      supabase.from('client_consultants').select('*'),
      supabase.from('lead_generators').select('id, name, is_referral').eq('is_active', true).order('sort_order'),
      supabase.from('people').select('id, full_name').eq('active', true).order('full_name'),
      supabase.from('premium_payments')
        .select('client_id, due_date, received_date, amount_due, amount_received, status')
        .order('due_date'),
      // The relationship manager is a premium-basis payout rule, not a
      // separate field — one place decides both who is shown and who is paid.
      supabase.from('client_payout_rules')
        .select('client_id, payout_pct, person_id, people(full_name)')
        .eq('basis', 'premium').eq('enabled', true),
    ])
    setClients(c.data || [])
    setConsultants(co.data || [])
    setLinks(cc.data || [])
    setGenerators(lg.data || [])
    setPeople(pe.data || [])
    setInstalments(pp.data || [])
    setManagers(mg.data || [])
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
      generator_id: c.generator_id || null,
      referred_by_id: c.referred_by_id || null,
      policy_number: c.policy_number || null,
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
  const managerOf = (clientId) => managers.find((r) => r.client_id === clientId) || null

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function applyAssignment() {
    setSaving(true)
    setError('')
    // One call per client: each rebuilds that client's payouts from its rules,
    // so the owner split shrinks by exactly what the manager now takes.
    for (const id of selected) {
      const { error } = await supabase.rpc('set_client_manager', {
        p_client_id: id,
        p_person_id: assigning.person_id || null,
        p_pct: Number(assigning.pct) || 0,
      })
      if (error) { setError(error.message); setSaving(false); return }
    }
    setSaving(false)
    setAssigning(null)
    setSelected(new Set())
    load()
  }

  /**
   * Premium payment state, derived from the instalment ledger. A client can
   * have many instalments, so a single stored date on the client record would
   * only ever be a stale copy of one of them.
   */
  function premiumState(clientId) {
    const rows = instalments.filter((i) => i.client_id === clientId && i.status !== 'cancelled')
    if (!rows.length) return { label: 'No schedule', tone: 'muted', sub: null }

    const paid = rows.filter((i) => Number(i.amount_received) > 0 && i.received_date)
    const lastPaid = paid.sort((a, b) => (a.received_date < b.received_date ? 1 : -1))[0]
    const overdue = rows.filter((i) => i.status === 'overdue')

    if (!lastPaid) {
      return overdue.length
        ? { label: 'Not paid', tone: 'bad', sub: `due ${fmtDate(overdue[0].due_date)}` }
        : { label: 'Awaiting', tone: 'muted', sub: `due ${fmtDate(rows[0].due_date)}` }
    }
    return {
      label: fmtDate(lastPaid.received_date),
      tone: overdue.length ? 'warn' : 'good',
      sub: overdue.length ? `${overdue.length} instalment(s) overdue` : `${paid.length} of ${rows.length} paid`,
    }
  }
  /** What the commission on this policy is actually worth over a year. */
  const commissionAmount = (c) =>
    (Number(c.premium) || 0) * (Number(c.commission_pct) || 0) / 100

  /** "2026-08" — the month part of a date, used for grouping and filtering. */
  const monthKey = (d) => (d ? String(d).slice(0, 7) : '')
  const monthLabel = (key) =>
    new Date(key + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  /**
   * When each client actually paid — the latest receipt in the instalment
   * ledger. A sale belongs to the month the money arrived, not the month cover
   * begins: Brett Wilson paid on 30 Jun for a policy starting 1 Sep, and he
   * counts as a June sale.
   */
  const paidOn = useMemo(() => {
    const m = new Map()
    for (const i of instalments) {
      if (!(Number(i.amount_received) > 0 && i.received_date)) continue
      const prev = m.get(i.client_id)
      if (!prev || i.received_date > prev) m.set(i.client_id, i.received_date)
    }
    return m
  }, [instalments])

  // Plan start date is a sort the user can choose; payment date is the default.
  const sortsByStart = sort === 'start_desc' || sort === 'start_asc'
  const dateOf = (c) => (sortsByStart ? c.start_date : paidOn.get(c.id)) || null

  // Only offer months that actually hold clients, on whichever axis is active.
  const months = useMemo(() => {
    const set = new Set((clients || []).map((c) => monthKey(dateOf(c))).filter(Boolean))
    return [...set].sort().reverse()
  }, [clients, paidOn, sortsByStart])

  const shown = useMemo(() => {
    // Unpaid clients have no date to sort on, so they settle at the bottom
    // rather than pretending to be the oldest or newest.
    const byDate = (a, b, dir) => {
      const A = dateOf(a)
      const B = dateOf(b)
      if (!A && !B) return a.name.localeCompare(b.name)
      if (!A) return 1
      if (!B) return -1
      return dir === 'asc' ? A.localeCompare(B) : B.localeCompare(A)
    }

    return (clients || [])
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) => month === 'all' || monthKey(dateOf(c)) === month)
      .sort((a, b) => {
        switch (sort) {
          case 'pay_asc': return byDate(a, b, 'asc')
          case 'start_desc': return byDate(a, b, 'desc')
          case 'start_asc': return byDate(a, b, 'asc')
          case 'name': return a.name.localeCompare(b.name)
          case 'premium_desc': return Number(b.premium) - Number(a.premium)
          case 'added': return String(b.created_at).localeCompare(String(a.created_at))
          default: return byDate(a, b, 'desc')   // pay_desc
        }
      })
  }, [clients, filter, month, sort, paidOn])

  /**
   * Premium and commission for whatever is on screen, kept per currency.
   * Adding USD to THB would produce a number that means nothing, so mixed
   * currencies get a line each rather than one misleading figure.
   */
  const totals = useMemo(() => {
    const m = new Map()
    for (const c of shown) {
      const cur = c.currency || 'USD'
      const t = m.get(cur) || { premium: 0, commission: 0, count: 0 }
      t.premium += Number(c.premium) || 0
      t.commission += commissionAmount(c)
      t.count += 1
      m.set(cur, t)
    }
    return [...m.entries()]
  }, [shown])

  // Any date sort breaks the table up with a heading per month.
  const grouped = sortsByStart || sort === 'pay_desc' || sort === 'pay_asc'

  function exportCsv() {
    downloadCsv(stampedName('clients'), [
      { key: 'name', header: 'Client' },
      { key: 'company', header: 'Company' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'policy_number', header: 'Policy number' },
      { key: 'product_type', header: 'Product' },
      { key: 'premium', header: 'Premium' },
      { key: 'currency', header: 'Currency' },
      { key: 'commission_pct', header: 'Commission %' },
      { header: 'Commission amount', format: (c) => commissionAmount(c).toFixed(2) },
      { header: 'Frequency', format: (c) => FREQUENCY_LABELS[c.frequency] },
      { header: 'Payment date', format: (c) => paidOn.get(c.id) ?? '' },
      { header: 'Payment month', format: (c) => monthKey(paidOn.get(c.id)) },
      { header: 'Payment status', format: (c) => premiumState(c.id).label },
      { key: 'start_date', header: 'Plan start date' },
      { header: 'Plan start month', format: (c) => monthKey(c.start_date) },
      { header: 'Manager', format: (c) => managerOf(c.id)?.people?.full_name ?? '' },
      { header: 'Manager %', format: (c) => managerOf(c.id)?.payout_pct ?? '' },
      { key: 'status', header: 'Status' },
    ], shown)
  }

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

        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          title={`Filter by ${sortsByStart ? 'plan start' : 'payment'} month`}
        >
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} title="Sort order">
          <option value="pay_desc">Payment date — newest first</option>
          <option value="pay_asc">Payment date — oldest first</option>
          <option value="start_desc">Plan start date — newest first</option>
          <option value="start_asc">Plan start date — oldest first</option>
          <option value="name">By name</option>
          <option value="premium_desc">By premium</option>
          <option value="added">Recently added</option>
        </select>

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button
              className="btn primary"
              disabled={selected.size === 0}
              onClick={() => setAssigning({ person_id: '', pct: 10 })}
            >
              Assign manager{selected.size > 0 && ` (${selected.size})`}
            </button>
          )}
          <button className="btn outline" onClick={exportCsv} disabled={!shown.length}>Export CSV</button>
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={shown.length > 0 && selected.size === shown.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(shown.map((c) => c.id)) : new Set())}
                      title="Select all shown"
                    />
                  </th>
                )}
                <th>Client</th><th>Product</th><th className="num">Premium</th>
                <th className="num">Commission</th><th>Frequency</th>
                <th>Payment date</th><th>Plan start date</th>
                <th>Manager</th><th>Status</th>{isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {clients === null ? null : shown.length === 0 ? (
                <tr><td colSpan={11}><Empty>No clients yet{isAdmin && ' — add your first one'}.</Empty></td></tr>
              ) : shown.map((c, i) => (
                <Fragment key={c.id}>
                {grouped && monthKey(dateOf(c)) !== monthKey(dateOf(shown[i - 1] ?? {})) && (
                  <tr className="group-row">
                    <td colSpan={isAdmin ? 11 : 9}>
                      {dateOf(c)
                        ? monthLabel(monthKey(dateOf(c)))
                        : (sortsByStart ? 'No start date' : 'Not paid yet')}
                    </td>
                  </tr>
                )}
                <tr className={selected.has(c.id) ? 'row-selected' : undefined}>
                  {isAdmin && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleRow(c.id)}
                      />
                    </td>
                  )}
                  <td>
                    <Link to={`/clients/${c.id}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                    {c.company && <span className="cell-sub">{c.company}</span>}
                  </td>
                  <td>{c.product_type || '—'}</td>
                  <td className="num">{money(c.premium, c.currency)}</td>
                  <td className="num">{money(commissionAmount(c), c.currency)}</td>
                  <td>{FREQUENCY_LABELS[c.frequency]}</td>
                  <td>
                    {(() => {
                      const p = premiumState(c.id)
                      const colour = p.tone === 'good' ? 'var(--green)'
                        : p.tone === 'bad' ? 'var(--red)'
                          : p.tone === 'warn' ? '#B4740A' : 'var(--text-faint)'
                      return (
                        <>
                          <span style={{ color: colour, fontWeight: p.tone === 'muted' ? 400 : 600 }}>
                            {p.label}
                          </span>
                          {p.sub && <span className="cell-sub">{p.sub}</span>}
                        </>
                      )
                    })()}
                  </td>
                  <td>{fmtDate(c.start_date)}</td>
                  <td>
                    {(() => {
                      const mg = managerOf(c.id)
                      return mg ? (
                        <span className="badge navy">
                          {mg.people?.full_name} · {Number(mg.payout_pct)}%
                        </span>
                      ) : <span className="muted">—</span>
                    })()}
                  </td>
                  <td><Badge status={c.status} /></td>
                  {isAdmin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn outline sm" onClick={() => openEdit(c)}>Edit</button>{' '}
                      <button className="btn danger-ghost sm" onClick={() => remove(c)}>Delete</button>
                    </td>
                  )}
                </tr>
                </Fragment>
              ))}
            </tbody>

            {shown.length > 0 && (
              <tfoot>
                {totals.map(([cur, t]) => (
                  <tr className="total-row" key={cur}>
                    <td colSpan={isAdmin ? 3 : 2}>
                      Total{totals.length > 1 && ` · ${cur}`}
                      <span className="cell-sub">
                        {t.count} client{t.count !== 1 && 's'}
                        {month !== 'all' && ` · ${monthLabel(month)}`}
                      </span>
                    </td>
                    <td className="num">{money(t.premium, cur)}</td>
                    <td className="num">{money(t.commission, cur)}</td>
                    <td colSpan={isAdmin ? 7 : 5} />
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {assigning && (
        <Modal
          title={`Assign manager — ${selected.size} client${selected.size !== 1 ? 's' : ''}`}
          onClose={() => setAssigning(null)}
          footer={
            <>
              <button className="btn outline" onClick={() => setAssigning(null)}>Cancel</button>
              <button className="btn primary" onClick={applyAssignment} disabled={saving}>
                {saving ? 'Applying…' : 'Apply'}
              </button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <p className="small muted" style={{ marginBottom: 14 }}>
            The manager takes their share of the <strong>premium received</strong>, before
            anything is split. Each client&apos;s payouts are recalculated straight away, so
            the owners&apos; share shrinks by exactly this amount. Money already marked paid
            is never rewritten.
          </p>
          <div className="form-row">
            <Field label="Manager">
              <select
                value={assigning.person_id}
                onChange={(e) => setAssigning({ ...assigning, person_id: e.target.value })}
              >
                <option value="">— none (remove manager) —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Share of premium %" hint="Simon's standard rate is 10%.">
              <input
                type="number" step="0.01"
                value={assigning.pct}
                onChange={(e) => setAssigning({ ...assigning, pct: e.target.value })}
                disabled={!assigning.person_id}
              />
            </Field>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Applies to: {shown.filter((c) => selected.has(c.id)).map((c) => c.name).join(', ')}
          </p>
        </Modal>
      )}

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
            generators={generators}
            people={people}
            onChange={setEditing}
          />
        </Modal>
      )}
    </>
  )
}

function ClientForm({ value, consultants, generators, people, onChange }) {
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

      <div className="form-row">
        <Field label="Lead source" hint="How this client reached the business.">
          <select value={c.generator_id || ''} onChange={(e) => set('generator_id', e.target.value)}>
            <option value="">— not set —</option>
            {(generators || []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Policy number">
          <input value={c.policy_number || ''} onChange={(e) => set('policy_number', e.target.value)} />
        </Field>
      </div>

      {(generators || []).find((g) => g.id === c.generator_id)?.is_referral && (
        <Field
          label="Referred by"
          hint="Referrals pay differently — the referrer is paid from the premium and other recipients are excluded."
        >
          <select value={c.referred_by_id || ''} onChange={(e) => set('referred_by_id', e.target.value)}>
            <option value="">— select —</option>
            {(people || []).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </Field>
      )}

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
