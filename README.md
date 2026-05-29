# JudgeDoggo Go2

An embodied hackathon judge: a Unitree Go2 quadruped that scores hackathon pitches with a multimodal LLM (MiniMax) and reacts physically based on the score.

You paste a pitch, drop in screenshots **or capture a frame straight from the robot's camera**, and a Three.js cartoon dog mirrors the verdict on screen while the real Go2 performs the corresponding choreography — celebrate, nod, scan skeptically, sit down in concern, dramatic-cry into a lying pose, etc.

## What's in this build

This branch is the integration of the pink/3D-dog frontend redesign and a real Go2 backend pipeline:

- **Pink redesign + 3D dog** (from `design/judgedoggo-redesign`): JudgeDoggo mascot, paw icon, background loop video, Three.js + GSAP cartoon dog driven by reaction state, animated panel gradients, polished shadow scale.
- **Go2 camera capture**: a `Capture from Go2 camera` button pulls a real H.264 frame off the robot over WebRTC, encodes it as JPEG, and feeds it into the same evidence flow as uploaded screenshots.
- **MiniMax judging via DimOS**: the Python server proxies `/judge` to MiniMax's Anthropic-compatible endpoint with a structured rubric prompt, returning a verdict + per-dimension scores.
- **Reaction recovery**: every reaction (including the "lie down and cry" sequence for low scores) now ends with `RecoveryStand` + `BalanceStand` so the dog is back in a movement-ready stance afterwards.
- **Resilient WebRTC connection**: the controller detects dead peer connections (`isConnected=false` after dimos/app contention) and lazily reconnects on the next call.
- **Dimos dashboard**: patched the installed `rerun_dashboard.html` template to point at the actual rerun ports this dimos build uses (9878/9877 instead of the hardcoded 9090/9876).
- **Frontend visual cleanup**: unified shadow scale tokens (`--shadow-sm/md/lg/soft`), unified ink color across all shadows, `prefers-reduced-motion` support, keyboard focus rings, `mp4` MIME type so the background video preloads correctly.

## Rubric

Four equally-weighted dimensions (25 pts each):

| | |
|---|---|
| Mission Fit | Does this task truly suit a robotic dog (Go2 hardware/body)? |
| Action Feasibility | Does the shown action match what a Go2 can physically do? |
| Dog Advantage | Clear reason this beats / safely replaces a real dog? |
| Use Reality | Does the claimed use have a real-world deployment context? |

## Score → reaction map

| Score | Reaction | Dog choreography |
|---|---|---|
| ≥ 95 | legendary | Dance2 + FingerHeart |
| 90–94 | celebrate | Dance1 |
| 85–89 | approve | Hello (wave) |
| 80–84 | respect | Stretch |
| 75–79 | curious | head tilt |
| 70–74 | skeptical | side-to-side scan |
| 60–69 | concerned | ConcernedDrop |
| < 60 | cry | DramaticCry (shake → sit → lie down) |

After each reaction the dog automatically returns to a balanced stand so you can keep driving it around between judgments.

## Architecture

```
┌─────────────────┐  http://127.0.0.1:8787   ┌──────────────────┐
│ Browser (UI)    │ ───────────────────────► │ Node web server  │
│ • pitch text    │                          │ serve.mjs        │
│ • screenshots   │                          │ (static + proxy) │
│ • capture btn   │                          └────────┬─────────┘
│ • 3D dog        │                                   │
└─────────────────┘                                   │
                                                      ▼
                            ┌─────────────────────────────────────────┐
                            │ Python judge + snapshot server (8788)   │
                            │ go2_reaction_server.py                  │
                            │  /judge   → MiniMax HTTP                │
                            │  /snapshot→ Go2 WebRTC video track      │
                            │  /react   → Go2 WebRTC sport commands   │
                            └─────────┬─────────────────┬─────────────┘
                                      │                 │
                                      ▼                 ▼
                            ┌──────────────────┐  ┌─────────────────┐
                            │ MiniMax API      │  │ Unitree Go2     │
                            │ (text + vision)  │  │ 192.168.12.1    │
                            │                  │  │ WebRTC :8081    │
                            └──────────────────┘  └─────────────────┘
```

Dimos runs in parallel as a separate visualization stack (dashboard at 7779, Rerun web viewer at 9878). **The Go2 only allows one WebRTC peer at a time** — the judge server and dimos cannot both hold the robot connection. In normal operation the judge server owns it; dimos comes up but its Rerun pane stays empty until you stop the judge server.

## Running it

### Prereqs

- macOS (Apple Silicon is fine), Node ≥ 18.
- The `dimos/` repo cloned with its venv (`dimos/.venv/`) at `/Users/apple/Documents/go2-demo-judge/dimos/`, installed from `git+https://github.com/dimensionalOS/dimos@feat/integrate-zenoh` with all extras.
- A `MINIMAX_API_KEY`.
- A Unitree Go2 powered on, reachable at `192.168.12.1`, with its WebRTC `/offer` service listening (port 8081 OPEN).

### Pre-flight check

