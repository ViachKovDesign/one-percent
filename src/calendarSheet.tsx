import { googleCalendarUrl, getRemindMin, openIcs } from './calendar'
import type { CalendarRequest } from './nav'
import { Action, Icon } from './ui'
import { plural } from './dates'

export function CalendarSheet({ request, onClose }: { request: CalendarRequest; onClose: () => void }) {
  const remind = getRemindMin()
  const single = request.events.length === 1 ? request.events[0] : null
  const untimed = request.events.filter(e => !e.time).length

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Добавить в календарь" onClick={event => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="recognition-icon"><Icon name="calendar" size="sm" /></div>
          <div>
            <div className="recognition-label">{request.title}</div>
            <div className="muted-copy">
              {request.events.length} {plural(request.events.length, ['событие', 'события', 'событий'])} ·
              напомню за {remind} мин{untimed ? ' (без времени — в 9:00)' : ''}
            </div>
          </div>
        </div>

        <Action
          className="primary-button sheet-button"
          onClick={() => {
            openIcs(request.events, request.fileName)
            onClose()
          }}
        >
          <Icon name="calendar" size="sm" /> Календарь телефона
        </Action>
        {single && (
          <Action
            className="secondary-button sheet-button"
            onClick={() => {
              window.open(googleCalendarUrl(single), '_blank', 'noopener')
              onClose()
            }}
          >
            Google Календарь
          </Action>
        )}
        <div className="sheet-note">
          Напоминание придёт от календаря телефона, даже когда приложение закрыто.
          {single ? '' : ' Google Календарь умеет принимать только по одному событию — открой дело и добавь его отдельно.'}
        </div>
        <Action className="text-button sheet-cancel" onClick={onClose}>Отмена</Action>
      </div>
    </div>
  )
}
