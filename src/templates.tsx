import { useState } from 'react'
import { newId, type Data, type Template, type TemplateItem } from './model'
import type { Change, Go } from './nav'
import { Action, Icon, ScreenHeader } from './ui'

type Row = TemplateItem & { key: string }

export function TemplateEditScreen({
  data, change, templateId, go,
}: {
  data: Data
  change: Change
  templateId?: string
  go: Go
}) {
  const existing = templateId ? data.templates[templateId] : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [rows, setRows] = useState<Row[]>(() =>
    (existing?.items ?? [{ title: '', time: null, tag: null }]).map(item => ({ ...item, key: newId() })),
  )

  const setRow = (key: string, fields: Partial<TemplateItem>) =>
    setRows(current => current.map(row => (row.key === key ? { ...row, ...fields } : row)))

  const items = rows
    .filter(row => row.title.trim())
    .map(({ title, time, tag }) => ({ title: title.trim(), time: time || null, tag: tag?.trim().replace(/^#/, '') || null }))
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const canSave = name.trim() && items.length > 0

  const back = () => go({ name: 'profile' })

  const save = () => {
    if (!canSave) return
    const template: Template = { id: existing?.id ?? newId(), name: name.trim(), items, updatedAt: Date.now() }
    change(current => ({ ...current, templates: { ...current.templates, [template.id]: template } }))
    back()
  }

  const remove = () => {
    if (!existing || !window.confirm(`Удалить шаблон «${existing.name}»?`)) return
    change(current => ({
      ...current,
      templates: { ...current.templates, [existing.id]: { ...existing, deleted: true, updatedAt: Date.now() } },
    }))
    back()
  }

  return (
    <main className="screen detail-screen">
      <ScreenHeader eyebrow={existing ? 'Шаблон' : 'Новый шаблон'} title={existing ? 'Изменить шаблон' : 'Собери свой день'} onBack={back} />

      <section className="form-section">
        <label className="group-label" htmlFor="template-name">Название</label>
        <input
          id="template-name"
          className="add-input big"
          value={name}
          autoFocus={!existing}
          placeholder="День тренировки"
          onChange={event => setName(event.target.value)}
        />
      </section>

      <section className="form-section">
        <div className="section-heading compact">
          <div className="group-label">Дела</div>
          <span className="count-label">{items.length}</span>
        </div>
        <div className="template-rows">
          {rows.map(row => (
            <div className="template-row" key={row.key}>
              <input
                className="row-time"
                type="time"
                aria-label="Время"
                value={row.time ?? ''}
                onChange={event => setRow(row.key, { time: event.target.value || null })}
              />
              <div className="row-fields">
                <input
                  className="row-title"
                  value={row.title}
                  placeholder="Что сделать"
                  aria-label="Дело"
                  onChange={event => setRow(row.key, { title: event.target.value })}
                />
                <input
                  className="row-tag"
                  value={row.tag ?? ''}
                  placeholder="#тег"
                  aria-label="Тег"
                  onChange={event => setRow(row.key, { tag: event.target.value })}
                />
              </div>
              <Action
                className="icon-action small danger"
                label="Убрать дело"
                onClick={() => setRows(current => current.filter(r => r.key !== row.key))}
              >
                <Icon name="close" size="sm" />
              </Action>
            </div>
          ))}
        </div>
        <Action
          className="secondary-button wide"
          onClick={() => setRows(current => [...current, { key: newId(), title: '', time: null, tag: null }])}
        >
          <Icon name="plus" size="sm" /> Добавить дело
        </Action>
      </section>

      <div className="bottom-actions">
        {existing ? (
          <Action className="secondary-button square" label="Удалить шаблон" onClick={remove}>
            <Icon name="trash" />
          </Action>
        ) : (
          <Action className="secondary-button" onClick={back}>Отмена</Action>
        )}
        <Action className="primary-button grow" onClick={save} disabled={!canSave}>
          Сохранить шаблон
        </Action>
      </div>
    </main>
  )
}
