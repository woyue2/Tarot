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

interface R2Settings { enabled: boolean; accountId: string; endpoint: string; accessKeyId: string; bucketName: string; region: string }
interface TarotSettings { providerType: string; model: string; baseUrl: string; hasApiKey: boolean; r2?: R2Settings }
interface AppPreferences { enableStreaming: boolean; hideModelUi: boolean }
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
    platform: string;
    bootstrap(): Promise<{ folders: ReadingFolder[]; history: ReadingView[]; settings: TarotSettings; appPreferences: AppPreferences; r2Configured?: boolean; presetProviders: PresetProvider[] }>;
    createFolder(name: string): Promise<ReadingFolder>;
    renameFolder(input: { id: string; name: string }): Promise<ReadingFolder>;
    deleteFolder(id: string): Promise<{ ok: boolean }>;
    moveReading(input: { id: string; folderId: string | null }): Promise<ReadingView>;
    deleteReading(id: string): Promise<{ ok: boolean }>;
    saveSettings(input: { apiKey?: string; clearApiKey?: boolean; providerType?: string; model?: string; baseUrl?: string; r2?: { enabled?: boolean; accountId?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; region?: string } | undefined }): Promise<TarotSettings>;
    getAppPreferences(): Promise<AppPreferences>;
    setAppPreferences(value: { enableStreaming?: boolean; hideModelUi?: boolean }): Promise<AppPreferences>;
    testR2Connection(input: { accountId?: string | undefined; endpoint?: string | undefined; accessKeyId?: string | undefined; secretAccessKey: string; bucketName?: string | undefined; region?: string | undefined }): Promise<{ ok: boolean; message: string }>;
    syncNow(): Promise<{ pulled: number; pushed: number; errors: string[] }>;
    r2Status(): Promise<{ configured: boolean; enabled: boolean }>;
    createReading(input: { question: string; mode: "manual" | "random"; folderId?: string }): Promise<{ id: string; folderId?: string; question: string; mode: "manual" | "random"; deckSize: number }>;
    confirmReading(input: { id: string; selectedIndexes?: number[] }): Promise<ReadingView>;
    interpret(id: string): Promise<ReadingView>;
    history(): Promise<ReadingView[]>;
    listPresetProviders(): Promise<PresetProvider[]>;
    testConnection(opts?: { apiKey?: string | undefined; model?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }): Promise<{ ok: boolean; userMessage: string; statusCode?: number }>;
    fetchModels(opts?: { apiKey?: string | undefined; baseUrl?: string | undefined; providerType?: string | undefined }): Promise<{ ok: boolean; models: Array<{ id: string; displayName?: string }>; userMessage: string }>;
    onInterpretProgress(callback: (data: { id: string; delta: string; reasoning: string }) => void): () => void;
    onAppPreferencesChanged(callback: (data: AppPreferences) => void): () => void;
    onOpenSettings(callback: () => void): () => void;
  };
}
