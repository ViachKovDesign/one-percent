import { describe, expect, it } from 'vitest'
import { buildIcs, googleCalendarUrl } from './calendar'

describe('buildIcs', () => {
  it('делает событие со временем и напоминанием', () => {
    const ics = buildIcs([{ uid: 'a', title: 'Зал, грудь; ноги', date: '2026-10-13', time: '23:50', remindMin: 10 }])
    expect(ics).toContain('DTSTART:20261013T235000')
    expect(ics).toContain('DTEND:20261014T002000')
    expect(ics).toContain('SUMMARY:Зал\\, грудь\; ноги')
    expect(ics).toContain('TRIGGER:-PT10M')
    expect(ics).toContain('UID:a@one-percent')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('делает событие на весь день с напоминанием в 9:00', () => {
    const ics = buildIcs([{ uid: 'b', title: 'Врач', date: '2026-10-13', time: null, remindMin: 10 }])
    expect(ics).toContain('DTSTART;VALUE=DATE:20261013')
    expect(ics).toContain('DTEND;VALUE=DATE:20261014')
    expect(ics).toContain('TRIGGER:PT9H')
  })

  it('делает повтор по будням до дедлайна и каждый день', () => {
    const base = { uid: 'g', title: 'Урок Tilda', date: '2026-10-12', time: '19:00', remindMin: 15 }
    expect(buildIcs([{ ...base, repeat: { weekdays: [5, 1, 3], until: '2027-03-12' } }]))
      .toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20270312T235959')
    expect(buildIcs([{ ...base, repeat: { weekdays: [0, 1, 2, 3, 4, 5, 6], until: '2027-03-12' } }]))
      .toContain('RRULE:FREQ=DAILY;UNTIL=20270312T235959')
  })

  it('переносит длинные строки не длиннее 75 байт', () => {
    const ics = buildIcs([{ uid: 'c', title: 'Очень длинное название дела '.repeat(5), date: '2026-10-13', time: null, remindMin: 10 }])
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})

describe('googleCalendarUrl', () => {
  it('собирает ссылку с датами и повтором', () => {
    const url = new URL(googleCalendarUrl({
      uid: 'g', title: 'Урок Tilda', date: '2026-10-12', time: '19:00', remindMin: 10,
      repeat: { weekdays: [0, 1, 2, 3, 4, 5, 6], until: '2027-03-12' },
    }))
    expect(url.searchParams.get('dates')).toBe('20261012T190000/20261012T193000')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;UNTIL=20270312T235959')
    expect(url.searchParams.get('text')).toBe('Урок Tilda')
  })
})
