import { useEffect, useState } from 'react'
import { Plus, Users, Trash2, X } from 'lucide-react'
import { api } from '../../api'
import type { Trip, WorkspaceData } from '../../types'

export interface ExpensesTabProps {
  tripId: string
  trip: Trip
  expenses: WorkspaceData['expenses']
  members: WorkspaceData['members']
  onRefresh: () => void
}

export function ExpensesTab({ tripId, trip, expenses, members, onRefresh }: ExpensesTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
  const [settlementForm, setSettlementForm] = useState({ toUserId: members[0]?.id || '', amount: '1000' })
  const [settlements, setSettlements] = useState<{ id: string; from_user_name: string; to_user_name: string; amount: number; status: string }[]>([])

  useEffect(() => {
    api<typeof settlements>(`/api/trips/${tripId}/settlements`).then(setSettlements).catch(() => undefined)
  }, [tripId])

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const addExpense = async () => {
    if (!form.title.trim() || !form.amount) return
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ tripId, title: form.title, category: form.category, amount: Number(form.amount), expenseDate: form.expenseDate }),
    })
    setShowModal(false)
    setForm({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
    onRefresh()
  }

  const deleteExpense = async (id: string) => {
    await api(`/api/expenses/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const recordSettlement = async () => {
    if (!settlementForm.toUserId || !settlementForm.amount) return
    await api(`/api/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify({ toUserId: settlementForm.toUserId, amount: Number(settlementForm.amount) }),
    })
    setShowSettlementModal(false)
    api<typeof settlements>(`/api/trips/${tripId}/settlements`).then(setSettlements)
  }

  return (
    <div className="workspace-content">
      <div className="expense-summary detailed-expense-summary">
        <div>
          <span>Total trip budget</span>
          <strong>৳ {Number(trip.budget).toLocaleString()}</strong>
          <small>Planned budget</small>
        </div>
        <div>
          <span>Total spent</span>
          <strong>৳ {total.toLocaleString()}</strong>
          <small className="positive">{total <= trip.budget ? 'Within budget' : 'Over budget'}</small>
        </div>
        <div>
          <span>Remaining</span>
          <strong>৳ {Math.max(0, trip.budget - total).toLocaleString()}</strong>
          <small>BDT native</small>
        </div>
        <div className="budget-progress">
          <div className="budget-label">
            <span>Utilization</span>
            <strong>{trip.budget > 0 ? Math.round((total / trip.budget) * 100) : 0}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: `${trip.budget > 0 ? Math.min(100, Math.round((total / trip.budget) * 100)) : 0}%` }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
        <h2>Expense ledger</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-btn" onClick={() => setShowSettlementModal(true)}><Users size={15} /> Settle balances</button>
          <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={15} /> Add expense</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Paid by</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td><strong>{exp.title}</strong></td>
                <td><span className="badge badge-blue">{exp.category}</span></td>
                <td>{exp.paid_by_name}</td>
                <td>{exp.expense_date}</td>
                <td><strong>৳ {Number(exp.amount).toLocaleString()}</strong></td>
                <td>
                  <button className="icon-btn" onClick={() => deleteExpense(exp.id)} title="Delete expense"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#889' }}>No expenses recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {settlements.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3>Settlements recorded</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td>{s.from_user_name}</td>
                    <td>{s.to_user_name}</td>
                    <td>৳ {Number(s.amount).toLocaleString()}</td>
                    <td><span className="badge badge-green">{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add an expense</h2>
            <label>Description<input autoFocus placeholder="e.g. Dinner at Salt & Pepper" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Food & drink</option>
                <option>Stay</option>
                <option>Transport</option>
                <option>Activities</option>
                <option>Other</option>
              </select>
            </label>
            <label>Amount (BDT)<input type="number" min="1" placeholder="1850" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>Date<input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={addExpense}>Save expense</button>
            </div>
          </div>
        </div>
      )}

      {showSettlementModal && (
        <div className="modal-backdrop" onClick={() => setShowSettlementModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSettlementModal(false)}><X size={18} /></button>
            <h2>Record a settlement</h2>
            <label>Pay to traveler
              <select value={settlementForm.toUserId} onChange={(e) => setSettlementForm({ ...settlementForm, toUserId: e.target.value })}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </label>
            <label>Amount (BDT)<input type="number" min="1" value={settlementForm.amount} onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowSettlementModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={recordSettlement}>Record payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpensesTab
