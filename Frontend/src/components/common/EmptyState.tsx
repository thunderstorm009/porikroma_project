import React from 'react'

export interface EmptyStateProps {
  title: string
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      <span>{message}</span>
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  )
}
