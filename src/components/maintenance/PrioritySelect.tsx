'use client'

import { useEffect, useRef, useState } from 'react'
import { PRIORITIES, priorityInfo, type Priority } from '@/lib/maintenance'

export default function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority | null
  onChange: (value: Priority) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value ? priorityInfo(value) : null

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        id="priority"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const current = value ?? 0
            const next = e.key === 'ArrowDown' ? Math.min(5, current + 1) : Math.max(1, current - 1 || 1)
            onChange(next as Priority)
          }
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: selected ? selected.color : 'white',
          color: selected ? selected.text : '#6b7280',
          fontWeight: selected ? 700 : 400,
          fontSize: 15,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>{selected ? `${selected.short} — ${selected.label} (${selected.description})` : 'Select a priority'}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby="priority"
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            listStyle: 'none',
            margin: 0,
            padding: 6,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 10,
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
            display: 'grid',
            gap: 4,
          }}
        >
          {PRIORITIES.map((p) => (
            <li key={p.value} role="option" aria-selected={value === p.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.value)
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: value === p.value ? '2px solid #0f172a' : '2px solid transparent',
                  background: p.color,
                  color: p.text,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {p.short} — {p.label}
                <span style={{ fontWeight: 400 }}> · {p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
