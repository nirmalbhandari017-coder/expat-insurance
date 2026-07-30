export default function Setup() {
  return (
    <div className="auth-wrap">
      <div className="auth-card wide">
        <div className="brand-mark">ExpatProtectHub · Commission CRM</div>
        <h1>One-time setup needed</h1>
        <p className="sub">The app is built but not yet connected to its database.</p>
        <ol style={{ paddingLeft: 20, display: 'grid', gap: 12, fontSize: 13.5 }}>
          <li>
            Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.
          </li>
          <li>
            In the Supabase dashboard, open <strong>SQL Editor</strong> and run the contents of{' '}
            <code className="inline">supabase/schema.sql</code> from this repository.
          </li>
          <li>
            Copy the project's <strong>URL</strong> and <strong>anon public key</strong> from{' '}
            Settings → API, and put them in <code className="inline">expatprotecthub-crm/.env</code>:
            <pre style={{ background: '#EDF0F3', padding: 12, borderRadius: 8, marginTop: 8, fontSize: 12 }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
            </pre>
          </li>
          <li>Rebuild (<code className="inline">npm run build</code>) and reload this page.</li>
          <li>Sign up with your own email first — <strong>the first account automatically becomes the admin</strong>.</li>
        </ol>
      </div>
    </div>
  )
}
