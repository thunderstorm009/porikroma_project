export function formatBDT(amount: number | string | undefined | null): string {
  const num = Number(amount || 0)
  return `৳ ${num.toLocaleString()}`
}

export function formatDate(dateStr?: string | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return ''
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString(undefined, options)
}

export function formatTime(dateStr?: string | Date): string {
  if (!dateStr) return ''
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getInitials(name?: string, fallback = 'T'): string {
  return (name?.trim()?.[0] || fallback).toUpperCase()
}

export function calcBudgetUtilization(spent: number, budget: number): number {
  if (!budget || budget <= 0) return 0
  return Math.min(Math.round((spent / budget) * 100), 100)
}

export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
