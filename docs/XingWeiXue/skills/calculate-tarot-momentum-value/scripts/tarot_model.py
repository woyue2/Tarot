#!/usr/bin/env python3
"""Draw Rider–Waite cards and calculate momentum/value scores."""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from pathlib import Path
from typing import Sequence


SKILL_DIR = Path(__file__).resolve().parent.parent
SCORES_PATH = SKILL_DIR / "references" / "card-scores.csv"
DEFAULT_MARKDOWN_PATH = SKILL_DIR / "references" / "known-scores.md"


def round_half_away(value: float) -> int:
    return int(math.copysign(math.floor(abs(value) + 0.5), value))


def rank_score(arcana: str, number: int) -> float:
    if arcana == "major":
        if not 0 <= number <= 21:
            raise ValueError("Major Arcana number must be between 0 and 21.")
        return 20 * number / 21 - 10
    if arcana == "minor":
        if not 1 <= number <= 14:
            raise ValueError("Minor Arcana rank must be between 1 and 14.")
        return 20 * (number - 1) / 13 - 10
    raise ValueError("arcana must be 'major' or 'minor'.")


def card_score(semantic: float, dynamic: float, rank: float) -> int:
    return round_half_away(0.80 * semantic + 0.15 * dynamic + 0.05 * rank)


def load_cards(path: Path = SCORES_PATH) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    cards = []
    for row in rows:
        card = dict(row)
        card["number"] = int(card["number"])
        for field in ("upright_s", "upright_d", "reversed_s", "reversed_d"):
            card[field] = float(card[field])
        card["rank_score"] = rank_score(card["arcana"], card["number"])
        card["upright_final"] = card_score(card["upright_s"], card["upright_d"], card["rank_score"])
        card["reversed_final"] = card_score(card["reversed_s"], card["reversed_d"], card["rank_score"])
        cards.append(card)
    return cards


def orientation_record(card: dict, orientation: str) -> dict:
    if orientation not in {"upright", "reversed"}:
        raise ValueError("orientation must be 'upright' or 'reversed'.")
    return {
        "card_en": card["card_en"],
        "card_zh": card["card_zh"],
        "orientation": orientation,
        "semantic": card[f"{orientation}_s"],
        "dynamic": card[f"{orientation}_d"],
        "rank": round(card["rank_score"], 4),
        "score": card[f"{orientation}_final"],
        "basis": card[f"{orientation}_basis"],
    }


def calculate(values: Sequence[float]) -> dict:
    if len(values) != 5:
        raise ValueError("Exactly five values are required.")
    x1, x2, x3, x4, x5 = values
    momentum = ((x2 - x1) + 2 * (x3 - x2) + 3 * (x4 - x3) + 4 * (x5 - x4)) / 10
    value = (x5 + 0.5 * x4 + 0.25 * x3 + 0.125 * x2 + 0.0625 * x1) / 1.9375
    momentum_label = "动" if momentum > 1 else "反向动量" if momentum < -1 else "不动或不明确"
    value_label = "有价值" if value > 1 else "负价值" if value < -1 else "价值不明确"
    return {
        "values": list(values),
        "momentum": round(momentum, 4),
        "momentum_label": momentum_label,
        "value": round(value, 4),
        "value_label": value_label,
    }


def draw(seed: int | None = None) -> list[dict]:
    rng = random.Random(seed)
    cards = rng.sample(load_cards(), 5)
    results = []
    for position, card in enumerate(cards, start=1):
        orientation = rng.choice(["upright", "reversed"])
        result = orientation_record(card, orientation)
        result["position"] = position
        result["orientation_zh"] = "正位" if orientation == "upright" else "逆位"
        results.append(result)
    return results


def lookup(name: str, orientation: str) -> dict:
    normalized = name.casefold()
    matches = [
        card for card in load_cards()
        if card["card_en"].casefold() == normalized or card["card_zh"] == name
    ]
    if not matches:
        raise ValueError(f"Unknown card: {name}")
    return orientation_record(matches[0], orientation)


