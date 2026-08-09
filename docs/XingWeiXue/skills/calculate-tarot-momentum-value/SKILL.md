---
name: calculate-tarot-momentum-value
description: Draw and interpret five Rider–Waite Tarot cards with the project's momentum–value model. Use when the user asks to randomly draw five Tarot cards for a concrete question, assign upright or reversed card scores from meaning, imagery, and rank, calculate left-to-right momentum and right-to-left value, compare traditional card meanings with numeric results, test the formulas, or extend the 78-card score table.
---

# Calculate Tarot Momentum and Value

Use exactly five ordered Rider–Waite cards. Treat the method as a designed symbolic model, not an evidence-based prediction system.

## Workflow

1. State the concrete question before drawing. Preserve its object throughout scoring: career, finances, sleep, a proposed action, etc.
2. For a random draw, run:

   ```powershell
   python scripts/tarot_model.py draw
   ```

   Use the bundled Python runtime if `python` is unavailable. Never replace a random result to make the reading more coherent.
3. Read [model.md](references/model.md) when explaining the formulas.
4. Use [known-scores.md](references/known-scores.md) as the complete human-readable table of all 156 orientation scores. Use `references/card-scores.csv` as the machine-readable source of truth.
5. Look up a specific score with:

   ```powershell
   python scripts/tarot_model.py lookup "太阳" reversed
   ```

6. Retain the five final card values in their original order.
7. Run:

   ```powershell
   python scripts/tarot_model.py calculate 6 -4 5 -5 -2
   ```

8. Report:
   - the five cards and score components;
   - a short card-by-card interpretation for the stated question;
   - the momentum formula, result, and threshold label;
   - the value formula, result, and threshold label;
   - a synthesis distinguishing the value of the current path from the value of the user's entire career, finances, relationship, or life.

## Scoring constraints

- Use the same weighted formula for every upright and reversed card.
- Keep \(N\) unchanged when a card is reversed.
- Recompute reversed \(S_R\) and \(D_R\) from reversed meaning; never default to \(x_R=-x\).
- Do not let printed rank overturn canonical meaning: meaning carries 80% of the score.
- Do not improvise a score during a reading. Use the complete table.
- Do not edit generated final values in `known-scores.md`; edit `card-scores.csv` components and regenerate.
- Preserve uncomfortable or contradictory draws.
- For medical, legal, financial, or other high-stakes questions, label the result as symbolic reflection and avoid presenting it as professional advice or factual prediction.

## Interpretation rules

- Momentum measures the direction of successive score changes, not goodness.
- Value weights the rightmost, most current card most heavily.
- A high-value result with low momentum means “worthwhile but not moving.”
- A high-momentum result with negative value means “moving strongly in an unfavorable direction.”
- A negative result applies to the path framed by the question, not automatically to the whole domain.
- Mention compression loss when a card carries mixed qualities that one scalar cannot fully preserve.

## Maintaining the model

When revising scores:

1. Apply the scales in [model.md](references/model.md).
2. Edit the relevant \(S\), \(D\), and semantic basis in `references/card-scores.csv`.
3. Run `python scripts/tarot_model.py export-markdown`.
4. Run `python scripts/tarot_model.py validate-data` and representative calculations.
5. Keep the full research notes in the project-level `塔罗牌动量价值计算模型.md`; keep this skill concise and operational.
