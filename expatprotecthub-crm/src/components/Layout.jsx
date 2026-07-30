import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../App.jsx'

const STAFF_LINKS = [
  ['/', 'Dashboard'],
  ['/clients', 'Clients'],
  ['/consultants', 'Consultants'],
  ['/commissions', 'Commissions'],
  ['/payouts', 'Payouts'],
  ['/expenses', 'Expenses'],
  ['/reports', 'Reports'],
]

export default function Layout({ children }) {
  const { session, role } = useSession()
  const isStaff = role === 'admin' || role === 'bookkeeper'

  const links = isStaff
    ? role === 'admin' ? [...STAFF_LINKS, ['/settings', 'Settings']] : STAFF_LINKS
    : [['/', 'My Earnings']]

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          ExpatProtect<span>Hub</span>
          <small>Commission CRM</small>
        </div>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        <div className="user-box">
          <div className="email">{session.user.email}</div>
          <div className="role">{role}</div>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