def validate_data() -> dict:
    cards = load_cards()
    english_names = [card["card_en"] for card in cards]
    chinese_names = [card["card_zh"] for card in cards]
    scores = [
        card[f"{orientation}_final"]
        for card in cards
        for orientation in ("upright", "reversed")
    ]
    issues = []
    if len(cards) != 78:
        issues.append(f"Expected 78 cards; found {len(cards)}.")
    if len(set(english_names)) != len(english_names):
        issues.append("Duplicate English card names found.")
    if len(set(chinese_names)) != len(chinese_names):
        issues.append("Duplicate Chinese card names found.")
    if any(score < -10 or score > 10 for score in scores):
        issues.append("A final score falls outside -10..10.")
    return {
        "valid": not issues,
        "cards": len(cards),
        "orientation_scores": len(scores),
        "upright_scores": len(cards),
        "reversed_scores": len(cards),
        "minimum_score": min(scores),
        "maximum_score": max(scores),
        "negative_scores": sum(score < 0 for score in scores),
        "neutral_scores": sum(score == 0 for score in scores),
        "positive_scores": sum(score > 0 for score in scores),
        "issues": issues,
    }


def render_markdown() -> str:
    cards = load_cards()
    sections = [
        ("Major Arcana", [card for card in cards if card["arcana"] == "major"]),
        ("Wands", [card for card in cards if "of Wands" in card["card_en"]]),
        ("Cups", [card for card in cards if "of Cups" in card["card_en"]]),
        ("Swords", [card for card in cards if "of Swords" in card["card_en"]]),
        ("Pentacles", [card for card in cards if "of Pentacles" in card["card_en"]]),
    ]
    lines = [
        "# Complete card scores",
        "",
        "This file contains all 78 Rider–Waite cards and all 156 upright/reversed scores.",
        "Final scores are generated from `card-scores.csv` with:",
        "",
        r"\[x=\operatorname{round}(0.80S+0.15D+0.05N)\]",
        "",
        "Do not edit generated final values directly. Edit the source components in `card-scores.csv`, then regenerate this file.",
        "",
    ]
    for title, section_cards in sections:
        lines.extend([
            f"## {title}",
            "",
            r"| Card | Chinese | Orientation | \(S\) | \(D\) | \(N\) | Final | Basis |",
            "|---|---|---|---:|---:|---:|---:|---|",
        ])
        for card in section_cards:
            for orientation in ("upright", "reversed"):
                record = orientation_record(card, orientation)
                lines.append(
                    f'| {record["card_en"]} | {record["card_zh"]} | {orientation} | '
                    f'{record["semantic"]:g} | {record["dynamic"]:g} | {record["rank"]:.2f} | '
                    f'{record["score"]} | {record["basis"]} |'
                )
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    draw_parser = subparsers.add_parser("draw")
    draw_parser.add_argument("--seed", type=int)

    calc_parser = subparsers.add_parser("calculate")
    calc_parser.add_argument("values", nargs=5, type=float)

    score_parser = subparsers.add_parser("score")
    score_parser.add_argument("--arcana", choices=["major", "minor"], required=True)
    score_parser.add_argument("--number", type=int, required=True)
    score_parser.add_argument("--semantic", type=float, required=True)
    score_parser.add_argument("--dynamic", type=float, required=True)

    lookup_parser = subparsers.add_parser("lookup")
    lookup_parser.add_argument("name")
    lookup_parser.add_argument("orientation", choices=["upright", "reversed"])

    subparsers.add_parser("validate-data")

    export_parser = subparsers.add_parser("export-markdown")
    export_parser.add_argument("--output", type=Path, default=DEFAULT_MARKDOWN_PATH)

    args = parser.parse_args()
    if args.command == "draw":
        result = draw(args.seed)
    elif args.command == "calculate":
        result = calculate(args.values)
    elif args.command == "score":
        rank = rank_score(args.arcana, args.number)
        result = {
            "semantic": args.semantic,
            "dynamic": args.dynamic,
            "rank": round(rank, 4),
            "score": card_score(args.semantic, args.dynamic, rank),
        }
    elif args.command == "lookup":
        result = lookup(args.name, args.orientation)
    elif args.command == "validate-data":
        result = validate_data()
    else:
        markdown = render_markdown()
        args.output.write_text(markdown, encoding="utf-8")
        result = {"output": str(args.output.resolve()), "characters": len(markdown)}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
