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

export function randomSelection(): number[] {
  return [0, 1, 2, 3, 4];
}
