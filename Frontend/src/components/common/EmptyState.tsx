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
      {icon && <div className="empty-state-icon">{icon}</div>}
      <strong className="empty-state-title">{title}</strong>
      <span className="empty-state-message">{message}</span>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
