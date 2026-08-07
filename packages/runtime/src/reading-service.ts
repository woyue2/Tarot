import {
  createSeededRandom,
  randomSelection,
  shuffleDeck,
  type DeckEntry,
  type Orientation,
  type TarotCard,
  type TarotInterpretation,
} from "@tarot/core";
import { buildInterpretationInput } from "./interpretation-input";
import type {
  FolderRepository,
  ModelProvider,
  ReadingFolder,
  ReadingRepository,
  StoredReading,
} from "./ports";

/**
 * 平台无关的解读编排服务。
 *
 * 这是桌面端 `apps/desktop/src/main/index.ts` 里 IPC handler 内联业务逻辑的
 * 抽取版本：把「建牌 / 选牌 / 洗牌 / 确认揭牌 / 调用模型解读 / 历史与分组」
 * 统一收敛到 runtime 层，让桌面端与手机端复用同一份状态流转与契约。
 *
 * 依赖通过端口（ports）注入：
 * - {@link ReadingRepository} + {@link FolderRepository}：持久化（桌面用 SQLite，手机用 localStorage / 未来 SQLite）
 * - {@link ModelProvider}：模型解读（在 interpret 时按调用方当前设置注入）
 * - {@link RuntimeEnv}：uuid / 随机种子 / 时间（隔离 node:crypto，浏览器用 WebCrypto）
 * - {@link ContentBundle}：牌组与内容版本（复用 resources/*.json）
 */

/** 内容资源包：牌组 + 版本号 + 方法论风格，来自 resources/*.json。 */
export interface ContentBundle {
  cards: TarotCard[];
  contentVersion: string;
  scoreTableVersion: string;
  methodologyVersion: string;
  methodologyStyle: string;
}

/** 运行时环境：把平台相关的 id / 随机 / 时间隔离在端口之后。 */
export interface RuntimeEnv {
  /** 生成唯一 id（桌面 randomUUID，浏览器 crypto.randomUUID）。 */
  uuid(): string;
  /** 生成洗牌种子（十六进制字符串，桌面 randomBytes，浏览器 getRandomValues）。 */
  seed(): string;
  /** 当前时间的 ISO 字符串。 */
  now(): string;
}

/** 揭晓后的单张牌（含定位与完整牌面数据，供 UI 直接渲染）。 */
export interface RevealedCard {
  cardId: string;
  orientation: Orientation;
  position: number;
  positionName: string;
  card: TarotCard;
}

/** 动量 / 价值计算结果（对外暴露的形状）。 */
export interface ReadingCalculation {
  formulaVersion: string;
  momentum: number;
  momentumLabel: string;
  value: number;
  valueLabel: string;
}

/** 对 UI 暴露的解读视图（剥离了内部 deck / 种子 / interpretationInput 等敏感或冗余字段）。 */
export interface PublicReading {
  id: string;
  folderId?: string | undefined;
  question: string;
  mode: "manual" | "random";
  status: string;
  selectedIndexes: number[];
  revealed?: RevealedCard[] | undefined;
  calculation?: ReadingCalculation | undefined;
  interpretation?: TarotInterpretation | undefined;
  drawnAt?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** interpret() 的可选项：是否流式、以及流式进度回调。 */
export interface InterpretOptions {
  stream?: boolean;
  onProgress?: (delta: string, reasoning: string) => void;
}

const DECK_SIZE = 78;

export class ReadingService {
  constructor(
    private readonly repo: ReadingRepository & FolderRepository,
    private readonly content: ContentBundle,
    private readonly env: RuntimeEnv,
  ) {}

  // ---- 解读生命周期 ----

