import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../../api'
import type { Settlement, WorkspaceData } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function ExpensesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<{
    expenses: WorkspaceData['expenses']
    totalSpent: number
    totalBudget: number
    categories: Record<string, number>
    settlements?: Settlement[]
    totalSettled?: number
    totalOutstanding?: number
    settlementsSummary?: {
      settled: number
      outstanding: number
      pending: number
      paid: number
      confirmed: number
    }
  } | null>(null)
  const [search, setSearch] = useState('')
  const [annualBudget, setAnnualBudget] = useState(0)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [budgetMessage, setBudgetMessage] = useState('')

  useEffect(() => {
    api<typeof data>('/api/expenses/overview').then(setData).catch(() => undefined)
    api<{ amount: number }>('/api/expenses/annual-budget').then((result) => {
      setAnnualBudget(Number(result.amount) || 0)
      setBudgetDraft(String(Number(result.amount) || ''))
    }).catch(() => undefined)
  }, [])

  const saveAnnualBudget = async () => {
    const amount = Number(budgetDraft)
    if (!Number.isFinite(amount) || amount < 0) { setBudgetMessage('Enter a valid yearly amount.'); return }
    try {
      const result = await api<{ amount: number }>('/api/expenses/annual-budget', {
        method: 'PUT', body: JSON.stringify({ year: new Date().getFullYear(), amount: Math.round(amount) }),
      })
      setAnnualBudget(result.amount)
      setBudgetMessage('Yearly travel budget saved.')
    } catch (error) {
      setBudgetMessage(error instanceof Error ? error.message : 'Could not save budget.')
    }
  }

  const expenses = data?.expenses || []
  const visible = expenses.filter((e) =>
    `${e.title} ${e.category} ${e.paid_by_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Keep it comfortable"
        title="Expense management"
        description="A transparent, comprehensive view of your travel spending across all trips."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips')}>
            <Plus size={17} /> Add to trip
          </button>
        }
      />

      <div className="expense-summary detailed-expense-summary">
        <div>
          <span>Total spent</span>
          <strong>৳ {(data?.totalSpent ?? 0).toLocaleString()}</strong>
          <small className="positive">Across all your trips</small>
        </div>
        <div>
          <span>Settled payments</span>
          <strong>৳ {(data?.totalSettled ?? 0).toLocaleString()}</strong>
          <small style={{ color: '#059669' }}>Confirmed received</small>
        </div>
        <div>
          <span>Outstanding balance</span>
          <strong>৳ {(data?.totalOutstanding ?? 0).toLocaleString()}</strong>
          <small style={{ color: '#d97706' }}>Pending or awaiting confirmation</small>
        </div>
        <div>
          <span>Budget planned</span>
          <strong>৳ {(data?.totalBudget ?? 0).toLocaleString()}</strong>
          <small>Total budget target</small>
        </div>
        <div className="budget-progress">
          <div className="budget-label">
            <span>Overall Budget Utilization</span>
            <strong>{data?.totalBudget ? Math.round(((data.totalSpent ?? 0) / data.totalBudget) * 100) : 0}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: `${data?.totalBudget ? Math.min(100, Math.round(((data.totalSpent ?? 0) / data.totalBudget) * 100)) : 0}%` }} />
          </div>
        </div>
      </div>

      <section className="panel" style={{ marginTop: '20px' }}>
        <div className="panel-heading">
          <div><h2>Yearly travel budget · {new Date().getFullYear()}</h2><p>Set an annual cap and compare it with the actual trip spending recorded below.</p></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ minWidth: '220px' }}>Annual cap (BDT)
            <input type="number" min="0" step="500" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} placeholder="e.g. 100000" />
          </label>
          <button className="primary-btn" onClick={saveAnnualBudget}>Save yearly cap</button>
          {budgetMessage && <span className="muted">{budgetMessage}</span>}
        </div>
        {annualBudget > 0 && <p style={{ marginBottom: 0 }}>Spent this year: ৳ {expenses.filter((expense) => new Date(expense.expense_date).getFullYear() === new Date().getFullYear()).reduce((sum, expense) => sum + Number(expense.amount), 0).toLocaleString()} of ৳ {annualBudget.toLocaleString()} annual cap</p>}
      </section>


      <div className="expense-toolbar">
        <div className="group-filter">
          <Search size={16} />
          <input placeholder="Search expenses by title, category, or traveler..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td><span className="badge badge-blue">{e.category}</span></td>
                <td>{e.paid_by_name}</td>
                <td>{e.expense_date}</td>
                <td><strong>৳ {Number(e.amount).toLocaleString()}</strong></td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>
                  No expenses recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ExpensesPage
