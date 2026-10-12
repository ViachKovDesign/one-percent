import type { ReactNode } from 'react'

export type IconName =
  | 'check' | 'plus' | 'sun' | 'clock' | 'calendar' | 'user' | 'arrow' | 'sparkle'
  | 'flag' | 'tag' | 'repeat' | 'chevron' | 'close' | 'trash' | 'layers'

const paths: Record<IconName, ReactNode> = {
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  arrow: <path d="m15 18-6-6 6-6" />,
  sparkle: <path d="M12 2c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10 5.4-.5 9.5-4.6 10-10Z" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h10l-2 4 2 4H5" />
    </>
  ),
  tag: <path d="M20 13 13 20 4 11V4h7l9 9ZM8.5 8.5h.01" />,
  repeat: <path d="m17 2 3 3-3 3M20 5H7a4 4 0 0 0-4 4v1M7 22l-3-3 3-3M4 19h13a4 4 0 0 0 4-4v-1" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />,
}

export function Icon({ name, size = 'md' }: { name: IconName; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <svg className={`icon icon-${size}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function Action({
  children,
  className = '',
  onClick,
  label,
  disabled,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button type="button" className={`action ${className}`} aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function TagChip({ children, warm = false }: { children: ReactNode; warm?: boolean }) {
  return <span className={`tag-chip ${warm ? 'tag-warm' : ''}`}>{children}</span>
}

export function Checkbox({ done, onClick }: { done: boolean; onClick?: () => void }) {
  return (
    <Action
      className={`checkbox ${done ? 'is-done' : ''}`}
      onClick={onClick}
      label={done ? 'Снять отметку' : 'Отметить выполненным'}
    >
      {done && <Icon name="check" size="sm" />}
    </Action>
  )
}

export function Leaf({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'leaf leaf-small' : 'leaf'} viewBox="0 0 42 54" aria-hidden="true">
      <path d="M35.6 4.3C19.1 5.9 6.4 14.2 6.4 30.5c0 10.2 6.4 17.4 14.4 17.4 10.5 0 17.5-9.6 17.5-22.4 0-8.5-2.7-15.6-2.7-21.2Z" />
      <path d="M9.5 47.5C16.1 34 23 24.4 33.4 14.9" />
    </svg>
  )
}

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const percent = total ? (done / total) * 100 : 0
  return (
    <div className="progress-wrap">
      <svg className="progress-ring" viewBox="0 0 120 120" aria-label={`Сделано ${done} из ${total}`}>
        <circle className="ring-track" cx="60" cy="60" r="51" />
        <circle className="ring-value" cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${percent} 100`} />
      </svg>
      <div className="progress-copy">
        <strong>{done}</strong>
        <span>из {total} сделано</span>
      </div>
      <div className="growing-leaf">
        <Leaf small />
      </div>
    </div>
  )
}

export function ScreenHeader({ eyebrow, title, onBack }: { eyebrow?: string; title: string; onBack?: () => void }) {
  return (
    <div className="screen-header">
      {onBack && (
        <Action className="icon-action" onClick={onBack} label="Назад">
          <Icon name="arrow" />
        </Action>
      )}
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="page-title">{title}</div>
      </div>
    </div>
  )
}

export type Tab = 'today' | 'habits' | 'week' | 'profile'

const navItems: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'День', icon: 'sun' },
  { id: 'habits', label: 'Привычки', icon: 'repeat' },
  { id: 'week', label: 'Неделя', icon: 'calendar' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
]

export function BottomNav({ tab, navigate }: { tab: Tab; navigate: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <Action
          key={item.id}
          className={`nav-item ${tab === item.id ? 'active' : ''}`}
          onClick={() => navigate(item.id)}
          label={item.label}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Action>
      ))}
    </nav>
  )
}
