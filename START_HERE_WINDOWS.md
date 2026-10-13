# Авто Премиум — карта запуска с Mac через Windows

**Где что находится:** на Mac редактируем исходники в `/Users/seva/Меню/Projects/повседневка`. На отдельном Windows-компьютере работает GitHub Desktop, который отправляет файлы в существующий репозиторий GitHub. GitHub Actions собирает сайт и выкладывает GitHub Pages. Supabase хранит услуги, время и записи клиентов.

**Важное:** не создавай новый репозиторий, если старый с опубликованной ссылкой уже существует. Сначала обнови файлы **именно в его Windows-клоне**. Старый синий ATELIER виден, потому что свежие файлы Auto Premium с Mac туда ещё не были отправлены.

## Этап 1. Перенос с Mac на Windows

1. На Mac найди подготовленный архив `auto-premium-transfer-2026-10-13.zip` (смотри путь, указанный в чате). Это исходники сайта, включая скрытый workflow `.github`, но без `.env`, `.git`, `node_modules` и сборки `dist`.
2. Передай архив на Windows по флешке, общему диску или через облако. Не нужно переносить весь рабочий каталог Mac и отдельно искать скрытые папки.
3. На Windows нажми на архив правой кнопкой → **Extract All / Извлечь всё**. Открой распакованную папку: прямо в ней должны лежать `index.html`, `package.json`, `src`, `public`, `tenants`, `supabase`, `.github`.
4. Если Windows не показывает `.github`, включи **Проводник → Вид → Показать → Скрытые элементы** (или просто убедись, что папка включена при копировании всего содержимого).

## Этап 2. Правильный репозиторий в GitHub Desktop на Windows

1. Открой сайт GitHub в браузере Windows и найди репозиторий, из которого сейчас открывается синяя старая версия. Проверь точное имя в адресной строке; рекомендованное имя — `auto-premium`.
2. Запусти **GitHub Desktop** → **File → Clone repository...** → вкладка **GitHub.com** → выбери **уже существующий** репозиторий → укажи **Local path** → **Clone**. Если этот репозиторий уже добавлен в GitHub Desktop, просто выбери его в **Current Repository**, заново клонировать не нужно.
3. Выбери **Repository → Show in Explorer**. Откроется **корень Windows-клона**, в котором GitHub Desktop хранит скрытую папку `.git`. **Не удаляй и не перезаписывай `.git`**.
4. В отдельном окне Проводника открой распакованный архив. Выдели все файлы **внутри** распакованной папки (`Ctrl+A`), нажми `Ctrl+C`, перейди в корень Windows-клона, нажми `Ctrl+V` и разреши замену старых файлов. Не вкладывай папку с названием архива внутрь клона.
5. Проверь наличие в корне Windows-клона: `index.html` (заголовок «Авто Премиум»), `src/auto-premium.tsx`, `tenants/autopremium/settings.json`, `supabase/autopremium-setup.sql`, `.github/workflows/pages.yml`. GitHub Desktop должен показать много **Changes** — это ожидаемо.
6. **Пока не нажимай Push**, если в Supabase ещё не готова студия: сайт после успешной публикации будет искать `autopremium` в Supabase и не загрузится, если строки там нет.

## Этап 3. Подготовка Supabase до публикации

