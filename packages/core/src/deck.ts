import type { DeckEntry, TarotCard } from "./types";
import type { RandomSource } from "./random";

export function shuffleDeck(cards: readonly TarotCard[], random: RandomSource): DeckEntry[] {
  const deck = cards.map((card) => ({
    cardId: card.id,
    orientation: random.next() < 0.5 ? "upright" : "reversed",
  }) satisfies DeckEntry);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const current = deck[index];
    const swap = deck[swapIndex];
    if (!current || !swap) throw new Error("Invalid deck index while shuffling");
    deck[index] = swap;
    deck[swapIndex] = current;
  }
  return deck;
}

/**
 * 从牌堆里无放回随机抽 `count` 个不同位置。
 *
 * 随机性来自传入的 `random`（种子 PRNG），与 `shuffleDeck` 互相独立——
 * 调用方应使用派生子种子（如 `${shuffleSeed}:positions`），既保持整次解读
 * 确定可复现，又避免位置抽取与洗牌内部流产生耦合。
 */
export function randomSelection(random: RandomSource, deckSize = 78, count = 5): number[] {
  if (count > deckSize) throw new Error("随机选取数量不能超过牌堆大小");
  const indexes = new Set<number>();
  while (indexes.size < count) {
    const index = Math.floor(random.next() * deckSize);
    if (index >= 0 && index < deckSize) indexes.add(index);
  }
  return [...indexes];
}
