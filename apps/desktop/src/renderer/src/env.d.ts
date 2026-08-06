interface PresetProvider {
  type: string;
  label: string;
  description: string;
  category: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  signupUrl?: string;
}

interface TarotSettings { providerType: string; model: string; baseUrl: string; hasApiKey: boolean }
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
    bootstrap(): Promise<{ folders: ReadingFolder[]; history: ReadingView[]; settings: TarotSettings; presetProviders: PresetProvider[] }>;
    createFolder(name: string): Promise<ReadingFolder>;
    renameFolder(input: { id: string; name: string }): Promise<ReadingFolder>;
    moveReading(input: { id: string; folderId: string | null }): Promise<ReadingView>;
    saveSettings(input: { apiKey?: string; clearApiKey?: boolean; providerType?: string; model?: string; baseUrl?: string }): Promise<TarotSettings>;
    createReading(input: { question: string; mode: "manual" | "random"; folderId?: string }): Promise<{ id: string; folderId?: string; question: string; mode: "manual" | "random"; deckSize: number }>;
    confirmReading(input: { id: string; selectedIndexes?: number[] }): Promise<ReadingView>;
    interpret(id: string): Promise<ReadingView>;
    history(): Promise<ReadingView[]>;
    listPresetProviders(): Promise<PresetProvider[]>;
    testConnection(opts?: { apiKey?: string | undefined; model?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }): Promise<{ ok: boolean; userMessage: string; statusCode?: number }>;
    fetchModels(opts?: { apiKey?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }): Promise<{ ok: boolean; models: Array<{ id: string; displayName?: string }>; userMessage: string }>;
    onInterpretProgress(callback: (data: { id: string; delta: string; reasoning: string }) => void): () => void;
  };
}
