import { useEffect, useState } from 'react'
import { Plus, Users, Trash2, X, Check, Clock, CheckCircle2 } from 'lucide-react'
import { api, expensesApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import type { Settlement, Trip, WorkspaceData } from '../../types'

export interface ExpensesTabProps {
  tripId: string
  trip: Trip
  expenses: WorkspaceData['expenses']
  members: WorkspaceData['members']
  onRefresh: () => void
}

export function ExpensesTab({ tripId, trip, expenses, members, onRefresh }: ExpensesTabProps) {
  const { user: currentUser } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
  const [settlementForm, setSettlementForm] = useState({ toUserId: members[0]?.id || '', amount: '1000' })
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [settlementError, setSettlementError] = useState('')

  useEffect(() => {
    expensesApi.getSettlements(tripId).then(setSettlements).catch(() => undefined)
  }, [tripId])

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  // Trip-level settlements summary in BDT
  const settledTotal = settlements
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  const outstandingTotal = settlements
    .filter((s) => s.status !== 'CONFIRMED' && s.status !== 'CANCELLED')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  const pendingTotal = settlements
    .filter((s) => s.status === 'PENDING')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  const paidAwaitingConfirmTotal = settlements
    .filter((s) => s.status === 'PAID')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  const addExpense = async () => {
    if (!form.title.trim() || !form.amount) return
    await expensesApi.addExpense({
      tripId,
      title: form.title,
      category: form.category,
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
    })
    setShowModal(false)
    setForm({ title: '', category: 'Food & drink', amount: '', expenseDate: new Date().toISOString().slice(0, 10) })
    onRefresh()
  }

  const deleteExpense = async (id: string) => {
    await expensesApi.deleteExpense(id)
    onRefresh()
  }

  const recordSettlement = async () => {
    if (!settlementForm.toUserId || !settlementForm.amount) return
    setSettlementError('')
    try {
      const newSettlement = await expensesApi.recordSettlement(tripId, {
        toUserId: settlementForm.toUserId,
        amount: Number(settlementForm.amount),
        status: 'PENDING',
      })
      setShowSettlementModal(false)
      // Immediately add to state so totals update immediately
      setSettlements((prev) => [newSettlement, ...prev])
      setSettlementForm({ toUserId: members[0]?.id || '', amount: '1000' })
    } catch (err: any) {
      setSettlementError(err?.message || 'Failed to record settlement')
    }
  }

  const handleMarkPaid = async (settlementId: string) => {
    setUpdatingId(settlementId)
    setSettlementError('')
    try {
      const updated = await expensesApi.updateSettlementStatus(settlementId, 'PAID')
      // Immediately update local state so outstanding totals update immediately
      setSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, ...updated, status: 'PAID' } : s))
      )
    } catch (err: any) {
      setSettlementError(err?.message || 'Failed to mark as paid')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleConfirmReceived = async (settlementId: string) => {
    setUpdatingId(settlementId)
    setSettlementError('')
    try {
      const updated = await expensesApi.updateSettlementStatus(settlementId, 'CONFIRMED')
      // Immediately update local state so outstanding totals update immediately
      setSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, ...updated, status: 'CONFIRMED' } : s))
      )
    } catch (err: any) {
      setSettlementError(err?.message || 'Failed to confirm receipt')
    } finally {
      setUpdatingId(null)
    }
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
        <h2>Expense ledger</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-btn" onClick={() => setShowSettlementModal(true)}><Users size={17} /> Settle balances</button>
          <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={17} /> Add expense</button>
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
                  <button className="icon-btn" onClick={() => deleteExpense(exp.id)} title="Delete expense" aria-label="Delete expense"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#506155' }}>No expenses recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Settlements Section & Summary */}
      <div style={{ marginTop: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Settlements & Balances</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
              Track who owes whom, mark payments sent, and confirm receipt in BDT.
            </p>
          </div>
          <button className="secondary-btn" onClick={() => setShowSettlementModal(true)}>
            <Users size={17} /> Record payment
          </button>
        </div>

        {/* Trip-level summary of settled vs outstanding in BDT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px' }}>
              Settled (Confirmed)
            </span>
            <strong style={{ display: 'block', fontSize: '22px', color: '#059669', margin: '4px 0' }}>
              ৳ {settledTotal.toLocaleString()}
            </strong>
            <small style={{ color: '#059669', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Confirmed by creditor
            </small>
          </div>

          <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px' }}>
              Outstanding Balance
            </span>
            <strong style={{ display: 'block', fontSize: '22px', color: outstandingTotal > 0 ? '#d97706' : '#64748b', margin: '4px 0' }}>
              ৳ {outstandingTotal.toLocaleString()}
            </strong>
            <small style={{ color: outstandingTotal > 0 ? '#d97706' : '#64748b', fontSize: '12px' }}>
              {paidAwaitingConfirmTotal > 0
                ? `৳ ${paidAwaitingConfirmTotal.toLocaleString()} awaiting confirmation`
                : pendingTotal > 0
                ? `৳ ${pendingTotal.toLocaleString()} pending payment`
                : 'All settlements confirmed'}
            </small>
          </div>

          <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px' }}>
              Total Settlements
            </span>
            <strong style={{ display: 'block', fontSize: '22px', color: '#1e293b', margin: '4px 0' }}>
              ৳ {(settledTotal + outstandingTotal).toLocaleString()}
            </strong>
            <small style={{ color: '#64748b', fontSize: '12px' }}>
              {settlements.length} {settlements.length === 1 ? 'settlement recorded' : 'settlements recorded'}
            </small>
          </div>
        </div>

        {settlementError && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '6px', fontSize: '13.5px', marginBottom: '16px' }}>
            {settlementError}
          </div>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Debtor (From)</th>
                <th>Creditor (To)</th>
                <th>Amount (BDT)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => {
                const isDebtor = currentUser?.id === s.from_user_id
                const isCreditor = currentUser?.id === s.to_user_id
                const statusUpper = String(s.status || '').toUpperCase()

                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.from_user_name}</strong>
                      {isDebtor && <span className="badge badge-blue sm" style={{ marginLeft: '6px', fontSize: '12px' }}>You (Debtor)</span>}
                    </td>
                    <td>
                      <strong>{s.to_user_name}</strong>
                      {isCreditor && <span className="badge badge-green sm" style={{ marginLeft: '6px', fontSize: '12px' }}>You (Creditor)</span>}
                    </td>
                    <td>
                      <strong>৳ {Number(s.amount).toLocaleString()}</strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          statusUpper === 'CONFIRMED'
                            ? 'badge-green'
                            : statusUpper === 'PAID'
                            ? 'badge-blue'
                            : statusUpper === 'CANCELLED'
                            ? 'badge-gray'
                            : 'badge-orange'
                        }`}
                        style={
                          statusUpper === 'CONFIRMED'
                            ? { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }
                            : statusUpper === 'PAID'
                            ? { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }
                            : statusUpper === 'CANCELLED'
                            ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
                            : { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }
                        }
                      >
                        {statusUpper}
                      </span>
                    </td>
                    <td>
                      {/* Only the right user sees each button:
                          - Debtor sees "Mark as paid" when PENDING
                          - Creditor sees "Confirm received" when PAID */}
                      {statusUpper === 'PENDING' && isDebtor && (
                        <button
                          className="primary-btn sm"
                          style={{ height: '34px', padding: '0 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
                          onClick={() => handleMarkPaid(s.id)}
                          disabled={updatingId === s.id}
                        >
                          {updatingId === s.id ? 'Updating…' : 'Mark as paid'}
                        </button>
                      )}

                      {statusUpper === 'PAID' && isCreditor && (
                        <button
                          className="primary-btn sm"
                          style={{ height: '34px', padding: '0 14px', fontSize: '13px', background: '#059669', borderColor: '#059669', whiteSpace: 'nowrap' }}
                          onClick={() => handleConfirmReceived(s.id)}
                          disabled={updatingId === s.id}
                        >
                          {updatingId === s.id ? 'Confirming…' : 'Confirm received'}
                        </button>
                      )}

                      {statusUpper === 'PENDING' && !isDebtor && (
                        <small style={{ color: '#d97706', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> Awaiting payment
                        </small>
                      )}

                      {statusUpper === 'PAID' && !isCreditor && (
                        <small style={{ color: '#2563eb', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> Awaiting confirmation
                        </small>
                      )}

                      {statusUpper === 'CONFIRMED' && (
                        <span style={{ color: '#059669', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <Check size={14} /> Settled
                        </span>
                      )}

                      {statusUpper === 'CANCELLED' && (
                        <span className="badge badge-gray" style={{ fontSize: '12px' }}>Cancelled</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!settlements.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#506155' }}>
                    No settlements recorded yet. Click "Record payment" to log a balance settlement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close add expense modal"><X size={18} /></button>
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
            <button className="modal-close" onClick={() => setShowSettlementModal(false)} aria-label="Close settlement modal"><X size={18} /></button>
            <h2>Record a settlement</h2>
            <label>Pay to traveler
              <select value={settlementForm.toUserId} onChange={(e) => setSettlementForm({ ...settlementForm, toUserId: e.target.value })}>
                {members.filter((m) => m.id !== currentUser?.id).map((m) => (
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

