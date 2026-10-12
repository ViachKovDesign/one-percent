import { addDays, fromKey, toKey } from './dates'

export type Parsed = {
  title: string
  date: string | null
  time: string | null
  tag: string | null
  important: boolean
}

// \b в JavaScript не понимает кириллицу, поэтому границы слова задаём сами.
const L = '(?<![\\p{L}\\d])'
const R = '(?![\\p{L}\\d])'

const WEEKDAYS: [RegExp, number][] = [
  [/понедельник|пн/, 1],
  [/вторник|вт/, 2],
  [/сред[ауы]|ср/, 3],
  [/четверг|чт/, 4],
  [/пятниц[ауы]|пт/, 5],
  [/суббот[ауы]|сб/, 6],
  [/воскресенье|вс/, 0],
]

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Ближайший день в будущем (или сегодня) с этим месяцем и числом. */
function nextDate(today: string, month: number, day: number, year?: number): string | null {
  const base = fromKey(today)
  const date = new Date(year ?? base.getFullYear(), month, day)
  if (date.getMonth() !== month || date.getDate() !== day) return null
  if (year === undefined && toKey(date) < today) date.setFullYear(date.getFullYear() + 1)
  return toKey(date)
}

/**
 * Разбирает строку быстрого ввода:
 * «завтра в 10:00 прогулка #спорт !» → дело «Прогулка» на завтра, 10:00, тег «спорт», важное.
 */
export function parseQuick(input: string, today: string): Parsed {
  let text = ` ${input} `
  let date: string | null = null
  let time: string | null = null
  let tag: string | null = null
  let important = false

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re)
    if (!m || m.index === undefined) return
    if (fn(m) === false) return
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
  }

  // Теги: #спорт
  for (const m of text.matchAll(/#([\p{L}\d_-]+)/gu)) {
    if (!tag) tag = m[1].toLowerCase()
  }
  text = text.replace(/#[\p{L}\d_-]+/gu, ' ')

  // Важное: «!» отдельным словом или слово «важно»
  take(new RegExp(`${L}(важно|срочно)${R}`, 'iu'), () => { important = true })
  take(/(^|\s)!+(?=\s|$)/u, () => { important = true })

  // Лишние слова в начале: «напомни мне …»
  take(new RegExp(`^\\s*напомн(и|ите)(\\s+мне)?${R}`, 'iu'), () => {})

  // Время: «в 10:30», «10:30», «к 9», «в 7 вечера», «в 10ч»
  take(
    new RegExp(`${L}(?:(?:в|к)\\s+)?(\\d{1,2}):(\\d{2})(?:\\s+(утра|дня|вечера|ночи))?${R}`, 'iu'),
    m => {
      let h = Number(m[1])
      const min = Number(m[2])
      if (m[3] && /дня|вечера/i.test(m[3]) && h < 12) h += 12
      if (h > 23 || min > 59) return false
      time = `${pad(h)}:${pad(min)}`
    },
  )
  if (!time) {
    take(
      new RegExp(`${L}(?:в|к)\\s+(\\d{1,2})(?:\\s*ч(?:ас(?:а|ов)?)?)?(?:\\s+(утра|дня|вечера|ночи))?${R}`, 'iu'),
      m => {
        let h = Number(m[1])
        if (m[2] && /дня|вечера/i.test(m[2]) && h < 12) h += 12
        if (h > 23) return false
        time = `${pad(h)}:00`
      },
    )
  }

  // Дата: послезавтра / завтра / сегодня
  take(new RegExp(`${L}послезавтра${R}`, 'iu'), () => { date = addDays(today, 2) })
  if (!date) take(new RegExp(`${L}завтра${R}`, 'iu'), () => { date = addDays(today, 1) })
  if (!date) take(new RegExp(`${L}сегодня${R}`, 'iu'), () => { date = today })

  // «через 3 дня», «через неделю»
  if (!date) {
    take(new RegExp(`${L}через\\s+(\\d{1,3})\\s+(день|дня|дней)${R}`, 'iu'), m => {
      date = addDays(today, Number(m[1]))
    })
  }
  if (!date) take(new RegExp(`${L}через\\s+неделю${R}`, 'iu'), () => { date = addDays(today, 7) })

  // «15.10» или «15.10.2026»
  if (!date) {
    take(new RegExp(`${L}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}))?${R}`, 'u'), m => {
      const found = nextDate(today, Number(m[2]) - 1, Number(m[1]), m[3] ? Number(m[3]) : undefined)
      if (!found) return false
      date = found
    })
  }

  // «15 октября»
  if (!date) {
    take(new RegExp(`${L}(\\d{1,2})\\s+(${MONTHS.join('|')})[\\p{L}]*${R}`, 'iu'), m => {
      const month = MONTHS.indexOf(m[2].toLowerCase())
      const found = nextDate(today, month, Number(m[1]))
      if (!found) return false
      date = found
    })
  }

  // «в пятницу», «пн»
  if (!date) {
    for (const [word, weekday] of WEEKDAYS) {
      take(new RegExp(`${L}(?:(?:в|во)\\s+)?(?:${word.source})${R}`, 'iu'), () => {
        const current = fromKey(today).getDay()
        date = addDays(today, (weekday - current + 7) % 7)
      })
      if (date) break
    }
  }

  let title = text.replace(/\s+/g, ' ').replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, '').trim()
  if (title) title = title[0].toUpperCase() + title.slice(1)

  return { title, date, time, tag, important }
}
