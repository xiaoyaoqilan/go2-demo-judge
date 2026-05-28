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
                self._send(200, {"ok": True, "ip": controller.ip, "method": controller.method})
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self) -> None:
            if self.path != "/react":
                self._send(404, {"error": "not found"})
                return
            try:
                length = int(self.headers.get("content-length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
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