  /** 新建一次解读：洗牌并落库，返回 deckSize 供 UI 渲染牌列。 */
  createReading(input: { question: string; mode: "manual" | "random"; folderId?: string | undefined }): {
    id: string;
    folderId?: string | undefined;
    question: string;
    mode: "manual" | "random";
    deckSize: number;
  } {
    const question = input.question?.trim();
    if (!question) throw new Error("请先写下想探索的问题");
    if (input.folderId && !this.repo.findFolder(input.folderId)) throw new Error("没有找到所选 Folder");
    const seed = this.env.seed();
    const now = this.env.now();
    const mode: "manual" | "random" = input.mode === "random" ? "random" : "manual";
    const reading: StoredReading = {
      id: this.env.uuid(),
      ...(input.folderId ? { folderId: input.folderId } : {}),
      question,
      mode,
      status: "selecting",
      shuffleSeed: seed,
      deck: shuffleDeck(this.content.cards, createSeededRandom(seed)),
      selectedIndexes: [],
      createdAt: now,
      updatedAt: now,
    };
    this.repo.save(reading);
    return { id: reading.id, folderId: reading.folderId, question, mode, deckSize: reading.deck.length };
  }

  /** 保存部分选牌（草稿恢复用），仅在 selecting 阶段允许。 */
  updateSelection(input: { id: string; selectedIndexes: number[] }): { ok: true } {
    const reading = this.repo.find(input.id);
    if (!reading) throw new Error("没有找到这次解读");
    if (reading.status !== "selecting") throw new Error("确认后的牌阵不能修改选择");
    const indexes = Array.isArray(input.selectedIndexes) ? input.selectedIndexes : [];
    if (indexes.length > 5) throw new Error("最多选择五张牌");
    if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= DECK_SIZE)) {
      throw new Error("无效的牌索引");
    }
    this.repo.save({ ...reading, selectedIndexes: indexes, updatedAt: this.env.now() });
    return { ok: true };
  }

  /** 重新洗牌：换新种子与牌堆并清空已选，只能在 selecting 阶段。 */
  reshuffle(input: { id: string }): { id: string; deckSize: number } {
    const reading = this.repo.find(input.id);
    if (!reading) throw new Error("没有找到这次解读");
    if (reading.status !== "selecting") throw new Error("确认后的牌阵不能重新洗牌");
    const seed = this.env.seed();
    const updated: StoredReading = {
      ...reading,
      shuffleSeed: seed,
      deck: shuffleDeck(this.content.cards, createSeededRandom(seed)),
      selectedIndexes: [],
      status: "selecting",
      updatedAt: this.env.now(),
    };
    this.repo.save(updated);
    return { id: reading.id, deckSize: updated.deck.length };
  }

  /** 确认牌阵：校验五张、揭晓牌面、计算动量/价值、构建模型输入契约并落库。 */
  confirmReading(input: { id: string; selectedIndexes?: number[] | undefined }): PublicReading {
    const reading = this.repo.find(input.id);
    if (!reading) throw new Error("没有找到这次解读");
    const indexes = reading.mode === "random" ? randomSelection() : (input.selectedIndexes ?? []);
    if (
      indexes.length !== 5 ||
      new Set(indexes).size !== 5 ||
      indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= DECK_SIZE)
    ) {
      throw new Error("请选择恰好五张不同的牌");
    }
    const deck = reading.deck as DeckEntry[];
    const selected = indexes.map((index) => {
      const entry = deck[index];
      if (!entry) throw new Error("牌堆索引无效");
      return entry;
    });
    const interpretationInput = buildInterpretationInput({
      readingId: reading.id,
      question: reading.question,
      mode: reading.mode,
      selected,
      cards: this.content.cards,
      metadata: {
        contentVersion: this.content.contentVersion,
        scoreTableVersion: this.content.scoreTableVersion,
        methodologyVersion: this.content.methodologyVersion,
        methodologyStyle: this.content.methodologyStyle,
      },
    });
    const catalog = new Map(this.content.cards.map((card) => [card.id, card]));
    const revealed: RevealedCard[] = selected.map((entry, index) => {
      const card = catalog.get(entry.cardId);
      if (!card) throw new Error(`未知牌面：${entry.cardId}`);
      return {
        cardId: entry.cardId,
        orientation: entry.orientation,
        position: index + 1,
        positionName: interpretationInput.cards[index]!.positionName,
        card,
      };
    });
    const now = this.env.now();
    const updated: StoredReading = {
      ...reading,
      selectedIndexes: indexes,
      status: "pending_interpretation",
      revealed,
      calculation: interpretationInput.calculation,
      interpretationInput,
      drawnAt: now,
      updatedAt: now,
    };
    this.repo.save(updated);
    return this.toPublic(updated);
  }

  /** 调用模型解读：优先流式（若提供回调），失败回退非流式；异常时标记 failed。 */
  async interpret(id: string, provider: ModelProvider, options?: InterpretOptions): Promise<PublicReading> {
    const reading = this.repo.find(id);
    if (!reading?.interpretationInput) throw new Error("请先确认牌阵");
    this.repo.save({ ...reading, status: "interpreting", updatedAt: this.env.now() });
    try {
      const interpretation =
        options?.stream && options.onProgress
          ? await provider.interpretStream(reading.interpretationInput, options.onProgress)
          : await provider.interpret(reading.interpretationInput);
      const completed: StoredReading = { ...reading, status: "completed", interpretation, updatedAt: this.env.now() };
      this.repo.save(completed);
      return this.toPublic(completed);
    } catch (error) {
      try {
        const interpretation = await provider.interpret(reading.interpretationInput);
        const completed: StoredReading = { ...reading, status: "completed", interpretation, updatedAt: this.env.now() };
        this.repo.save(completed);
        return this.toPublic(completed);
      } catch (fallbackError) {
        this.repo.save({ ...reading, status: "failed", updatedAt: this.env.now() });
        throw fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
      }
    }
  }

  // ---- 查询 ----

  history(limit?: number): PublicReading[] {
    return this.repo.list(limit).map((reading) => this.toPublic(reading));
  }

  find(id: string): PublicReading | undefined {
    const reading = this.repo.find(id);
    return reading ? this.toPublic(reading) : undefined;
  }

  // ---- 分组 ----

  listFolders(): ReadingFolder[] {
    return this.repo.listFolders();
  }

  createFolder(rawName: string): ReadingFolder {
    const name = rawName?.trim();
    if (!name || name.length > 60) throw new Error("Folder 名称需为 1–60 个字符");
    const now = this.env.now();
    const folder: ReadingFolder = { id: this.env.uuid(), name, createdAt: now, updatedAt: now };
    this.repo.saveFolder(folder);
    return folder;
  }

  renameFolder(id: string, rawName: string): ReadingFolder {
    const name = rawName?.trim();
    if (!name || name.length > 60) throw new Error("Folder 名称需为 1–60 个字符");
    const folder = this.repo.renameFolder(id, name);
    if (!folder) throw new Error("没有找到这个 Folder");
    return folder;
  }

  deleteFolder(id: string): { ok: true } {
    if (!this.repo.deleteFolder(id)) throw new Error("删除分组失败");
    return { ok: true };
  }

  moveReading(id: string, folderId: string | null): PublicReading {
    const reading = this.repo.find(id);
    if (!reading) throw new Error("没有找到这次解读");
    if (folderId && !this.repo.findFolder(folderId)) throw new Error("没有找到目标分组");
    const updated: StoredReading = { ...reading, folderId: folderId ?? undefined };
    this.repo.save(updated);
    return this.toPublic(updated);
  }

  updateNotes(id: string, rawNotes: string): PublicReading {
    const reading = this.repo.find(id);
    if (!reading) throw new Error("没有找到这次解读");
    const notes = rawNotes.trim();
    const updated: StoredReading = {
      ...reading,
      notes: notes.length > 0 ? notes : undefined,
      updatedAt: this.env.now(),
    };
    this.repo.save(updated);
    return this.toPublic(updated);
  }

  deleteReading(id: string): { ok: true } {
    if (!this.repo.deleteReading(id)) throw new Error("删除解读记录失败");
    return { ok: true };
  }

  // ---- 内部 ----

  private toPublic(reading: StoredReading): PublicReading {
    return {
      id: reading.id,
      folderId: reading.folderId,
      question: reading.question,
      mode: reading.mode,
      status: reading.status,
      selectedIndexes: reading.selectedIndexes,
      revealed: reading.revealed as RevealedCard[] | undefined,
      calculation: reading.calculation as ReadingCalculation | undefined,
      interpretation: reading.interpretation,
      drawnAt: reading.drawnAt,
      notes: reading.notes,
      createdAt: reading.createdAt,
      updatedAt: reading.updatedAt,
    };
  }
}
