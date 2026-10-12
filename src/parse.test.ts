import { describe, expect, it } from 'vitest'
import { parseQuick } from './parse'

// 2026-10-12 — понедельник
const TODAY = '2026-10-12'

describe('parseQuick', () => {
  it('разбирает дату, время, тег и важность', () => {
    expect(parseQuick('завтра в 10:00 прогулка #спорт !', TODAY)).toEqual({
      title: 'Прогулка', date: '2026-10-13', time: '10:00', tag: 'спорт', important: true,
    })
  })

  it('оставляет обычный текст как есть', () => {
    expect(parseQuick('Позвонить маме', TODAY)).toEqual({
      title: 'Позвонить маме', date: null, time: null, tag: null, important: false,
    })
  })

  it('понимает «напомни мне» и «в 7 вечера»', () => {
    const p = parseQuick('напомни мне послезавтра в 7 вечера купить воду', TODAY)
    expect(p).toMatchObject({ title: 'Купить воду', date: '2026-10-14', time: '19:00' })
  })

  it('понимает дни недели', () => {
    expect(parseQuick('в пятницу тренировка', TODAY)).toMatchObject({ title: 'Тренировка', date: '2026-10-16' })
    expect(parseQuick('пн отчёт', TODAY)).toMatchObject({ title: 'Отчёт', date: '2026-10-12' })
    expect(parseQuick('во вторник созвон', TODAY).date).toBe('2026-10-13')
  })

  it('понимает числа и месяцы', () => {
    expect(parseQuick('15 октября урок Figma', TODAY)).toMatchObject({ title: 'Урок Figma', date: '2026-10-15' })
    expect(parseQuick('врач 03.01', TODAY)).toMatchObject({ title: 'Врач', date: '2027-01-03' })
    expect(parseQuick('через 3 дня зал', TODAY)).toMatchObject({ title: 'Зал', date: '2026-10-15' })
    expect(parseQuick('через неделю зал', TODAY).date).toBe('2026-10-19')
  })

  it('не путает слова внутри других слов', () => {
    expect(parseQuick('Купить сыр', TODAY)).toMatchObject({ title: 'Купить сыр', date: null })
    expect(parseQuick('Встреча', TODAY)).toMatchObject({ title: 'Встреча', date: null })
    expect(parseQuick('Посмотреть вечером', TODAY)).toMatchObject({ title: 'Посмотреть вечером', time: null })
  })

  it('пропускает неправильное время', () => {
    expect(parseQuick('в 25:00 что-то', TODAY).time).toBeNull()
  })
})
