// Даты храним строкой «ГГГГ-ММ-ДД» в местном времени: так день не «съезжает» из-за часовых поясов.

export function toKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDays(key: string, days: number): string {
  const date = fromKey(key)
  date.setDate(date.getDate() + days)
  return toKey(date)
}

/** Понедельник недели, в которую попадает день. */
export function weekStart(key: string): string {
  const day = fromKey(key).getDay()
  return addDays(key, -((day + 6) % 7))
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const WEEKDAYS_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу']
export const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** «вторник, 18 июня» */
export function formatLong(key: string): string {
  const date = fromKey(key)
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`
}

/** «Сегодня», «Завтра», «Вчера» или «в пятницу, 21 июня» */
export function formatRelative(key: string, today = todayKey()): string {
  if (key === today) return 'Сегодня'
  if (key === addDays(today, 1)) return 'Завтра'
  if (key === addDays(today, -1)) return 'Вчера'
  const date = fromKey(key)
  return `${WEEKDAYS_ACC[date.getDay()]}, ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`
}

/** Короткая подпись для чипа: «Завтра», «Пт, 21 июня» */
export function formatChip(key: string, today = todayKey()): string {
  if (key === today) return 'Сегодня'
  if (key === addDays(today, 1)) return 'Завтра'
  if (key === addDays(today, 2)) return 'Послезавтра'
  const date = fromKey(key)
  return `${WEEKDAYS_SHORT[(date.getDay() + 6) % 7]}, ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`
}

/** «17 – 23 июня» или «30 июня – 6 июля» */
export function formatRange(from: string, to: string): string {
  const a = fromKey(from)
  const b = fromKey(to)
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
  return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
}

/** Склонение: plural(5, ['дело', 'дела', 'дел']) → «дел» */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
