#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Cần Node.js 24 trở lên.');
await import('node:sqlite');
NODE

check_ready() {
  node --input-type=module <<'NODE'
try {
  const base = 'http://127.0.0.1:' + (process.env.PORT || '3000');
  const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) });
  if (!health.ok || (await health.json()).status !== 'ok') process.exit(1);
  const catalog = await fetch(base + '/api/products', { signal: AbortSignal.timeout(1500) });
  if (!catalog.ok || !Array.isArray((await catalog.json()).products)) process.exit(1);
} catch {
  process.exit(1);
}
NODE
}

if check_ready; then
  printf 'Gió Studio đã chạy ở cổng %s. Mở tab Ports để xem website.\n' "${PORT:-3000}"
  exit 0
fi

mkdir -p data
nohup npm start > data/codespaces-server.log 2>&1 < /dev/null &
server_pid=$!

for attempt in {1..30}; do
  if check_ready; then
    printf 'Gió Studio đã sẵn sàng ở cổng %s. Mở tab Ports → Open in Browser.\n' "${PORT:-3000}"
    exit 0
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done

printf 'Không thể khởi động cửa hàng. Nhật ký máy chủ:\n' >&2
tail -n 30 data/codespaces-server.log >&2
exit 1
