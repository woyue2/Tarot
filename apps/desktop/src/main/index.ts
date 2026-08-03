import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { createSeededRandom, randomSelection, shuffleDeck, type DeckEntry, type TarotCard } from "@tarot/core";
import { buildInterpretationInput, type StoredReading } from "@tarot/runtime";
import cardsData from "../../../../resources/cards.json";
import manifest from "../../../../resources/content-manifest.json";
import methodology from "../../../../resources/methodology.json";
import { ElectronCredentialStore } from "./credentials";
import { OpenAICompatibleProvider } from "./model";
import { SqliteReadingRepository } from "./storage";

const cards = cardsData.cards as TarotCard[];
let repository: SqliteReadingRepository;
let credentials: ElectronCredentialStore;
let settings = { model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1" };

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: "#08070d",
    titleBarStyle: "hiddenInset",
    webPreferences: { preload: join(__dirname, "../preload/index.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

function publicReading(reading: StoredReading) {
  return { id: reading.id, question: reading.question, mode: reading.mode, status: reading.status, selectedIndexes: reading.selectedIndexes, revealed: reading.revealed, calculation: reading.calculation, interpretation: reading.interpretation, createdAt: reading.createdAt, updatedAt: reading.updatedAt };
}

function registerIpc(): void {
  ipcMain.handle("tarot:bootstrap", () => ({ history: repository.list().map(publicReading), settings: { ...settings, hasApiKey: Boolean(credentials.get("apiKey")) } }));
  ipcMain.handle("tarot:save-settings", (_event, input: { apiKey?: string; model?: string; baseUrl?: string }) => {
    if (input.apiKey?.trim()) credentials.set("apiKey", input.apiKey.trim());
    if (input.apiKey === "") credentials.delete("apiKey");
    if (input.model?.trim()) settings.model = input.model.trim();
    if (input.baseUrl?.trim()) settings.baseUrl = input.baseUrl.trim();
    return { ...settings, hasApiKey: Boolean(credentials.get("apiKey")) };
  });
  ipcMain.handle("tarot:create-reading", (_event, input: { question: string; mode: "manual" | "random" }) => {
    const question = input.question?.trim();
    if (!question) throw new Error("请先写下想探索的问题");
    const seed = randomBytes(24).toString("hex");
    const now = new Date().toISOString();
    const reading: StoredReading = { id: randomUUID(), question, mode: input.mode === "random" ? "random" : "manual", status: "selecting", shuffleSeed: seed, deck: shuffleDeck(cards, createSeededRandom(seed)), selectedIndexes: [], createdAt: now, updatedAt: now };
    repository.save(reading);
    return { id: reading.id, question, mode: reading.mode, deckSize: reading.deck.length };
  });
  ipcMain.handle("tarot:confirm-reading", (_event, input: { id: string; selectedIndexes?: number[] }) => {
    const reading = repository.find(input.id);
    if (!reading) throw new Error("没有找到这次解读");
    const indexes = reading.mode === "random" ? randomSelection() : (input.selectedIndexes ?? []);
    if (indexes.length !== 5 || new Set(indexes).size !== 5 || indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= 78)) throw new Error("请选择恰好五张不同的牌");
    const selected = indexes.map((index) => reading.deck[index]) as DeckEntry[];
    const interpretationInput = buildInterpretationInput({
      readingId: reading.id,
      question: reading.question,
      mode: reading.mode,
      selected,
      cards,
      metadata: { contentVersion: cardsData.contentVersion, scoreTableVersion: cardsData.scoreTableVersion, methodologyVersion: manifest.methodologyVersion, methodologyStyle: methodology.principles.join("；") },
    });
    const catalog = new Map(cards.map((card) => [card.id, card]));
    const revealed = selected.map((entry, index) => ({ ...entry, position: index + 1, positionName: interpretationInput.cards[index]!.positionName, card: catalog.get(entry.cardId) }));
    const updated: StoredReading = { ...reading, selectedIndexes: indexes, status: "pending_interpretation", revealed, calculation: interpretationInput.calculation, interpretationInput, updatedAt: new Date().toISOString() };
    repository.save(updated);
    return publicReading(updated);
  });
  ipcMain.handle("tarot:interpret", async (_event, id: string) => {
    const reading = repository.find(id);
    if (!reading?.interpretationInput) throw new Error("请先确认牌阵");
    const apiKey = credentials.get("apiKey");
    if (!apiKey) throw new Error("尚未配置模型 API Key；牌阵已保存在本地，可稍后解读");
    repository.save({ ...reading, status: "interpreting", updatedAt: new Date().toISOString() });
    try {
      const interpretation = await new OpenAICompatibleProvider({ apiKey, ...settings }).interpret(reading.interpretationInput);
      const completed = { ...reading, status: "completed", interpretation, updatedAt: new Date().toISOString() };
      repository.save(completed);
      return publicReading(completed);
    } catch (error) {
      repository.save({ ...reading, status: "failed", updatedAt: new Date().toISOString() });
      throw error;
    }
  });
  ipcMain.handle("tarot:history", () => repository.list().map(publicReading));
}

app.whenReady().then(() => {
  repository = new SqliteReadingRepository(join(app.getPath("userData"), "tarot.sqlite"));
  credentials = new ElectronCredentialStore(join(app.getPath("userData"), "credentials.json"));
  registerIpc();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
