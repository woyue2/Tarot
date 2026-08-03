interface TarotSettings { model: string; baseUrl: string; hasApiKey: boolean }
interface ReadingFolder { id: string; name: string; createdAt: string; updatedAt: string }
interface RevealedCard {
  cardId: string;
  orientation: "upright" | "reversed";
  position: number;
  positionName: string;
  card: { id: string; name: string; nameEn: string; image: string };
}
interface ReadingView {
  id: string;
  folderId?: string;
  question: string;
  mode: "manual" | "random";
  status: string;
  selectedIndexes: number[];
  revealed?: RevealedCard[];
  calculation?: { momentum: number; momentumLabel: string; value: number; valueLabel: string };
  interpretation?: {
    headline: string;
    questionReflection: string;
    cards: Array<{ cardId: string; position: number; meaning: string; connectionToQuestion: string }>;
    storyline: string;
    momentumInterpretation: string;
    valueInterpretation: string;
    actionAdvice: string[];
    reflectionQuestion: string;
    disclaimer: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Window {
  tarot: {
    bootstrap(): Promise<{ folders: ReadingFolder[]; history: ReadingView[]; settings: TarotSettings }>;
    createFolder(name: string): Promise<ReadingFolder>;
    renameFolder(input: { id: string; name: string }): Promise<ReadingFolder>;
    saveSettings(input: { apiKey?: string; clearApiKey?: boolean; model?: string; baseUrl?: string }): Promise<TarotSettings>;
    createReading(input: { question: string; mode: "manual" | "random"; folderId?: string }): Promise<{ id: string; folderId?: string; question: string; mode: "manual" | "random"; deckSize: number }>;
    confirmReading(input: { id: string; selectedIndexes?: number[] }): Promise<ReadingView>;
    interpret(id: string): Promise<ReadingView>;
    history(): Promise<ReadingView[]>;
  };
}