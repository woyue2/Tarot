import {
  FORMULA_VERSION,
  calculateMomentumValue,
  interpretationInputSchema,
  type DeckEntry,
  type TarotCard,
  type TarotInterpretationInput,
} from "@tarot/core";

export const FIVE_CARD_POSITIONS = ["较远背景", "早期状态", "中间状态", "近期状态", "当前状态"] as const;

interface ContentMetadata {
  contentVersion: string;
  scoreTableVersion: string;
  methodologyVersion: string;
  methodologyStyle: string;
}

function visualDescription(card: TarotCard): string {
  return [card.visual.direction, card.visual.posture, card.visual.colors, card.visual.lighting, card.visual.story]
    .filter(Boolean)
    .join(" ");
}

export function buildInterpretationInput(options: {
  readingId: string;
  question: string;
  mode: "manual" | "random";
  selected: readonly DeckEntry[];
  cards: readonly TarotCard[];
  metadata: ContentMetadata;
}): TarotInterpretationInput {
  if (options.selected.length !== 5) throw new RangeError("Exactly five confirmed cards are required");
  const catalog = new Map(options.cards.map((card) => [card.id, card]));
  const selectedCards = options.selected.map((entry, index) => {
    const card = catalog.get(entry.cardId);
    if (!card) throw new Error(`Unknown card: ${entry.cardId}`);
    const score = card.scores[entry.orientation];
    return {
      id: card.id,
      name: card.name,
      orientation: entry.orientation,
      position: index + 1,
      positionName: FIVE_CARD_POSITIONS[index]!,
      visualDescription: visualDescription(card),
      symbols: card.visual.symbols.map((symbol) => `${symbol.name}：${symbol.meaning}`),
      direction: card.visual.direction,
      score: { ...score, scoreTableVersion: options.metadata.scoreTableVersion },
    };
  });
  const calculation = calculateMomentumValue(selectedCards.map((card) => card.score.final));
  return interpretationInputSchema.parse({
    readingId: options.readingId,
    contentVersion: options.metadata.contentVersion,
    question: options.question,
    spread: { id: "five_card_timeline_v1", name: "五张时间流", positions: FIVE_CARD_POSITIONS },
    draw: { mode: options.mode, confirmed: true },
    cards: selectedCards,
    calculation: {
      formulaVersion: FORMULA_VERSION,
      momentum: calculation.momentum,
      momentumLabel: calculation.momentumLabel,
      value: calculation.value,
      valueLabel: calculation.valueLabel,
    },
    methodology: { version: options.metadata.methodologyVersion, style: options.metadata.methodologyStyle },
    promptVersion: "tarot-reading-v1",
    outputLanguage: "zh-CN",
  });
}
