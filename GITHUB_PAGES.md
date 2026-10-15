# «Авто Премиум» — публикация и подключение записи

**Начни с `START_HERE_MAC.md`**: это актуальная пошаговая инструкция публикации напрямую с Mac через GitHub Desktop. `START_HERE_WINDOWS.md` оставлен как исторический запасной маршрут. Текущий файл — подробный справочник по настройкам.

**Обновление статусов 14.10.2026:** если `autopremium-setup.sql` уже применён, открой `supabase/autopremium-status-actions.sql` и выполни его отдельно в Supabase SQL Editor. Это расширит допустимые статусы существующих записей и разрешит владельцу менять их. Без SQL новый выбор статуса может не сохраняться.

**Предпубликационная проверка 15.10.2026:** запусти read-only аудит `supabase/autopremium-release-audit.sql` (запросы по одному). Анонимный REST-доступ к `bookings` и `studio_owners` сейчас возвращает HTTP 401, а `autopremium_payments` — HTTP 404/PGRST205. Проверка RLS владельца, наличия архивирующей RPC и SQL-миграций требует SQL Editor. После подготовки новых маршрутов `vite.config.ts` прямые опубликованные пути должны отвечать HTTP 200 вместо прежнего 404 с fallback HTML; проверь это после нового GitHub Actions deploy.

Исходники разрабатываются на **Mac** в `/Users/seva/Меню/Projects/повседневка`. **GitHub Desktop теперь установлен и авторизован на Mac**. Актуальный путь публикации: рабочий проект Mac → отдельный клон `auto-premium-github` → GitHub Desktop на Mac → GitHub Actions. Имя репозитория — **auto-premium**. Основная страница `/s/autopremium/`, форма `/s/autopremium/booking`, кабинет владельца `/admin`. Адрес проекта GitHub Pages: `https://whattayoukame.github.io/auto-premium/` (все пути после него добавляются без второго `auto-premium`). Сайт остаётся **предварительной версией** до завершения четырёх критических проверок перед реальными записями.

## 1. Настройка Supabase — новая студия

