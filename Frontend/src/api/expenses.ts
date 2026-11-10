import { api } from './client'
import type { WorkspaceData } from '../types'

export const expensesApi = {
  getOverview: () =>
    api<{
      expenses: WorkspaceData['expenses']
      totalSpent: number
      totalBudget: number
      categories: Record<string, number>
    }>('/api/expenses/overview'),

  addExpense: (data: { tripId: string; title: string; category: string; amount: number; expenseDate: string }) =>
    api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: string) =>
    api(`/api/expenses/${id}`, { method: 'DELETE' }),

  getSettlements: (tripId: string) =>
    api<{ id: string; from_user_name: string; to_user_name: string; amount: number; status: string }[]>(`/api/trips/${tripId}/settlements`),

  recordSettlement: (tripId: string, data: { toUserId: string; amount: number }) =>
    api(`/api/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