```sh
nc -z -G 1 192.168.12.1 8081 && echo OPEN || echo closed
```

If `closed`, the Go2's WebRTC service is hung — power-cycle the robot (back button, hold ~3s for off, wait 5s, single press for on). No software workaround.

### Launch — three shells, in this order

The order matters. The judge server must grab the Go2's single WebRTC peer slot before dimos tries.

**Shell 1 — judge + snapshot server (port 8788)**

```sh
MINIMAX_API_KEY="<your-key>" \
/Users/apple/Documents/go2-demo-judge/dimos/.venv/bin/python \
/Users/apple/Documents/go2-demo-judge/go2_reaction_server.py \
  --ip 192.168.12.1 --port 8788 --method LocalAP
```

**Shell 2 — Node web app (port 8787, the demo UI)**

```sh
cd /Users/apple/Documents/go2-demo-judge && \
DIMOS_JUDGE_SERVER="http://127.0.0.1:8788" \
GO2_REACTION_SERVER="http://127.0.0.1:8788" \
GO2_ROBOT_IP="192.168.12.1" \
MINIMAX_API_KEY="<your-key>" \
node serve.mjs
```

**Shell 3 — dimos (dashboard 7779, Rerun viewer 9878, gRPC 9877)**

```sh
cd /Users/apple/Documents/go2-demo-judge/dimos && \
RUST_LOG="zenoh=warn,zenoh::net::runtime::orchestrator=off" \
/Users/apple/Documents/go2-demo-judge/dimos/.venv/bin/dimos \
  --robot-ip 192.168.12.1 --robot-ips 192.168.12.1 \
  --rerun-open web run unitree-go2
```

### URLs

- **http://127.0.0.1:8787** — JudgeDoggo demo UI (main interface)
- **http://127.0.0.1:7779/** — dimos dashboard (command center + Rerun viewer; the Rerun pane only shows live data when dimos owns the WebRTC slot)

### Mode tradeoff

The Go2 won't accept two WebRTC peers. Pick one mode at a time:

| Mode | Stack | What works | What doesn't |
|---|---|---|---|
| Demo / judging | Judge server + Node | Snapshots, reactions, scoring | Rerun pane empty, no keyboard control via dimos |
| Drive / visualize | Dimos only (stop judge server) | Keyboard control, map, camera in Rerun | No `/react` or `/snapshot` from the web app |

To switch from demo mode to drive mode: stop the judge server (`lsof -ti:8788 \| xargs kill`), then restart dimos so its single connect attempt succeeds.

## API surface

The Node server proxies these to the Python service:

- `GET  /api/health` — env / config snapshot
- `POST /api/judge` — `{projectName, transcript, screenshotCount}` → `{provider, result:{total_score, dimensions, dimension_reasons, evidence, questions, verdict, reaction}}`
- `POST /api/snapshot` — pulls a fresh JPEG from the robot's camera, returns a data URL
- `POST /api/react` — `{reaction}` where reaction ∈ `cry|concerned|skeptical|curious|respect|approve|celebrate|legendary|fingerheart|recover` (plus stunt `flip` if `unsafe:true`)
- `POST /api/speak` — MiniMax TTS for the verdict line

## Repo layout

```
go2-demo-judge/
├── index.html              # JudgeDoggo UI shell
├── styles.css              # pink redesign + shadow scale
├── app.js                  # frontend logic, score → reaction, capture button
├── dog3d.js                # Three.js 3D cartoon dog (driven by setDogReaction)
├── serve.mjs               # Node static + API proxy (Node ≥ 18, zero deps)
├── go2_reaction_server.py  # Python: judge + snapshot + react via WebRTC
├── go2_webrtc_reaction.py  # one-shot CLI variant of the reaction dispatcher
├── go2_reaction_bridge.py  # safe mock bridge (prints commands, no hardware)
├── judgedoggo_paw_icon.png # mascot asset
├── judgedoggo_friendly_text.png
├── f_ce_b_c_f_b_e_c_cbmp_.mp4  # background loop video
└── dimos/                  # local dimos repo + venv (gitignored)
```

## Known constraints

- Go2 LocalAP method: only one WebRTC peer at a time. Stopping one client mid-handshake can leave the robot's service stuck holding the dead peer slot — symptom is port 8081 going to "refused" indefinitely. Cure is a Go2 power cycle.
- Dimos doesn't auto-retry its WebRTC connection. If the robot isn't reachable at dimos startup, dimos comes up without robot data and stays that way until you restart it.
- The MiniMax API key embedded in the launch commands should be rotated periodically — treat it like a secret.

## Credits

Built on top of [dimensionalOS/dimos](https://github.com/dimensionalOS/dimos) (`feat/integrate-zenoh` branch) with [Unitree's WebRTC SDK](https://github.com/legion1581/unitree_webrtc_connect), [aiortc](https://github.com/aiortc/aiortc), [Rerun](https://rerun.io/) for visualization, and [MiniMax](https://www.minimax.io/) for multimodal scoring and TTS. Pink redesign + 3D dog originally on `design/judgedoggo-redesign`.