1. Открой [Supabase Dashboard](https://supabase.com/dashboard), выбери **именно проект** `dezrztmfucvptdqwzvqv`.
2. В левом меню открой **SQL Editor → New query**.
3. В Finder на Mac открой папку проекта → `supabase` → **`autopremium-setup.sql`**. Это обычный текстовый файл: открой его в TextEdit (или VS Code), выдели весь текст `⌘A`, скопируй `⌘C`.
4. Вставь в Supabase SQL Editor и нажми **Run**. Это **новый** скрипт для «Авто Премиум», а **не** `demo-rls.sql` и не старую миграцию `20261011000000_booking.sql`. Существующие записи удалять не нужно.
5. Если появится ошибка про сигнатуру `create_booking`, `get_busy` или SECURITY DEFINER, **не отключай проверки**. Открой отдельный запрос и выполни:

   ```sql
   select proname, pg_get_function_identity_arguments(p.oid) as args,
          pg_get_function_result(p.oid) as result, p.prosecdef as security_definer
   from pg_proc p join pg_namespace n on p.pronamespace = n.oid
   where n.nspname = 'public' and proname in ('create_booking','get_busy');
   ```

   Нужно сопоставить результат с RPC из кода и проверить, что SQL-функции действительно атомарно блокируют занятые интервалы и повторный `p_key`. Пока это не проверено, не принимать реальные записи.
6. В **Table Editor → studios** должна появиться `slug = autopremium`, `name = АВТО ПРЕМИУМ`; в **services** — 12 услуг с соответствующим `studio_id`. Стоимость и длительность этих услуг теперь читаются сайтом из Supabase. Другие колонки представления пока остаются шаблоном сайта.

## 2. Владелец и доступ к записям

1. В Supabase открой **Authentication → Users → Add user**; создай владельца с email и паролем (или найди уже созданного пользователя).
2. Скопируй его **User UID**. В **SQL Editor → New query** вставь следующий SQL, заменив `ВСТАВЬ_USER_UID` на действительный UUID пользователя:

   ```sql
   insert into public.studio_owners (user_id, studio_id)
   select 'ВСТАВЬ_USER_UID'::uuid, id
   from public.studios where slug = 'autopremium'
   on conflict do nothing;
   ```

3. В **Table Editor → studio_owners** убедись, что строка появилась именно для `autopremium`. Политики RLS дают клиентам только доступ к студии/услугам и безопасным RPC; список записей и смена статуса доступны владельцу.
4. Кабинет будет по адресу `https://ВАШ-ЛОГИН.github.io/auto-premium/admin`. Вход осуществляется через **email и пароль** этого Supabase-пользователя.

## 3. Ключи Supabase

1. В Supabase открой **Project Settings → API Keys** (или новый раздел **API Keys**) и скопируй **anon** либо **publishable** key. **Никогда не копируй `service_role` или `secret` key в сайт!**
2. На Mac открой скрытый текстовый файл `повседневка/.env`. Если Finder его не показывает, нажми `⌘⇧.`. Внутри должны быть две строки:

   ```dotenv
   VITE_SUPABASE_URL=https://dezrztmfucvptdqwzvqv.supabase.co
   VITE_SUPABASE_ANON_KEY=ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ
   ```

3. Сохрани файл в режиме **обычного текста**, без расширения `.txt`. Он исключён из Git и не публикуется. При локальном запуске перезапусти сервер, чтобы Vite перечитал `.env`.

## 4. Историческая передача проекта Mac → Windows → GitHub и Actions Secrets

**Для текущей публикации используй `START_HERE_MAC.md`.** Инструкции ниже сохранены на случай возвращения к Windows и не нужны при работе на Mac.

1. **На Windows** открой **GitHub Desktop**. В **Current Repository** проверь, какой репозиторий выбран. Если на GitHub уже опубликован `auto-premium` (пусть даже сейчас он показывает старый ATELIER), открой **File → Clone repository → GitHub.com**, выбери именно `auto-premium` и клонируй его в папку Windows (или выбери существующий локальный клон). **Не создавай второй репозиторий**, если нужный уже есть. Проверь выбранную папку через **Repository → Show in Explorer**.
2. **На Mac** перенеси на Windows подготовленный архив `auto-premium-transfer-2026-10-14.zip` с Рабочего стола, распакуй его. Архив уже включает папки `src`, `public`, `tenants`, `supabase`, `.github` и корневые файлы проекта; `.env`, `.git`, `node_modules`, `dist` исключены. Переносить все файлы вручную необязательно.
3. **На Windows** открой папку клонированного репозитория через **Repository → Show in Explorer** и скопируй туда **содержимое распакованного архива**, сохранив структуру папок и разрешив замену старых исходников. Копируй файлы изнутри, а не целую папку с архивом. Не заменяй `.git` клона. Убедись, что в корне есть `.github/workflows/pages.yml`, `src/auto-premium.tsx`, `tenants/autopremium/settings.json` и `supabase/autopremium-setup.sql`.
4. Если на GitHub **ещё нет** репозитория `auto-premium`, на Windows в GitHub Desktop можно открыть перенесённую папку через **File → Add Local Repository**, при необходимости создать в ней репозиторий и нажать **Publish repository**, задав имя `auto-premium`. Не делай этого, если уже есть опубликованный репозиторий, — используй шаги 1–3.
5. Открой на GitHub **репозиторий `auto-premium` → Settings → Secrets and variables → Actions → New repository secret**. Добавь отдельно:
   - `VITE_SUPABASE_URL` = `https://dezrztmfucvptdqwzvqv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = тот самый публичный ключ из Supabase.
6. **На Windows** вернись в GitHub Desktop: проверь **Changes** (должны быть файлы «Авто Премиум») → введи `Connect Auto Premium booking and Pages` → **Commit to main** → **Push origin**. При новой публикации будет **Publish repository**. **Одной кнопки Publish до переноса файлов с Mac недостаточно**: она отправит старый код с Windows.
7. На сайте GitHub открой **Settings → Pages → Build and deployment → Source**, выбери **GitHub Actions**.
8. Перейди в **Actions → Publish Auto Premium to GitHub Pages**. Дождись зелёного завершения **последнего** workflow из нового коммита (или нажми **Run workflow**). Если secrets не заданы, workflow остановится с ошибкой, чтобы не выкладывать демо с локальными записями.

## 5. Проверка опубликованного сайта

1. В **Settings → Pages** открой опубликованный URL, например `https://ВАШ-ЛОГИН.github.io/auto-premium/`. Должен появиться тёмный бежево-коричневый сайт **«АВТО ПРЕМИУМ»**. Если появился синий ATELIER, проверь, что открываешь **новый репозиторий**, что в **Actions** есть зелёная сборка свежего коммита, и обнови страницу с очисткой кэша.
2. Перейди на `/auto-premium/s/autopremium/booking`: выбери услугу/дату/время, проверь отметки «занято». Для живой проверки создавай тестовую запись только после проверки RPC и согласования с владельцем.
3. Открой `/auto-premium/admin`, войди через Supabase Auth: запись должна появиться в списке. В колонке «ДЕЙСТВИЯ» выбери «Готово», затем «Завершено», проверь сохранение статусов после перезагрузки. Для тестовой записи отдельно проверь «Отменено» и освобождение времени. Открой ссылку `/auto-premium/admin` напрямую в новой вкладке, чтобы проверить `404.html` fallback.

**Текущее ограничение:** пока не подтверждены передача свежих исходников с Mac на Windows, коммит и push в нужный удалённый репозиторий, применение SQL, GitHub secrets, настоящая запись в базе, Realtime и реальный iPhone. Не следует утверждать, что запись дошла до владельца. В старом `/s/atelier/` по-прежнему существует отдельная демонстрационная версия, но маршрут `/` направлен на «Авто Премиум».
