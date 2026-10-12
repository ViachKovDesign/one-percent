import { useState } from 'react'
import { CalendarNote } from './calendarUi'
import type { CalendarSync } from './gcal'
import { addDays, formatChip, formatDayMonth, formatLong, fromKey, plural, todayKey, toKey, WEEKDAYS_SHORT } from './dates'
import {
  ensureGoalWeek, goalProgress, goalTaskId, liveGoals, newId,
  type Data, type Goal, type GoalProgress,
} from './model'
import type { Change, Go } from './nav'
import {
  Action, BottomNav, Checkbox, Icon, Leaf, PercentRing, ProgressBar, ScreenHeader, TagChip,
} from './ui'

/** Пн…Вс в порядке недели → номер дня в JavaScript (0 — воскресенье). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function steps(n: number): string {
  return `${n} ${plural(n, ['шаг', 'шага', 'шагов'])}`
}

function days(n: number): string {
  return `${n} ${plural(n, ['день', 'дня', 'дней'])}`
}

export function paceText(p: GoalProgress): string {
  if (p.isFinished) return p.percent >= 100 ? 'Цель достигнута!' : `Срок вышел — пройдено ${p.percent}%`
  if (p.done >= p.planned) return 'Все шаги сделаны — цель достигнута!'
  if (p.pace > 0) return `Опережаешь план на ${steps(p.pace)}`
  if (p.pace === 0) return p.done === 0 ? 'Старт — сделай первый шаг' : 'Идёшь точно по плану'
  return `Отстаёшь на ${steps(-p.pace)} — можно догнать`
}

export function stepDaysText(weekdays: number[]): string {
  if (weekdays.length === 7) return 'каждый день'
  if (weekdays.length === 5 && [1, 2, 3, 4, 5].every(d => weekdays.includes(d))) return 'по будням'
  return WEEK_ORDER.filter(d => weekdays.includes(d)).map(d => WEEKDAYS_SHORT[(d + 6) % 7]).join(', ')
}

/* ─────────────── Список целей ─────────────── */

export function GoalsScreen({ data, go }: { data: Data; go: Go }) {
  const goals = liveGoals(data)
  const today = todayKey()

  return (
    <>
      <main className="screen">
        <ScreenHeader eyebrow="Долгая дистанция" title="Цели" />

        {goals.length === 0 ? (
          <section className="week-hero goal-empty">
            <div className="week-art">
              <div className="plant-stem" />
              <Leaf />
              <div className="plant-leaf-two"><Leaf small /></div>
            </div>
            <div className="week-hero-copy">
              <TagChip>первая цель</TagChip>
              <div className="section-title">Большое — из маленьких шагов</div>
              <div className="muted-copy">Например: «Выучить Tilda» за 5 месяцев, по уроку каждый день.</div>
            </div>
          </section>
        ) : (
          <div className="goal-list">
            {goals.map(goal => {
              const p = goalProgress(data, goal, today)
              const todayTask = data.tasks[goalTaskId(goal.id, today)]
              return (
                <Action key={goal.id} className="goal-card" onClick={() => go({ name: 'goal', goalId: goal.id })}>
                  <div className="goal-card-top">
                    <div className="goal-card-text">
                      <div className="task-title">{goal.title}</div>
                      <div className="timeline-note">
                        {p.isFinished ? 'срок вышел' : `осталось ${days(p.daysLeft)}`} · {stepDaysText(goal.weekdays)}
                      </div>
                    </div>
                    <div className="goal-percent">{p.percent}%</div>
                  </div>
                  <ProgressBar percent={p.percent} />
                  <div className="goal-card-bottom">
                    <span className={p.pace < 0 && !p.isFinished ? 'pace-behind' : ''}>{paceText(p)}</span>
                    {todayTask && !todayTask.deleted && (
                      <TagChip warm={!todayTask.done}>{todayTask.done ? 'сегодня ✓' : 'шаг сегодня'}</TagChip>
                    )}
                  </div>
                </Action>
              )
            })}
          </div>
        )}

        <Action className="secondary-button wide" onClick={() => go({ name: 'goal-edit' })}>
          <Icon name="plus" size="sm" /> Новая цель
        </Action>
      </main>
      <BottomNav tab="goals" navigate={tab => go({ name: tab })} />
    </>
  )
}

/* ─────────────── Одна цель ─────────────── */

