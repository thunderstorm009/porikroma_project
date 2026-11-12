import React from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ isOpen, onClose, title, description, children, maxWidth }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={maxWidth ? { width: maxWidth } : undefined}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>
        {title && <h2 className="modal-title">{title}</h2>}
        {description && <p className="modal-description">{description}</p>}
        {children}
      </div>
    </div>
  )
}
