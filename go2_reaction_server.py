"""Local reaction server for Go2 Demo Judge.

Run this inside WSL in the dimos virtual environment. It exposes a tiny HTTP
server that accepts judge reactions and sends safe Go2 WebRTC sport commands.
Keep it on localhost.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from unitree_webrtc_connect.constants import RTC_TOPIC, SPORT_CMD
from unitree_webrtc_connect.webrtc_driver import UnitreeWebRTCConnection, WebRTCConnectionMethod


REACTIONS: dict[str, list[str]] = {
    "cry": ["StopMove", "DramaticCry"],
    "concerned": ["StopMove", "ConcernedDrop"],
    "skeptical": ["StopMove", "Scan"],
    "curious": ["StopMove", "Curious"],
    "respect": ["StopMove", "Stretch"],
    "approve": ["StopMove", "Hello"],
    "celebrate": ["StopMove", "Dance1"],
    "legendary": ["StopMove", "Dance2", "FingerHeart"],
    "fingerheart": ["StopMove", "FingerHeart"],
    "recover": ["StopMove", "StandUp"],
}

STUNT_REACTIONS: dict[str, list[str]] = {
    "flip": ["StopMove", "BackFlip"],
    "backflip": ["StopMove", "BackFlip"],
}


def reaction_for_score(score: int) -> str:
    if score >= 95:
        return "legendary"
    if score >= 90:
        return "celebrate"
    if score >= 85:
        return "approve"
    if score >= 80:
        return "respect"
    if score >= 75:
        return "curious"
    if score >= 70:
        return "skeptical"
    if score >= 60:
        return "concerned"
    return "cry"


def fallback_score(transcript: str = "", screenshot_count: int = 0) -> dict[str, Any]:
    normalized = transcript.lower()
    words = len(transcript.strip().split())
    keyword_groups = {
        "mission_fit": ["mission", "task", "suit", "robotic dog", "go2", "unitree", "environment", "hardware"],
        "action_feasibility": ["action", "motion", "movement", "command", "webrtc", "localap", "physically", "safe"],
        "dog_advantage": ["advantage", "outperform", "replace", "real dog", "safer", "patrol", "terrain", "autonomous"],
        "use_reality": ["real use", "real-world", "field", "deployment", "scenario", "setup", "use case", "practical"],
    }
    dimensions: dict[str, int] = {}
    for key, keywords in keyword_groups.items():
        hits = sum(1 for keyword in keywords if keyword in normalized)
        length_bonus = min(12, words // 22)
        screenshot_bonus = min(10, screenshot_count * 4)
        keyword_bonus = min(24, hits * 6)
        dimensions[key] = max(45, min(88, 52 + length_bonus + screenshot_bonus + keyword_bonus))

    total = round(
        dimensions["mission_fit"] * 0.25
        + dimensions["action_feasibility"] * 0.25
        + dimensions["dog_advantage"] * 0.25
        + dimensions["use_reality"] * 0.25
    )
    return {
        "total_score": total,
        "dimensions": dimensions,
        "dimension_reasons": {
            "mission_fit": "Fallback checks whether the pitch mentions a concrete Unitree Go2 mission, setup, or hardware fit.",
            "action_feasibility": "Fallback checks whether the pitch names concrete robot actions, motion commands, or safety constraints.",
            "dog_advantage": "Fallback checks whether the pitch explains why a robotic dog is better or safer than a real dog or ordinary camera.",
            "use_reality": "Fallback checks whether the pitch gives a real-world use case, field scenario, or practical deployment context.",
        },
        "evidence": ["DimOS-side local fallback scoring used because MiniMax was not available."],
        "questions": ["Which part of the demo is live, and which part is simulated?"],
        "verdict": "Fallback score generated inside the DimOS-side Go2 judge service.",
    }


def extract_json(text: str) -> dict[str, Any]:
    raw = text
    if "```json" in raw:
        raw = raw.split("```json", 1)[1].split("```", 1)[0]
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("MiniMax did not return JSON")
    return json.loads(raw[start : end + 1])


def parse_score_line(text: str, label: str) -> int:
    prefix = f"{label}:"
    for line in text.splitlines():
        normalized = line.strip().replace("*", "")
        if normalized.lower().startswith(prefix.lower()):
            digits = "".join(ch if ch.isdigit() else " " for ch in line).split()
            if digits:
                return max(0, min(100, int(digits[0])))
    return 0


def section_bullets(text: str, section: str) -> list[str]:
    lines = text.splitlines()
    output: list[str] = []
    in_section = False
    for line in lines:
        stripped = line.strip()
        normalized = stripped.replace("*", "")
        if normalized.lower().startswith(f"{section.lower()}:"):
            in_section = True
            continue
        if in_section and normalized.endswith(":") and not stripped.startswith("-"):
            break
        if in_section and stripped.startswith("-"):
            output.append(stripped[1:].strip())
    return output


def parse_minimax_verdict(text: str) -> dict[str, Any]:
    mission_raw = parse_score_line(text, "Mission Fit")
    action_raw = parse_score_line(text, "Action Feasibility")
    dog_raw = parse_score_line(text, "Dog Advantage")
    field_raw = parse_score_line(text, "Field Readiness")
    dimensions = {
        "mission_fit": mission_raw * 4,
        "action_feasibility": action_raw * 4,
        "dog_advantage": dog_raw * 4,
        "use_reality": field_raw * 4,
    }
    total = parse_score_line(text, "Total Score")
    if not total:
        total = round(sum(dimensions.values()) / 4)

    verdict = ""
    for line in text.splitlines():
        normalized = line.strip().replace("*", "")
        if normalized.lower().startswith("verdict:"):
            verdict = normalized.split(":", 1)[1].strip()
            break

    visible = section_bullets(text, "Visible Evidence")
    missing = section_bullets(text, "Missing Proof")
    final_dog = ""
    for line in text.splitlines():
        normalized = line.strip().replace("*", "")
        if normalized.lower().startswith("final dog verdict:"):
            final_dog = normalized.split(":", 1)[1].strip()
            break

    return {
        "total_score": max(0, min(100, total)),
        "dimensions": dimensions,
        "dimension_reasons": {
            "mission_fit": visible[0] if len(visible) > 0 else "The model judged whether the mission fits a Unitree Go2 body and setup.",
            "action_feasibility": visible[1] if len(visible) > 1 else "The model judged whether the claimed actions are physically realistic for Go2.",
            "dog_advantage": missing[0] if len(missing) > 0 else "The model judged whether the robot dog has a clear advantage over alternatives.",
            "use_reality": missing[1] if len(missing) > 1 else "The model judged whether the shown setup matches the claimed real-world use.",
        },
        "evidence": [item for item in visible[:3]],
        "questions": [f"Missing proof: {item}" for item in missing[:3]],
        "verdict": f"{verdict} {final_dog}".strip(),
        "raw_verdict": text,
    }


def call_minimax_judge(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("MINIMAX_API_KEY")
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is not configured in WSL/DimOS")

    prompt = "\n".join(
        [
            "You are a serious Unitree Go2 robot dog judge.",
            "",
            "Your job is to judge this project as if you are a real Go2-type quadruped robot dog reviewing whether this project truly suits your body, movement, and real deployment use.",
            "",
            "You can judge ONLY from:",
            "1. the short project description text",
            "2. the provided still images",
            "",
            "There is:",
            "- no video",
            "- no audio",
            "- no GitHub",
            "- no live demo",
            "- no hidden proof outside the images and text",
            "",
            "Important judging rule:",
            "- Treat the text as the project claim.",
            "- Treat the photos as the physical evidence.",
            "- If something is not visible in the photos and not clearly stated in the text, do not assume it exists.",
            "- If the text makes a claim that the photos do not support, reduce the score.",
            "",
            "Assume a Unitree Go2-style robot dog:",
            "- quadruped body",
            "- strong locomotion",
            "- suitable for walking, trotting, turning, patrolling, inspecting, approaching, carrying light equipment",
            "- not suitable for impossible body motions, human-hand-like fine manipulation, unrealistic climbing, or actions that require unproven extra hardware",
            "- do not assume optional sensors, arms, autonomy, or extra modules unless the evidence clearly shows them",
            "",
            "Judge using these 4 standards, each from 0 to 25:",
            "",
            "1. Mission Fit",
            "Does this task truly suit a robotic dog, based on the setup and hardware needs of a Unitree Go2-type quadruped?",
            "",
            "2. Action Feasibility",
            "Does the shown action match what the robot dog can physically do?",
            "Judge based on posture, balance, terrain, movement, reach, payload logic, and whether the action looks realistic for a robot dog body.",
            "",
            "3. Dog Advantage",
            "Is there a clear reason this should outperform or more safely replace a real dog?",
            "Look for safety, repeatability, endurance, remote access, inspection value, or other clear reasons.",
            "",
            "4. Field Readiness",
            "Does the use it claims to serve match the real-world need?",
            "Compare:",
            "- the demo environment shown in the photos",
            "- the real environment claimed in the text",
            "Judge whether the demo environment is a believable test for that claimed real environment.",
            "",
            "Be skeptical and practical:",
            "- Do not reward pretty ideas without visible proof",
            "- Do not reward hardware claims without visible support",
            "- Do not reward actions that look unrealistic for a Go2-type body",
            "- Do not assume full autonomy from a static image",
            "- Do not assume real-world ready if the demo setting is too different from the claimed field setting",
            "",
            "Scoring guidance:",
            "- 20-25 = strongly supported",
            "- 10-19 = partially believable but missing proof",
            "- 0-9 = weak, unrealistic, or unsupported",
            "",
            "Return your answer in exactly this format:",
            "",
            "Verdict: [one short sentence]",
            "",
            "Total Score: [0-100]",
            "",
            "Mission Fit: [0-25]",
            "Action Feasibility: [0-25]",
            "Dog Advantage: [0-25]",
            "Field Readiness: [0-25]",
            "",
            "Visible Evidence:",
            "- [bullet 1]",
            "- [bullet 2]",
            "- [bullet 3]",
            "",
            "Missing Proof:",
            "- [bullet 1]",
            "- [bullet 2]",
            "- [bullet 3]",
            "",
            "Final Dog Verdict:",
            "- 85-100: Deploy Me",
            "- 70-84: Worth a Trial Run",
            "- 50-69: Leash Required",
            "- 30-49: Show Me More Proof",
            "- 0-29: Use a Real Dog Instead",
            "",
            "Now judge this submission.",
            "",
            "Project description:",
            str(payload.get("transcript") or ""),
            "",
            "Image notes:",
            "- Image 1: demo environment / mission context",
            "- Image 2: main dog action",
            "- Image 3: second action / follow-through / another angle",
            f"- Provided image count: {payload.get('screenshotCount') or 0}",
        ]
    )

    body = {
        "model": os.environ.get("MINIMAX_MODEL", "MiniMax-M2.7"),
        "max_tokens": 1000,
        "messages": [
            {"role": "user", "content": prompt},
        ],
    }

    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        os.environ.get("MINIMAX_API_URL", "https://api.minimaxi.com/anthropic/v1/messages"),
        data=data,
        headers={
            "X-Api-Key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"MiniMax judge failed: {exc.code} {detail}") from exc
    data = json.loads(response_body)
    if data.get("base_resp", {}).get("status_code") not in (None, 0):
        raise RuntimeError(f"MiniMax judge failed: {data.get('base_resp')}")
    content = data.get("content", [])
    text = "\n".join(part.get("text", "") for part in content if part.get("type") == "text")
    try:
        return extract_json(text)
    except Exception:
        return parse_minimax_verdict(text)


def judge_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = call_minimax_judge(payload)
    if not result.get("dimension_reasons"):
        evidence = result.get("evidence") or []
        questions = result.get("questions") or []
        result["dimension_reasons"] = {
            "mission_fit": evidence[0] if len(evidence) > 0 else "The model judged whether the mission fits a Unitree Go2 body and setup.",
            "action_feasibility": evidence[1] if len(evidence) > 1 else "The model judged whether the shown action is physically feasible for Go2.",
            "dog_advantage": questions[0] if len(questions) > 0 else "The model judged whether the robot dog has a clear advantage over alternatives.",
            "use_reality": questions[1] if len(questions) > 1 else "The model judged whether the shown setup matches the claimed real-world use.",
        }
    score = int(round(float(result.get("total_score") or 0)))
    result["total_score"] = max(0, min(100, score))
    result["reaction"] = reaction_for_score(result["total_score"])
    return {"provider": "dimos-minimax", "result": result}


class Go2ReactionController:
    def __init__(self, ip: str, method: str) -> None:
        self.ip = ip
        self.method = method
        self.conn: UnitreeWebRTCConnection | None = None
        self.lock = asyncio.Lock()

    async def connect(self) -> None:
        if self.conn is not None:
            return
        connection_method = getattr(WebRTCConnectionMethod, self.method)
        kwargs: dict[str, Any] = {}
        if self.method != "LocalAP":
            kwargs["ip"] = self.ip
        print(f"Connecting Go2 reaction server method={self.method} ip={self.ip}", flush=True)
        self.conn = UnitreeWebRTCConnection(connection_method, **kwargs)
        await self.conn.connect()
        await self.set_normal_mode()

    async def set_normal_mode(self) -> None:
        if self.conn is None:
            return
        response = await self.conn.datachannel.pub_sub.publish_request_new(
            RTC_TOPIC["MOTION_SWITCHER"],
            {"api_id": 1001},
        )
        current = None
        try:
            if response["data"]["header"]["status"]["code"] == 0:
                current = json.loads(response["data"]["data"]).get("name")
        except Exception:
            current = None
        if current != "normal":
            print(f"Switching motion mode to normal from {current or 'unknown'}", flush=True)
            await self.conn.datachannel.pub_sub.publish_request_new(
                RTC_TOPIC["MOTION_SWITCHER"],
                {"api_id": 1002, "parameter": {"name": "normal"}},
            )
            await asyncio.sleep(2)

    async def sport(self, command: str, parameter: dict[str, Any] | None = None) -> None:
        if self.conn is None:
            raise RuntimeError("Go2 is not connected")
        if command not in SPORT_CMD:
            available = ", ".join(sorted(SPORT_CMD))
            raise KeyError(f"SPORT_CMD does not include {command}. Available commands: {available}")
        payload: dict[str, Any] = {"api_id": SPORT_CMD[command]}
        if parameter is not None:
            payload["parameter"] = parameter
        print(f"SPORT {command} {parameter or ''}".strip(), flush=True)
        await self.conn.datachannel.pub_sub.publish_request_new(RTC_TOPIC["SPORT_MOD"], payload)

    async def react(self, reaction: str, unsafe: bool = False) -> dict[str, Any]:
        if reaction in STUNT_REACTIONS and not unsafe:
            raise ValueError(f"{reaction} is a stunt action and requires unsafe=true")
        commands = REACTIONS.get(reaction) or STUNT_REACTIONS.get(reaction)
        if commands is None:
            raise ValueError(f"Unsupported reaction: {reaction}")
        async with self.lock:
            await self.connect()
            for command in commands:
                if command == "Scan":
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.75})
                    await asyncio.sleep(1.35)
                    await self.sport("Move", {"x": 0, "y": 0, "z": -0.75})
                    await asyncio.sleep(1.35)
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.35})
                    await asyncio.sleep(0.55)
                    await self.sport("StopMove")
                elif command == "DramaticCry":
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.85})
                    await asyncio.sleep(1.0)
                    await self.sport("Move", {"x": 0, "y": 0, "z": -0.85})
                    await asyncio.sleep(1.0)
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.65})
                    await asyncio.sleep(0.7)
                    await self.sport("StopMove")
                    await asyncio.sleep(0.4)
                    await self.sport("Sit")
                    await asyncio.sleep(1.2)
                    await self.sport("StandDown")
                elif command == "ConcernedDrop":
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.55})
                    await asyncio.sleep(0.8)
                    await self.sport("Move", {"x": 0, "y": 0, "z": -0.55})
                    await asyncio.sleep(0.8)
                    await self.sport("StopMove")
                    await asyncio.sleep(0.4)
                    await self.sport("StandDown")
                elif command == "Curious":
                    await self.sport("Move", {"x": 0, "y": 0, "z": 0.55})
                    await asyncio.sleep(0.8)
                    await self.sport("Move", {"x": 0, "y": 0, "z": -0.55})
                    await asyncio.sleep(0.8)
                    await self.sport("StopMove")
                else:
                    await self.sport(command)
                await asyncio.sleep(1.0)
        return {"ok": True, "reaction": reaction, "ip": self.ip}


def make_handler(loop: asyncio.AbstractEventLoop, controller: Go2ReactionController):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, body: dict[str, Any]) -> None:
            data = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("access-control-allow-origin", "http://127.0.0.1:8787")
            self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
            self.send_header("access-control-allow-headers", "content-type")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self) -> None:
            self._send(200, {"ok": True})

        def do_GET(self) -> None:
            if self.path == "/health":
                self._send(
                    200,
                    {
                        "ok": True,
                        "ip": controller.ip,
                        "method": controller.method,
                        "judge": "dimos",
                        "minimaxConfigured": bool(os.environ.get("MINIMAX_API_KEY")),
                    },
                )
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self) -> None:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            if self.path == "/judge":
                try:
                    self._send(200, judge_payload(payload))
                except Exception as exc:
                    self._send(500, {"error": str(exc)})
                return

            if self.path != "/react":
                self._send(404, {"error": "not found"})
                return
            try:
                reaction = str(payload.get("reaction", "nod"))
                unsafe = bool(payload.get("unsafe", False))
                future = asyncio.run_coroutine_threadsafe(controller.react(reaction, unsafe=unsafe), loop)
                self._send(200, future.result(timeout=25))
            except Exception as exc:
                self._send(500, {"error": str(exc)})

        def log_message(self, fmt: str, *args: Any) -> None:
            print(fmt % args, flush=True)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ip", default=os.environ.get("ROBOT_IP", "172.20.10.13"))
    parser.add_argument("--method", default=os.environ.get("GO2_CONN_METHOD", "LocalSTA"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("GO2_REACTION_PORT", "8788")))
    args = parser.parse_args()

    loop = asyncio.new_event_loop()
    controller = Go2ReactionController(args.ip, args.method)
    thread = threading.Thread(target=loop.run_forever, daemon=True)
    thread.start()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(loop, controller))
    print(f"Go2 reaction server listening on http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    finally:
        loop.call_soon_threadsafe(loop.stop)


if __name__ == "__main__":
    main()
