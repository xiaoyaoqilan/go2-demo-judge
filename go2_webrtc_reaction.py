"""Send safe judge reactions to Unitree Go2 over unitree_webrtc_connect.

Default action is intentionally conservative. Use this script from WSL inside
the dimos virtual environment.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from unitree_webrtc_connect.constants import RTC_TOPIC, SPORT_CMD
from unitree_webrtc_connect.webrtc_driver import UnitreeWebRTCConnection, WebRTCConnectionMethod


SAFE_REACTIONS = {
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

STUNT_REACTIONS = {
    "flip": ["StopMove", "BackFlip"],
    "backflip": ["StopMove", "BackFlip"],
}


async def publish_sport(conn: UnitreeWebRTCConnection, command: str, parameter: dict | None = None) -> None:
    if command not in SPORT_CMD:
        available = ", ".join(sorted(SPORT_CMD))
        raise KeyError(f"SPORT_CMD does not include {command}. Available commands: {available}")
    payload: dict = {"api_id": SPORT_CMD[command]}
    if parameter is not None:
        payload["parameter"] = parameter
    print(f"SPORT {command} {parameter or ''}".strip())
    await conn.datachannel.pub_sub.publish_request_new(RTC_TOPIC["SPORT_MOD"], payload)


async def set_normal_mode(conn: UnitreeWebRTCConnection) -> None:
    response = await conn.datachannel.pub_sub.publish_request_new(
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
        print(f"Switching motion mode to normal from {current or 'unknown'}")
        await conn.datachannel.pub_sub.publish_request_new(
            RTC_TOPIC["MOTION_SWITCHER"],
            {"api_id": 1002, "parameter": {"name": "normal"}},
        )
        await asyncio.sleep(2)


async def do_reaction(reaction: str, ip: str, method: str) -> None:
    connection_method = getattr(WebRTCConnectionMethod, method)
    kwargs = {}
    if method != "LocalAP":
        kwargs["ip"] = ip

    print(f"Connecting to Go2 method={method} ip={ip}")
    conn = UnitreeWebRTCConnection(connection_method, **kwargs)
    await conn.connect()
    await set_normal_mode(conn)

    commands = SAFE_REACTIONS.get(reaction) or STUNT_REACTIONS[reaction]
    for command in commands:
        if command == "Scan":
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": 0.45})
            await asyncio.sleep(0.8)
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": -0.45})
            await asyncio.sleep(0.8)
            await publish_sport(conn, "StopMove")
        elif command == "DramaticCry":
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": 0.85})
            await asyncio.sleep(1.0)
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": -0.85})
            await asyncio.sleep(1.0)
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": 0.65})
            await asyncio.sleep(0.7)
            await publish_sport(conn, "StopMove")
            await asyncio.sleep(0.4)
            await publish_sport(conn, "Sit")
            await asyncio.sleep(1.2)
            await publish_sport(conn, "StandDown")
        elif command == "ConcernedDrop":
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": 0.55})
            await asyncio.sleep(0.8)
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": -0.55})
            await asyncio.sleep(0.8)
            await publish_sport(conn, "StopMove")
            await asyncio.sleep(0.4)
            await publish_sport(conn, "StandDown")
        elif command == "Curious":
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": 0.3})
            await asyncio.sleep(0.5)
            await publish_sport(conn, "Move", {"x": 0, "y": 0, "z": -0.3})
            await asyncio.sleep(0.5)
            await publish_sport(conn, "StopMove")
        else:
            await publish_sport(conn, command)
        await asyncio.sleep(1.2)

    print("Reaction complete")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reaction", choices=sorted({**SAFE_REACTIONS, **STUNT_REACTIONS}))
    parser.add_argument("--ip", default=os.environ.get("ROBOT_IP", "172.20.10.13"))
    parser.add_argument("--unsafe", action="store_true", help="Allow stunt actions such as backflip.")
    parser.add_argument(
        "--method",
        default=os.environ.get("GO2_CONN_METHOD", "LocalSTA"),
        choices=["LocalSTA", "LocalAP"],
    )
    args = parser.parse_args()
    if args.reaction in STUNT_REACTIONS and not args.unsafe:
        parser.error(f"{args.reaction} is a stunt action. Re-run with --unsafe after clearing space around the robot.")
    asyncio.run(do_reaction(args.reaction, args.ip, args.method))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
