import { api } from './client'
import type { Settlement, WorkspaceData } from '../types'

export const expensesApi = {
  getOverview: () =>
    api<{
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
    }>('/api/expenses/overview'),

  addExpense: (data: { tripId: string; title: string; category: string; amount: number; expenseDate: string }) =>
    api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: string) =>
    api(`/api/expenses/${id}`, { method: 'DELETE' }),

  getSettlements: (tripId: string) =>
    api<Settlement[]>(`/api/trips/${tripId}/settlements`),

  recordSettlement: (tripId: string, data: { toUserId: string; amount: number; status?: string }) =>
    api<Settlement>(`/api/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSettlementStatus: (id: string, status: 'PENDING' | 'PAID' | 'CONFIRMED' | 'CANCELLED') =>
    api<Settlement>(`/api/settlements/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  markSettlementPaid: (id: string) =>
    api<Settlement>(`/api/settlements/${id}/pay`, {
      method: 'POST',
    }),

  confirmSettlement: (id: string) =>
    api<Settlement>(`/api/settlements/${id}/confirm`, {
      method: 'POST',
    }),
}

