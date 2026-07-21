export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          {title}
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

const STATUS_COLORS = {
  pending: 'yellow',
  overdue: 'red',
  received: 'green',
  paid: 'green',
  active: 'teal',
  lapsed: 'yellow',
  cancelled: 'gray',
  draft: 'gray',
  admin: 'navy',
  bookkeeper: 'teal',
  consultant: 'gray',
}

export function Badge({ status, children }) {
  return <span className={`badge ${STATUS_COLORS[status] || 'gray'}`}>{children || status}</span>
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}
