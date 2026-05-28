# Go2 Demo Judge

JudgeDog Go2 is an online-submission hackathon demo with embodied robot
feedback.

The demo takes pitch text and screenshots, scores the project against a rubric,
then maps the score to a Go2 reaction:

- `>= 95`: legendary celebration
- `90-94`: celebration
- `85-89`: approving motion
- `80-84`: respectful motion
- `75-79`: curious motion
- `70-74`: skeptical scan
- `60-69`: concerned posture
- `< 60`: sad/prone reaction

## Submitted Demo Shape

The web app is reproducible without a robot. It runs in demo mode by default,
so judges can inspect the scoring flow, transcript area, visual evidence panel,
score-to-reaction mapping, and event log.

The real hardware connection is validated in the submitted videos:

- Video A: high score, 90+, Go2 celebration reaction.
- Video B: skeptical score, 70+, Go2 cautious/scanning reaction.

## Run the Web Demo

Run locally:

```sh
cd E:\Antigravity\.codex\apps\go2-demo-judge
node serve.mjs
```

Open:

```text
http://127.0.0.1:8787
```

Use `Load 92 demo` and `Load 72 demo` on the page to reproduce the two
submitted video scenarios.

## Real Go2 Reaction Bridge

For real Go2 reactions, run the persistent reaction bridge inside WSL:

```bash
cd ~/dimos
source .venv/bin/activate
export ROBOT_IP=172.20.10.13
python /mnt/e/Antigravity/.codex/apps/go2-demo-judge/go2_reaction_server.py --ip 172.20.10.13 --port 8788
```

Then start the web server with the bridge URL:

```powershell
cd E:\Antigravity\.codex\apps\go2-demo-judge
$env:GO2_REACTION_SERVER="http://127.0.0.1:8788"
node serve.mjs
```

If the bridge is not running, the web app stays in dry-run mode so the demo can
still be recorded safely.
