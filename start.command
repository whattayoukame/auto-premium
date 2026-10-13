#!/bin/zsh

# Launch the local Vite development server from Finder or Terminal.
cd -- "${0:A:h}" || exit 1

if [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
elif command -v node >/dev/null 2>&1; then
  node_bin="$(command -v node)"
elif [[ -x /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ]]; then
  node_bin=/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node
else
  print -u2 'Node.js не найден. Установи Node.js с https://nodejs.org/ и запусти файл снова.'
  read -r '?Нажми Enter для закрытия...'
  exit 1
fi

if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  print -u2 'Не найдены зависимости проекта (node_modules). Сначала выполни установку зависимостей.'
  read -r '?Нажми Enter для закрытия...'
  exit 1
fi

print 'Запускаю сайт ATELIER DETAILING...'
print 'Адрес: http://localhost:5173/'
print 'Оставь это окно открытым, пока работаешь с сайтом.'
print 'Для остановки нажми Ctrl+C.'

"$node_bin" ./node_modules/vite/bin/vite.js --host 0.0.0.0
