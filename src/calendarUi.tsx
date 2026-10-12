import type { CalendarSync } from './gcal'
import { getRemindMin } from './gcal'
import { plural } from './dates'
import type { Go } from './nav'
import { Action, Icon } from './ui'

/** Полоска сверху, когда календарю нужно внимание: истёк вход или не было сети. */
export function CalendarBanner({ calendar }: { calendar: CalendarSync }) {
  if (!calendar.enabled || calendar.pending === 0) return null
  if (calendar.status === 'needs-login') {
    return (
      <Action className="calendar-banner" onClick={calendar.refresh}>
        <Icon name="calendar" size="sm" />
        <span>
          {calendar.pending} {plural(calendar.pending, ['изменение ждёт', 'изменения ждут', 'изменений ждут'])} календаря —
          нажми, чтобы обновить
        </span>
      </Action>
    )
  }
  if (calendar.status === 'error') {
    return (
      <Action className="calendar-banner warn" onClick={calendar.resync}>
        <Icon name="repeat" size="sm" />
        <span>Не получилось обновить календарь. Нажми, чтобы повторить</span>
      </Action>
    )
  }
  return null
}

/** Карточка у дела и у цели: что будет в календаре. */
export function CalendarNote({ calendar, hasTime, go }: { calendar: CalendarSync; hasTime: boolean; go: Go }) {
  if (!calendar.configured) return null
  if (!calendar.enabled) {
    return (
      <Action className="calendar-card" onClick={() => go({ name: 'profile' })}>
        <div className="stat-icon peach"><Icon name="calendar" /></div>
        <div className="grow">
          <div className="recognition-label">Подключи Google Календарь</div>
          <div className="muted-copy">Дела со временем будут в календаре с напоминанием, а отметки — синхронизироваться.</div>
        </div>
        <Icon name="chevron" size="sm" />
      </Action>
    )
  }
  return (
    <div className="calendar-card">
      <div className={`stat-icon ${hasTime ? '' : 'peach'}`}><Icon name="calendar" /></div>
      <div className="grow">
        <div className="recognition-label">{hasTime ? 'В Google Календаре' : 'Не в календаре'}</div>
        <div className="muted-copy">
          {hasTime
            ? `Напомню за ${getRemindMin()} мин. Отметка «готово» и удаление обновят событие.`
            : 'Поставь время — и дело появится в календаре с напоминанием.'}
        </div>
      </div>
    </div>
  )
}
