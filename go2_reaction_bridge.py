"""Safe mock bridge for Go2 Demo Judge reactions.

This script prints the reaction that should be mapped to the real Go2 control
API. Keep the default actions safe during early demos.
"""

from __future__ import annotations

import argparse


SAFE_ACTIONS = {
    "legendary": "big celebration / lights / voice praise",
    "celebrate": "happy dance / wave",
    "approve": "short bow / happy stance",
    "respect": "double nod",
    "curious": "head tilt / small step",
    "skeptical": "slow scan left and right",
    "concerned": "lower posture / small sigh",
    "nod": "stand and nod",
    "cry": "prone / low head pose",
}

LOCKED_ACTIONS = {
    "flip": "high-risk stunt; unlock only with clear space and a safety operator",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reaction", choices=sorted([*SAFE_ACTIONS, *LOCKED_ACTIONS]))
    parser.add_argument("--unsafe", action="store_true")
    args = parser.parse_args()

    if args.reaction in LOCKED_ACTIONS and not args.unsafe:
        print(f"LOCKED: {args.reaction} -> {LOCKED_ACTIONS[args.reaction]}")
        print("Use a safe celebration action for live judging demos.")
        return

    action = SAFE_ACTIONS.get(args.reaction) or LOCKED_ACTIONS[args.reaction]
    print(f"Go2 reaction: {args.reaction}")
    print(f"Mapped action: {action}")
    print("TODO: connect this to dimos / Unitree action API after field testing.")


if __name__ == "__main__":
    main()
