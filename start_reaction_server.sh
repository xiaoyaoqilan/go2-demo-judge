#!/usr/bin/env bash
set -euo pipefail

cd /home/zhu/dimos
exec /home/zhu/dimos/.venv/bin/python \
  /mnt/e/Antigravity/.codex/apps/go2-demo-judge/go2_reaction_server.py \
  --ip "${ROBOT_IP:-172.20.10.13}" \
  --port "${GO2_REACTION_PORT:-8788}"
