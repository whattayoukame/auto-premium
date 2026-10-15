#!/bin/bash
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")" && pwd -P)"
TARGET="$HOME/Меню/Projects/auto-premium-github"
REPO='https://github.com/whattayoukame/auto-premium.git'

echo '«Авто Премиум» — обновление GitHub-клона с Mac'

if [ ! -d "$TARGET/.git" ]; then
  echo "Не найден Git-клон: $TARGET"
  echo 'Сначала выполните первый запуск из START_HERE_MAC.md.'
  exit 1
fi

REMOTE="$(git -C "$TARGET" remote get-url origin)"
if [ "$REMOTE" != "$REPO" ]; then
  echo "Неожиданный origin: $REMOTE"
  exit 1
fi

if [ -n "$(git -C "$TARGET" status --porcelain)" ]; then
  echo 'В GitHub-клоне уже есть несохранённые изменения.'
  echo 'Сначала сделайте Commit / Push или отмените ненужные изменения в GitHub Desktop.'
  exit 1
fi

if [ "$(git -C "$TARGET" branch --show-current)" != 'main' ]; then
  echo 'Для синхронизации переключитесь на ветку main в GitHub Desktop.'
  exit 1
fi

echo 'Проверяю последние изменения на GitHub…'
git -C "$TARGET" pull --ff-only origin main

echo 'Копирую обновлённые исходники без локальных секретов и кэшей…'
rsync -a \
  --exclude='.git/' \
  --include='.env.example' \
  --exclude='.env*' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='dev-dist/' \
  --exclude='.vercel/' \
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  --exclude='.DS_Store' \
  --exclude='*.tsbuildinfo' \
  "$SOURCE/" "$TARGET/"

echo 'Изменённые файлы:'
git -C "$TARGET" status --short
echo 'Готово. Проверьте изменения в GitHub Desktop и нажмите Commit to main → Push origin.'
open -a 'GitHub Desktop' "$TARGET"
