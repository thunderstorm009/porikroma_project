import React from 'react'

export interface StatusBadgeProps {
  status: string
  variant?: 'green' | 'blue' | 'coral' | 'orange' | 'purple'
  className?: string
}

export function StatusBadge({ status, variant, className = '' }: StatusBadgeProps) {
  const chosenVariant = variant || (
    status === 'UPCOMING' || status === 'PLANNING' || status === 'PENDING' ? 'blue' :
    status === 'COMPLETED' || status === 'CONFIRMED' || status === 'ACTIVE' ? 'green' :
    status === 'CANCELLED' || status === 'REJECTED' || status === 'BANNED' ? 'coral' : 'blue'
  )

  return (
    <span className={`status ${chosenVariant} ${className}`}>
      {status}
    </span>
  )
}
