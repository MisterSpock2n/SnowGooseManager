import { priorityInfo } from '@/lib/maintenance'

export default function PriorityBadge({ priority, showLabel = false }: { priority: number; showLabel?: boolean }) {
  const p = priorityInfo(priority)
  return (
    <span
      title={`${p.short} — ${p.label} (${p.description})`}
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: p.color,
        color: p.text,
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      {p.short}
      {showLabel ? ` · ${p.label}` : ''}
    </span>
  )
}
