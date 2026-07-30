import { useEffect, useState, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import { isConfigured } from './lib/config.js'
import { CurrencyProvider } from './lib/currency.jsx'
import Layout from './components/Layout.jsx'
import Setup from './pages/Setup.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import ClientFinancials from './pages/ClientFinancials.jsx'
import People from './pages/People.jsx'
import Commissions from './pages/Commissions.jsx'
import Payouts from './pages/Payouts.jsx'
import Expenses from './pages/Expenses.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import MyEarnings from './pages/MyEarnings.jsx'

const SessionContext = createContext(null)
export const useSession = () => useContext(SessionContext)

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session?.user?.id])

  if (!isConfigured()) return <Setup />
  if (session === undefined) return <div className="empty" style={{ paddingTop: 120 }}>Loading…</div>
  if (!session) return <Login />
  if (!profile) return <div className="empty" style={{ paddingTop: 120 }}>Loading your account…</div>

  const role = profile.role
  const isStaff = role === 'admin' || role === 'bookkeeper'

  return (
    <SessionContext.Provider value={{ session, profile, role }}>
      <CurrencyProvider>
        <Layout>
          <Routes>
            {isStaff ? (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientFinancials />} />
                <Route path="/people" element={<People />} />
                <Route path="/commissions" element={<Commissions />} />
                <Route path="/payouts" element={<Payouts />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                {role === 'admin' && <Route path="/settings" element={<Settings />} />}
              </>
            ) : (
              <Route path="/" element={<MyEarnings />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </CurrencyProvider>
    </SessionContext.Provider>
  )
}
