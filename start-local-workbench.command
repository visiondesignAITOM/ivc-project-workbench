#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_DIR="/Users/visionx3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
PNPM_BIN="/Users/visionx3/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"

cd "$SCRIPT_DIR"
export PATH="$NODE_DIR:$PATH"

if [[ ! -x "$PNPM_BIN" ]]; then
  echo "找不到本機執行環境，請回到 Codex 重新啟動工作台。"
  read -r
  exit 1
fi

echo "IVC 專案工作台啟動中…"
echo "網址：http://localhost:3000/"
echo "停止時請按 Control + C"
echo

exec "$PNPM_BIN" run dev
