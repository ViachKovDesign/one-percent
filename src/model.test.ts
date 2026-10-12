import { describe, expect, it } from 'vitest'
import {
  dayStreak, ensureGoalTasks, goalProgress, goalTaskId, habitStreak, makeTask, merge, rollOver,
  type Data, type Goal,
} from './model'

const empty: Data = { tasks: {}, habits: {}, templates: {}, goals: {} }

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

describe('goals', () => {
  // 2026-10-12 — понедельник. Шаг по будням, 2 недели.
  const goal: Goal = {
    id: 'g', title: 'Выучить Tilda', step: 'Урок Tilda', time: '19:00', weekdays: [1, 2, 3, 4, 5],
    start: '2026-10-12', deadline: '2026-10-25', milestones: [], createdAt: 0, updatedAt: 0,
  }
  const withGoal: Data = { ...empty, goals: { g: goal } }

  it('кладёт шаг цели в день по расписанию и не дублирует его', () => {
    const once = ensureGoalTasks(withGoal, '2026-10-12')
    expect(once.tasks[goalTaskId('g', '2026-10-12')]).toMatchObject({ title: 'Урок Tilda', time: '19:00', goalId: 'g' })
    expect(ensureGoalTasks(once, '2026-10-12')).toBe(once)
    expect(ensureGoalTasks(withGoal, '2026-10-17').tasks).toEqual({})
  })

  it('не возвращает удалённый вручную шаг', () => {
    const id = goalTaskId('g', '2026-10-12')
    const data = ensureGoalTasks(withGoal, '2026-10-12')
    const removed = { ...data, tasks: { [id]: { ...data.tasks[id], deleted: true } } }
    expect(ensureGoalTasks(removed, '2026-10-12')).toBe(removed)
  })

  it('не переносит пропущенные шаги целей', () => {
    const data = ensureGoalTasks(withGoal, '2026-10-12')
    expect(rollOver(data, '2026-10-13')).toBe(data)
  })

  it('считает процент и темп', () => {
    let data = withGoal
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      data = ensureGoalTasks(data, date)
      const id = goalTaskId('g', date)
      data = { ...data, tasks: { ...data.tasks, [id]: { ...data.tasks[id], done: true } } }
    }
    // 10 будних дней в плане, сделано 3; к четвергу 15-го ожидалось 3 (пн–ср), сегодня ещё не сделано
    expect(goalProgress(data, goal, '2026-10-15')).toMatchObject({ done: 3, planned: 10, percent: 30, expected: 3, pace: 0, daysLeft: 10 })
    expect(goalProgress(data, goal, '2026-10-20').pace).toBe(-3)
  })
})
