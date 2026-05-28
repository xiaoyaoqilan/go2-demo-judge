# Go2 Demo Judge

JudgeDog Go2 is an online-submission hackathon demo with embodied robot
feedback.

The demo takes pitch text and screenshots, scores the project against a
robot-dog-specific rubric, then maps the score to a Go2 reaction:

- `Mission Fit`: does the task truly suit a robotic dog?
- `Action Feasibility`: does the shown action match what the robot dog can physically do?
- `Dog Advantage`: is there a clear reason this should outperform or more safely replace a real dog?
- `Use Reality`: does the claimed use have a real real-world use case?

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

The real hardware connection is validated in submitted videos and the live
route can be tested with any pitch text plus screenshots.

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

Paste a project description, add screenshot evidence, and click
`Judge & dispatch` to score the live input.

## DimOS-side Judge and Go2 Reaction Bridge

For real MiniMax judging and Go2 reactions, run the persistent DimOS-side bridge
inside WSL. Keep the MiniMax key in the shell environment; do not commit it.

```bash
cd ~/dimos
source .venv/bin/activate
export MINIMAX_API_KEY="your-minimax-key"

python /mnt/e/Antigravity/.codex/apps/go2-demo-judge/go2_reaction_server.py \
  --ip 192.168.12.1 \
  --method LocalAP \
  --port 8788
```

Then start the web server with the DimOS judge URL and Go2 bridge URL:

```powershell
cd E:\Antigravity\.codex\apps\go2-demo-judge
$env:DIMOS_JUDGE_SERVER="http://127.0.0.1:8788"
$env:GO2_REACTION_SERVER="http://127.0.0.1:8788"
$env:GO2_ROBOT_IP="192.168.12.1"
node serve.mjs
```

In this mode the browser is only the control surface. The judging request goes
to the DimOS-side service, MiniMax scores the pitch there, and the selected score
band can be dispatched to the real Go2 through the same bridge.

If the bridge is not running, the web app falls back safely so the demo can still
be recorded.
