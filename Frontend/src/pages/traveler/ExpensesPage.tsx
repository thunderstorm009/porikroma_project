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

  useEffect(() => {
    api<typeof data>('/api/expenses/overview').then(setData).catch(() => undefined)
  }, [])

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
          <strong>৳ {(data?.totalSpent || 24500).toLocaleString()}</strong>
          <small className="positive">Across all your trips</small>
        </div>
        <div>
          <span>Settled payments</span>
          <strong>৳ {(data?.totalSettled || 0).toLocaleString()}</strong>
          <small style={{ color: '#059669' }}>Confirmed received</small>
        </div>
        <div>
          <span>Outstanding balance</span>
          <strong>৳ {(data?.totalOutstanding || 0).toLocaleString()}</strong>
          <small style={{ color: '#d97706' }}>Pending or awaiting confirmation</small>
        </div>
        <div>
          <span>Budget planned</span>
          <strong>৳ {(data?.totalBudget || 60700).toLocaleString()}</strong>
          <small>Total budget target</small>
        </div>
        <div className="budget-progress">
          <div className="budget-label">
            <span>Overall Budget Utilization</span>
            <strong>{data?.totalBudget ? Math.round(((data.totalSpent || 0) / data.totalBudget) * 100) : 40}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: `${data?.totalBudget ? Math.min(100, Math.round(((data.totalSpent || 0) / data.totalBudget) * 100)) : 40}%` }} />
          </div>
        </div>
      </div>


      <div className="expense-toolbar">
        <div className="group-filter">
          <Search size={15} />
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
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No expenses recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ExpensesPage
