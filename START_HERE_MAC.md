# «Авто Премиум» — публикация на GitHub с Mac

Основной проект (здесь идут все дальнейшие изменения):

`/Users/seva/Меню/Projects/повседневка`

Отдельный GitHub-клон для публикации:

`/Users/seva/Меню/Projects/auto-premium-github`

GitHub: https://github.com/whattayoukame/auto-premium

Сайт: https://whattayoukame.github.io/auto-premium/s/autopremium/

## Первый запуск

1. Открой **GitHub Desktop** на Mac и войди в аккаунт `whattayoukame`.
2. Выбери **File → Add Local Repository → Choose**, затем папку `auto-premium-github` в `/Users/seva/Меню/Projects/`. Папка уже является Git-клоном существующего репозитория; **не создавай новый репозиторий**.
3. Проверь в GitHub Desktop **Current Repository: auto-premium**, **Current Branch: main**, **History** и изменения. Если локальный коммит уже подготовлен, нажми **Push origin**. Если нет, внеси `Update Auto Premium from Mac` в **Summary**, нажми **Commit to main**, затем **Push origin**.
4. Открой GitHub → **Actions → Publish Auto Premium to GitHub Pages** и убедись, что последний запуск после push завершился успешно.
5. Если GitHub Pages не обновился, проверь **Settings → Pages → Build and deployment → Source = GitHub Actions** и **Settings → Secrets and variables → Actions**. Требуются два секрета: `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (только публичный anon/publishable key, никогда service_role).
6. Проверь https://whattayoukame.github.io/auto-premium/s/autopremium/ и `/auto-premium/admin`. Открой обе страницы отдельно в новой вкладке и после обновления страницы. Для браузерного роутинга GitHub Pages может вернуть HTTP 404 с fallback HTML; проверяй поведение в браузере.

## Следующие обновления сайта

1. Изменяй исходники только в `повседневка` на Mac.
2. Двойным нажатием запусти `UPDATE_GITHUB_MAC.command` из этой папки. Он безопасно синхронизирует исходники с отдельным Git-клоном и открывает GitHub Desktop. Если macOS блокирует запуск, в Terminal выполни `bash '/Users/seva/Меню/Projects/повседневка/UPDATE_GITHUB_MAC.command'`.
3. В GitHub Desktop проверь **Changes** → **Commit to main** → **Push origin**. При наличии уже готового коммита нажми только **Push origin**.
4. После зелёного **Actions** проверь опубликованные страницы.

Скрипт намеренно не копирует `.git`, `.env*`, `node_modules`, `dist`, служебные кэши и тестовые отчёты. Перед копированием проверяет, что в клоне нет несохранённых правок и синхронизирует его с удалённым `main`. Архивы, ручная передача на Windows и создание второго GitHub-репозитория не нужны.

**Граница готовности:** эта публикация — предварительная версия до подтверждения четырёх проверок из `AGENTS.md`: реальная тестовая запись/отмена/гонка за слот, RLS и права Supabase, роутинг опубликованного сайта и окончательное клиентское содержимое/права на изображения. Не принимайте реальные записи до их проверки. SQL `supabase/autopremium-status-actions.sql` и `supabase/autopremium-payments.sql` подготовлены локально; их применение в продакшен-базе отдельно не подтверждено.
