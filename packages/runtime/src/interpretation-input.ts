import {
  FORMULA_VERSION,
  aggregatePatterns,
  calculateMomentumValue,
  getSpreadById,
  interpretationInputSchema,
  type DeckEntry,
  type TarotCard,
  type TarotInterpretationInput,
} from "@tarot/core";

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
  spreadId?: string;
  scoring?: boolean;
  energyFlow?: boolean;
  selected: readonly DeckEntry[];
  cards: readonly TarotCard[];
  metadata: ContentMetadata;
}): TarotInterpretationInput {
  const spreadId = options.spreadId ?? "five_card_timeline_v1";
  const scoring = options.scoring ?? true;
  const energyFlow = options.energyFlow ?? false;
  const spread = getSpreadById(spreadId);
  if (!spread) throw new Error(`Unknown spread: ${spreadId}`);
  if (options.selected.length !== spread.positions.length) throw new RangeError(`${spread.name} requires exactly ${spread.positions.length} cards`);
  if (scoring && !spread.supportsScoring) throw new Error(`${spread.name} does not support scoring`);
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
      positionName: spread.positions[index]!.name,
      visualDescription: visualDescription(card),
      symbols: card.visual.symbols.map((symbol) => `${symbol.name}：${symbol.meaning}`),
      direction: card.visual.direction,
      score: { ...score, scoreTableVersion: options.metadata.scoreTableVersion },
    };
  });
  const selectedTarotCards = selectedCards.map((selectedCard) => catalog.get(selectedCard.id)!);
  const calculation = scoring ? calculateMomentumValue(selectedCards.map((card) => card.score.final)) : undefined;
  return interpretationInputSchema.parse({
    readingId: options.readingId,
    contentVersion: options.metadata.contentVersion,
    question: options.question,
    spread: { id: spread.id, name: spread.name, positions: [...spread.positions], supportsScoring: spread.supportsScoring },
    scoring,
    energyFlow,
    draw: { mode: options.mode, confirmed: true },
    cards: selectedCards,
    calculation: calculation && {
      formulaVersion: FORMULA_VERSION,
      momentum: calculation.momentum,
      momentumLabel: calculation.momentumLabel,
      value: calculation.value,
      valueLabel: calculation.valueLabel,
    },
    patterns: energyFlow ? aggregatePatterns(selectedTarotCards) : undefined,
    methodology: { version: options.metadata.methodologyVersion, style: options.metadata.methodologyStyle },
    promptVersion: "tarot-reading-v1",
    outputLanguage: "zh-CN",
  });
}