1. На Windows открой [Supabase Dashboard](https://supabase.com/dashboard) → проект с ID `dezrztmfucvptdqwzvqv` → **SQL Editor → New query**.
2. Для диагностики старой ошибки `42883` сначала безопасно проверь сигнатуры функций, выполнив:

   ```sql
   select proname, pg_get_function_identity_arguments(p.oid) as args,
          pg_get_function_result(p.oid) as result, p.prosecdef as security_definer
   from pg_proc p join pg_namespace n on p.pronamespace = n.oid
   where n.nspname = 'public' and proname in ('create_booking','get_busy');
   ```

3. Сопоставь вывод с требованиями в `GITHUB_PAGES.md`: `create_booking` должна принимать `p_studio`, `p_service`, `p_name`, `p_phone`, `p_car`, `p_start`, `p_key`, а `get_busy` — `p_studio`, `p_from`, `p_to`. **Если не совпадают типы, имена, отсутствуют функции либо есть другая ошибка — остановись и передай текст ошибки для исправления SQL.** Также до реальных записей нужно проверить атомарность резервирования слотов и идемпотентность `p_key` в самих функциях.
4. После проверки открой `supabase/autopremium-setup.sql` через **Блокнот или VS Code**, скопируй весь текст, вставь в **Supabase SQL Editor → New query → Run**. Нужен именно `autopremium-setup.sql`, не старый `demo-rls.sql`. При ошибке не отключай проверки в SQL.
5. В **Table Editor** проверь: таблица `studios` содержит `slug = autopremium`, а `services` — 12 услуг этой студии.
6. В **Authentication → Users → Add user** создай учётную запись владельца (email + пароль), скопируй **User UID**. Добавь его в `studio_owners` по запросу из `GITHUB_PAGES.md` (раздел 2), подставив настоящий UID. Не присылай пароль в чат.

## Этап 4. Ключи и запуск GitHub Pages

1. В Supabase **Project Settings → API Keys** скопируй только **anon/publishable key**. `service_role`/секретный ключ никогда не размещается на сайте или в файлах репозитория.
2. На сайте GitHub открой **тот же репозиторий → Settings → Secrets and variables → Actions → New repository secret**. Создай **два отдельных** секрета: `VITE_SUPABASE_URL` со значением `https://dezrztmfucvptdqwzvqv.supabase.co` и `VITE_SUPABASE_ANON_KEY` со скопированным публичным ключом. Этот публичный ключ попадёт в браузерную сборку; доступ к таблицам должен ограничиваться RLS.
3. На GitHub открой **Settings → Pages → Build and deployment → Source** и выбери **GitHub Actions**. Используй уже существующий `.github/workflows/pages.yml`, новый шаблон workflow создавать не надо.
4. Вернись в **GitHub Desktop на Windows** → вкладка **Changes**: убедись, что есть новые файлы Auto Premium и `index.html`, но **нет `.env`**. Внизу в поле **Summary** напиши `Publish Auto Premium with Supabase`, затем **Commit to main** и **Push origin**.
5. В браузере GitHub выбери вкладку **Actions** → workflow **Publish Auto Premium to GitHub Pages**. Последний запуск из только что отправленного коммита должен стать зелёным. Если красный — открой запуск и пришли текст ошибки. Если репозиторий приватный и на твоём тарифе Pages недоступен, проверь **Settings → General → Danger Zone → Change repository visibility** и возможность сделать репозиторий публичным; это публикует исходный код, поэтому делай осознанно.

## Этап 5. Проверяем ссылку и настоящую запись

1. В **GitHub → Settings → Pages** нажми **Visit site**. Пример адреса, если репозиторий называется `auto-premium`: `https://ТВОЙ-ЛОГИН.github.io/auto-premium/`. Должна открываться **«Авто Премиум»** в бежево-коричневой теме.
2. Открой `https://ТВОЙ-ЛОГИН.github.io/auto-premium/s/autopremium/booking`: проверь список услуг из Supabase, календарь и пометки занятого времени.
3. Когда RPC и права владельца проверены, создай **тестовую запись с согласия владельца**; проверь, что она появилась в Supabase `bookings`.
4. Открой `https://ТВОЙ-ЛОГИН.github.io/auto-premium/admin`, войди владельцем и проверь, что видны услуга, клиент, телефон, авто и время. Нажми **Отменить** для тестовой записи; проверь, что статус стал `cancelled`, а слот снова свободен.
5. Открой ссылку на `/admin` сразу в новой вкладке — должна работать SPA-переадресация через `404.html`. Отдельно проверь с телефона, когда сайт опубликован.

**Когда что-то не работает:** синий ATELIER = чаще всего старые файлы или старая сборка; пустая/ошибочная студия = отсутствует строка `autopremium` либо ошибочны ключи/RLS; красный GitHub Actions = изучи конкретный шаг упавшей сборки; ошибки `42883`/`slot_taken` = разбираться с серверными RPC, а не с расположением SQL-файла. В `GITHUB_PAGES.md` есть более подробные пояснения по Supabase и правам.
