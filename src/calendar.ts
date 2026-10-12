// Связка с календарём телефона. Приложение не может само слать уведомления, когда оно закрыто,
// поэтому мы кладём событие с напоминанием в календарь — а напоминает уже сам телефон.

import { addDays } from './dates'

export type CalendarEvent = {
  uid: string
  title: string
  /** День «ГГГГ-ММ-ДД». */
  date: string
  /** «19:00» или null — тогда событие на весь день. */
  time: string | null
  durationMin?: number
  description?: string
  /** Напомнить за столько минут до начала (для событий на весь день — в 9:00 этого дня). */
  remindMin: number
  /** Повтор: дни недели (0 — вс … 6 — сб) до даты until включительно. */
  repeat?: { weekdays: number[]; until: string }
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function compactDate(date: string): string {
  return date.replaceAll('-', '')
}

function compactDateTime(date: string, time: string): string {
  return `${compactDate(date)}T${time.replace(':', '')}00`
}

function endOf(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const day = addDays(date, Math.floor(total / (24 * 60)))
  const rest = total % (24 * 60)
  const hh = String(Math.floor(rest / 60)).padStart(2, '0')
  const mm = String(rest % 60).padStart(2, '0')
  return compactDateTime(day, `${hh}:${mm}`)
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Строки длиннее 75 байт по стандарту переносятся с пробелом в начале следующей строки. */
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = new TextEncoder().encode(char).length
    if (bytes + size > 73) {
      parts.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n')
}

function rrule(repeat: NonNullable<CalendarEvent['repeat']>): string {
  const days = [...repeat.weekdays].sort()
  const until = `UNTIL=${compactDate(repeat.until)}T235959`
  if (days.length === 7) return `RRULE:FREQ=DAILY;${until}`
  return `RRULE:FREQ=WEEKLY;BYDAY=${days.map(d => BYDAY[d]).join(',')};${until}`
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function buildIcs(events: CalendarEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//one-percent//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}@one-percent`, `DTSTAMP:${stamp()}`)
    // Время без часового пояса — «местное»: событие встанет на 19:00 там, где телефон.
    if (event.time) {
      lines.push(`DTSTART:${compactDateTime(event.date, event.time)}`)
      lines.push(`DTEND:${endOf(event.date, event.time, event.durationMin ?? 30)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`)
      lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`)
    }
    if (event.repeat) lines.push(rrule(event.repeat))
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      event.time ? `TRIGGER:-PT${event.remindMin}M` : 'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Ссылка «добавить в Google Календарь» для одного события. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = event.time
    ? `${compactDateTime(event.date, event.time)}/${endOf(event.date, event.time, event.durationMin ?? 30)}`
    : `${compactDate(event.date)}/${compactDate(addDays(event.date, 1))}`
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates })
  if (event.description) params.set('details', event.description)
  if (event.repeat) params.set('recur', rrule(event.repeat))
  try {
    params.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    // без часового пояса Google возьмёт пояс аккаунта
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Открывает файл .ics: на iPhone Safari сразу предлагает «Добавить в Календарь»,
 * на Android файл открывается приложением календаря.
 */
export function openIcs(events: CalendarEvent[], fileName: string) {
  const ics = buildIcs(events)
  const file = new File([ics], `${fileName}.ics`, { type: 'text/calendar' })
  const url = URL.createObjectURL(file)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos) {
    // Safari показывает файл календаря и кнопку «Добавить все»
    window.location.assign(url)
  } else {
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.ics`
    document.body.append(link)
    link.click()
    link.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
}

const REMIND_KEY = 'one-percent:remind'

export function getRemindMin(): number {
  try {
    const value = Number(localStorage.getItem(REMIND_KEY))
    return Number.isFinite(value) && value > 0 ? value : 10
  } catch {
    return 10
  }
}

export function setRemindMin(minutes: number) {
  try {
    localStorage.setItem(REMIND_KEY, String(minutes))
  } catch {
    // не сохранилось — останется значение по умолчанию
  }
}
