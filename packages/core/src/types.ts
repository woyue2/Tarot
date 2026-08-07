export type Orientation = "upright" | "reversed";
export type DrawMode = "manual" | "random";

export interface FixedScore {
  semantic: number;
  dynamic: number;
  rank: number;
  final: number;
  basis: string;
}

export interface TarotVisual {
  sourceHeading: string;
  direction: string;
  posture: string;
  colors: string;
  lighting: string;
  symbols: Array<{ name: string; meaning: string }>;
  story: string;
  pitfalls: string;
}

export interface TarotCard {
  id: string;
  name: string;
  nameEn: string;
  aliases: string[];
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  rank: number;
  image: string;
  visual: TarotVisual;
  scores: Record<Orientation, FixedScore>;
}

export interface DeckEntry {
  cardId: string;
  orientation: Orientation;
}

export type ReadingStatus =
  | "question"
  | "selecting"
  | "selected"
  | "confirmed"
  | "revealing"
  | "pending_interpretation"
  | "interpreting"
  | "completed"
  | "cancelled"
  | "failed";

export interface ReadingDraft {
  id: string;
  originalQuestion: string;
  resolvedQuestion: string;
  mode: DrawMode;
  status: ReadingStatus;
  shuffleSeed: string;
  deck: DeckEntry[];
  selectedIndexes: number[];
  drawnAt?: string;
}
