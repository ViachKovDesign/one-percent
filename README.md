# 1% — расти каждый день

Приложение для ежедневного роста: дела на день, шаблоны, быстрый ввод и привычки.
Стань лучше на 1% сегодня — и ещё на 1% завтра.

Дизайн: макет в Figma Make («Design Dayly Mobile App»).

## Что умеет

- **День** — дела на сегодня с отметками и кольцом прогресса, переключение дней.
  Невыполненные дела сами переезжают на сегодня.
- **Быстрый ввод** — пишешь как думаешь: `завтра в 10:00 зал #спорт !`
  → дело «Зал» на завтра, 10:00, тег «спорт», важное. Понимает «сегодня / завтра / послезавтра»,
  дни недели, «15 октября», «03.01», «через 3 дня», «в 7 вечера».
- **Шаблоны** — набор дел одной кнопкой («Мой обычный день», «День тренировки»).
  В профиле шаблон можно изменить, создать новый или сохранить любой день как шаблон.
- **Цели** — долгая цель со сроком и ежедневным шагом («Выучить Tilda» за 5 месяцев, урок в 19:00).
  Шаг сам появляется в дне, каждая отметка поднимает процент. Видно темп (опережаешь или отстаёшь),
  сколько дней до финиша и этапы цели.
- **Google Календарь** — дела со временем и шаги целей (на неделю вперёд) сами появляются
  в календаре с напоминанием. Отметил «готово» — событие становится «✓ …», серым и без напоминания;
  снял отметку — напоминание возвращается; удалил дело или убрал время — событие удаляется.
  Работает и на iPhone: добавь Google-аккаунт в «Настройки → Календарь → Учётные записи».
- **Привычки** — отметка за сегодня, серия дней подряд, последние 7 дней.
- **Неделя** — прогресс по дням, серия, сделанные дела, лучший день.
- **Работает без интернета** и ставится на телефон как приложение.
- **Вход через Google** и синхронизация между устройствами (через Supabase).

## Как установить на телефон

Открой сайт приложения в браузере:
- **iPhone (Safari):** «Поделиться» → «На экран „Домой“».
- **Android (Chrome):** меню ⋮ → «Добавить на главный экран».

## Настройка Google Календаря (один раз)

1. [console.cloud.google.com](https://console.cloud.google.com) → создай проект `one-percent`.
2. **APIs & Services → Library** → найди **Google Calendar API** → **Enable**.
3. **Google Auth Platform** (OAuth consent screen) → **Get started**: имя приложения `1%`,
   твоя почта, тип **External** → создать.
4. **Audience → Test users → Add users** → добавь свою почту Gmail.
5. **Clients → Create client** → тип **Web application**:
   - Authorized JavaScript origins: `https://viachkovdesign.github.io`
   - Authorized redirect URIs: `https://viachkovdesign.github.io/one-percent/`
6. Скопируй **Client ID** (вида `1234…apps.googleusercontent.com`) и впиши его в `src/config.ts`
   (или в переменную репозитория `GOOGLE_CLIENT_ID`: **Settings → Secrets and variables → Actions → Variables**).
   Это не секрет — он и так виден любому, кто открывает сайт.
7. В приложении: **Профиль → Подключить Google Календарь**. Google покажет предупреждение
   «приложение не проверено» — это нормально для личного приложения: «Продолжить».

## Подключение общего списка дел через Supabase (один раз)

1. Создай проект на [supabase.com](https://supabase.com).
2. **SQL Editor** → вставь содержимое [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers → Google**: включи и вставь Client ID и Secret
   из [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth client → Web application; в «Authorized redirect URIs» — адрес callback, который покажет Supabase).
4. **Authentication → URL Configuration**: в Site URL и Redirect URLs добавь адрес сайта
   `https://<логин>.github.io/one-percent/`.
5. В репозитории на GitHub: **Settings → Secrets and variables → Actions → Variables** добавь
   `SUPABASE_URL` и `SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
6. **Actions → «Публикация на GitHub Pages» → Run workflow.**

Пока Supabase не подключён, приложение полностью работает, но данные хранятся только на одном устройстве.

## Разработка

```bash
npm install
npm run dev     # локальный сервер
npm test        # тесты быстрого ввода и логики
npm run build   # сборка в dist/
```

Стек: React 19, TypeScript, Vite, Supabase.