export function GoalScreen({
  data, change, goalId, go, calendar,
}: {
  data: Data
  change: Change
  goalId: string
  go: Go
  calendar: CalendarSync
}) {
  const [draft, setDraft] = useState('')
  const goal = data.goals[goalId]
  if (!goal || goal.deleted) {
    return (
      <main className="screen">
        <ScreenHeader title="Цель не найдена" onBack={() => go({ name: 'goals' })} />
      </main>
    )
  }
  const today = todayKey()
  const p = goalProgress(data, goal, today)
  const todayTask = data.tasks[goalTaskId(goal.id, today)]
  const milestonesDone = goal.milestones.filter(m => m.done).length

  // Меняем всегда свежую версию цели: быстрые нажатия подряд не теряются
  const setGoal = (fn: (fresh: Goal) => Partial<Goal>) =>
    change(current => {
      const fresh = current.goals[goal.id]
      return { ...current, goals: { ...current.goals, [goal.id]: { ...fresh, ...fn(fresh), updatedAt: Date.now() } } }
    })

  const toggleToday = () => {
    if (!todayTask) return
    change(current => {
      const fresh = current.tasks[todayTask.id]
      // Удалённый вручную шаг считается невыполненным — отметка возвращает его в день
      const wasDone = fresh.done && !fresh.deleted
      return {
        ...current,
        tasks: {
          ...current.tasks,
          [fresh.id]: { ...fresh, done: !wasDone, doneAt: wasDone ? null : Date.now(), deleted: false, updatedAt: Date.now() },
        },
      }
    })
  }

  const addMilestone = () => {
    const title = draft.trim()
    if (!title) return
    setGoal(fresh => ({ milestones: [...fresh.milestones, { id: newId(), title, done: false }] }))
    setDraft('')
  }

  return (
    <main className="screen detail-screen">
      <ScreenHeader eyebrow="Цель" title={goal.title} onBack={() => go({ name: 'goals' })} />

      <section className="progress-card">
        <div className="progress-text">
          <TagChip warm={p.pace < 0 && !p.isFinished}>{p.isFinished ? 'итог' : 'темп'}</TagChip>
          <div className="section-title">{paceText(p)}</div>
          <div className="muted-copy">
            {p.isFinished ? `Срок был до ${formatDayMonth(goal.deadline)}` : `Финиш — ${formatDayMonth(goal.deadline)}`}
          </div>
        </div>
        <PercentRing percent={p.percent} label="пройдено" />
      </section>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="check" /></div>
          <div className="stat-value">{p.done} / {p.planned}</div>
          <div className="stat-label">Шагов сделано</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon peach"><Icon name="clock" /></div>
          <div className="stat-value">{p.isFinished ? '—' : days(p.daysLeft)}</div>
          <div className="stat-label">До финиша</div>
        </div>
      </div>

      <section className="detail-section">
        <div className="group-label">Шаг на сегодня</div>
        {todayTask ? (
          <div className={`task-card ${todayTask.done && !todayTask.deleted ? 'task-done' : ''}`}>
            <Checkbox done={todayTask.done && !todayTask.deleted} onClick={toggleToday} />
            <div className="task-content">
              <div className="task-title">{goal.step}</div>
              <div className="task-meta">
                {goal.time && <span>{goal.time}</span>}
                <span>{stepDaysText(goal.weekdays)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-card muted-copy">
            Сегодня по плану отдых. Шаги: {stepDaysText(goal.weekdays)}
            {goal.time ? ` в ${goal.time}` : ''}.
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="section-heading compact">
          <div className="group-label">Этапы</div>
          {goal.milestones.length > 0 && <span className="count-label">{milestonesDone} из {goal.milestones.length}</span>}
        </div>
        <div className="subtask-list">
          {goal.milestones.map(milestone => (
            <div className={`subtask ${milestone.done ? 'checked' : ''}`} key={milestone.id}>
              <Checkbox
                done={milestone.done}
                onClick={() =>
                  setGoal(fresh => ({ milestones: fresh.milestones.map(m => (m.id === milestone.id ? { ...m, done: !m.done } : m)) }))
                }
              />
              <span className="grow">{milestone.title}</span>
              <Action
                className="icon-action small danger"
                label={`Удалить этап ${milestone.title}`}
                onClick={() => setGoal(fresh => ({ milestones: fresh.milestones.filter(m => m.id !== milestone.id) }))}
              >
                <Icon name="close" size="sm" />
              </Action>
            </div>
          ))}
          {goal.milestones.length === 0 && (
            <div className="subtask muted-copy">Разбей цель на вехи: «Первый сайт на Tilda», «Портфолио из 3 работ».</div>
          )}
        </div>
        <div className="add-row">
          <input
            className="add-input"
            value={draft}
            placeholder="Новый этап"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && addMilestone()}
          />
          <Action className="icon-action dark" onClick={addMilestone} label="Добавить этап" disabled={!draft.trim()}>
            <Icon name="plus" />
          </Action>
        </div>
      </section>

      <section className="detail-section">
        <div className="group-label">Напоминания</div>
        <CalendarNote calendar={calendar} hasTime={goal.time !== null} go={go} />
      </section>

      <div className="bottom-actions">
        <Action
          className="secondary-button square"
          label="Удалить цель"
          onClick={() => {
            if (!window.confirm(`Удалить цель «${goal.title}»?`)) return
            const now = Date.now()
            change(current => {
              const tasks = { ...current.tasks }
              // Невыполненные шаги удалённой цели убираем из дней, сделанные оставляем в истории
              for (const task of Object.values(tasks)) {
                if (task.goalId === goal.id && !task.done && !task.deleted) tasks[task.id] = { ...task, deleted: true, updatedAt: now }
              }
              return {
                ...current,
                tasks,
                goals: { ...current.goals, [goal.id]: { ...current.goals[goal.id], deleted: true, updatedAt: now } },
              }
            })
            go({ name: 'goals' })
          }}
        >
          <Icon name="trash" />
        </Action>
        <Action className="primary-button grow" onClick={() => go({ name: 'goal-edit', goalId: goal.id })}>
          Изменить цель
        </Action>
      </div>
    </main>
  )
}

/* ─────────────── Создать или изменить цель ─────────────── */

const DURATIONS = [
  { months: 1, label: '1 мес' },
  { months: 3, label: '3 мес' },
  { months: 5, label: '5 мес' },
  { months: 6, label: 'полгода' },
  { months: 12, label: 'год' },
]

function plusMonths(key: string, months: number): string {
  const date = fromKey(key)
  date.setMonth(date.getMonth() + months)
  return toKey(date)
}

export function GoalEditScreen({
  data, change, goalId, go,
}: {
  data: Data
  change: Change
  goalId?: string
  go: Go
}) {
  const today = todayKey()
  const existing = goalId ? data.goals[goalId] : undefined
  const [title, setTitle] = useState(existing?.title ?? '')
  const [step, setStep] = useState(existing?.step ?? '')
  const [time, setTime] = useState(existing?.time ?? '19:00')
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? [0, 1, 2, 3, 4, 5, 6])
  const [deadline, setDeadline] = useState(existing?.deadline ?? plusMonths(today, 5))
  const start = existing?.start ?? today

  const stepTitle = step.trim() || (title.trim() ? `${title.trim()}: шаг` : '')
  const canSave = title.trim() && weekdays.length > 0 && deadline > start

  const save = () => {
    if (!canSave) return
    const now = Date.now()
    const goal: Goal = {
      id: existing?.id ?? newId(),
      milestones: existing?.milestones ?? [],
      createdAt: existing?.createdAt ?? now,
      start,
      title: title.trim(),
      step: stepTitle,
      time: time || null,
      weekdays,
      deadline,
      updatedAt: now,
    }
    change(current => ensureGoalWeek({ ...current, goals: { ...current.goals, [goal.id]: goal } }))
    go({ name: 'goal', goalId: goal.id })
  }

  const back = () => (existing ? go({ name: 'goal', goalId: existing.id }) : go({ name: 'goals' }))

  return (
    <main className="screen detail-screen">
      <ScreenHeader eyebrow={existing ? 'Изменить цель' : 'Новая цель'} title="Куда растём?" onBack={back} />

      <section className="form-section">
        <label className="group-label" htmlFor="goal-title">Цель</label>
        <input
          id="goal-title"
          className="add-input big"
          value={title}
          autoFocus={!existing}
          placeholder="Выучить Tilda"
          onChange={event => setTitle(event.target.value)}
        />
      </section>

      <section className="form-section">
        <label className="group-label" htmlFor="goal-step">Ежедневный шаг</label>
        <input
          id="goal-step"
          className="add-input big"
          value={step}
          placeholder={title.trim() ? `${title.trim()}: шаг` : 'Урок Tilda 30 минут'}
          onChange={event => setStep(event.target.value)}
        />
        <div className="form-hint">Шаг сам появится в «Дне». Каждая отметка двигает цель вперёд.</div>
      </section>

      <section className="form-section">
        <div className="group-label">Дни</div>
        <div className="weekday-row">
          {WEEK_ORDER.map(day => (
            <Action
              key={day}
              className={`weekday ${weekdays.includes(day) ? 'on' : ''}`}
              onClick={() => setWeekdays(weekdays.includes(day) ? weekdays.filter(d => d !== day) : [...weekdays, day])}
            >
              {WEEKDAYS_SHORT[(day + 6) % 7]}
            </Action>
          ))}
        </div>
      </section>

      <section className="form-section">
        <label className="group-label" htmlFor="goal-time">Время шага</label>
        <input id="goal-time" className="time-input" type="time" value={time} onChange={event => setTime(event.target.value)} />
      </section>

      <section className="form-section">
        <div className="group-label">Срок</div>
        <div className="chip-row">
          {DURATIONS.map(d => {
            const value = plusMonths(start, d.months)
            return (
              <Action
                key={d.months}
                className={`suggestion-chip ${deadline === value ? 'selected' : ''}`}
                onClick={() => setDeadline(value)}
              >
                {d.label}
              </Action>
            )
          })}
        </div>
        <input
          className="time-input date-input"
          type="date"
          value={deadline}
          min={addDays(start, 1)}
          onChange={event => event.target.value && setDeadline(event.target.value)}
        />
        <div className="form-hint">Финиш — {formatLong(deadline)}{deadline.slice(0, 4) !== start.slice(0, 4) ? ` ${deadline.slice(0, 4)}` : ''}</div>
      </section>

      <div className="bottom-actions">
        <Action className="secondary-button" onClick={back}>Отмена</Action>
        <Action className="primary-button" onClick={save} disabled={!canSave}>
          {existing ? 'Сохранить' : 'Поставить цель'}
        </Action>
      </div>
    </main>
  )
}
