import { describe, expect, it } from 'vitest'
import { dayStreak, habitStreak, makeTask, merge, rollOver, type Data } from './model'

const empty: Data = { tasks: {}, habits: {}, templates: {} }

describe('merge', () => {
  it('берёт более свежую версию каждой записи', () => {
    const task = makeTask({ title: 'A', date: '2026-10-12' })
    const older = { ...empty, tasks: { [task.id]: { ...task, done: false, updatedAt: 1 } } }
    const newer = { ...empty, tasks: { [task.id]: { ...task, done: true, updatedAt: 2 } } }
    expect(merge(older, newer).tasks[task.id].done).toBe(true)
    expect(merge(newer, older).tasks[task.id].done).toBe(true)
  })
})

describe('rollOver', () => {
  it('переносит невыполненные дела на сегодня и запоминает откуда', () => {
    const old = makeTask({ title: 'Старое', date: '2026-10-10' })
    const done = makeTask({ title: 'Сделано', date: '2026-10-10', done: true })
    const data = rollOver({ ...empty, tasks: { [old.id]: old, [done.id]: done } }, '2026-10-12')
    expect(data.tasks[old.id]).toMatchObject({ date: '2026-10-12', movedFrom: '2026-10-10' })
    expect(data.tasks[done.id].date).toBe('2026-10-10')
  })
})

describe('streaks', () => {
  it('считает серию привычки', () => {
    const habit = { id: 'h', title: 'Вода', createdAt: 0, updatedAt: 0,
      log: { '2026-10-10': true, '2026-10-11': true } }
    expect(habitStreak(habit, '2026-10-12')).toBe(2)
    expect(habitStreak({ ...habit, log: { ...habit.log, '2026-10-12': true } }, '2026-10-12')).toBe(3)
  })

  it('считает дни подряд с выполненными делами', () => {
    const a = makeTask({ title: 'a', date: '2026-10-11', done: true })
    const b = makeTask({ title: 'b', date: '2026-10-12', done: true })
    expect(dayStreak({ ...empty, tasks: { [a.id]: a, [b.id]: b } }, '2026-10-12')).toBe(2)
  })
})
