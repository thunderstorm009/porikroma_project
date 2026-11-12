import React from 'react'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="heading-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}
