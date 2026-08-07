import { useEffect, useMemo, useRef, useState } from "react";
import {
  readingService,
  repository,
  createR2Sync,
  testR2Connection,
} from "./runtime/service";
import {
  loadSettings,
  saveSettings,
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  defaultSettings,
  loadR2Settings,
  saveR2Settings,
  getSecretAccessKey,
  setSecretAccessKey,
  clearSecretAccessKey,
  getSyncToken,
  setSyncToken,
  clearSyncToken,
  isR2Configured,
  defaultR2Settings,
  type MobileSettings,
  type R2Settings,
  type R2Mode,
} from "./runtime/credentials";
import { R2Client, WorkerR2Client, resolveR2Endpoint } from "./runtime/r2-client";
import { MobileR2SyncService } from "./runtime/r2-sync";
import {
  createProvider,
  testConnection,
  MOBILE_PRESETS,
} from "./runtime/model-provider";
import { cardBack } from "./runtime/content";
import type {
  PublicReading,
  RevealedCard,
  ReadingCalculation,
  ReadingFolder,
} from "@tarot/runtime";
import {
  StargateMark,
  CompassIcon,
  HistoryIcon,
  GearIcon,
  HandPickIcon,
  DiceIcon,
} from "./icons";

const DECK_SIZE = 78;
const cardBackSrc = `/${cardBack}`;

type View = "home" | "select" | "result" | "history" | "settings";

interface ToastState {
  msg: string;
  onAction?: () => void;
  actionLabel?: string;
}

function imageOf(path: string): string {
  return `/${path}`;
}

export function App() {
  const [view, setView] = useState<View>("home");
  const [questionText, setQuestionText] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<ReadingFolder[]>([]);

  // 选牌草稿（仅 manual 模式需要）
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<"manual" | "random">("manual");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  // 结果视图
  const [currentReading, setCurrentReading] = useState<PublicReading | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");

  const [historyList, setHistoryList] = useState<PublicReading[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    (document.documentElement.dataset.theme as "light" | "dark") ?? "light",
  );

  const refreshFolders = () => setFolders(readingService.listFolders());
  const refreshHistory = () => setHistoryList(readingService.history());

  useEffect(() => {
    refreshFolders();
    refreshHistory();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tarot.mobile.theme", next);
  }

  function notify(msg: string, onAction?: () => void, actionLabel?: string) {
    const next: ToastState = { msg };
    if (onAction) next.onAction = onAction;
    if (actionLabel) next.actionLabel = actionLabel;
    setToast(next);
  }

  // ---- R2 云同步（启用时在每个写操作后自动推送） ----

  async function pushAfterWrite(opts: { readingId?: string; folderId?: string }): Promise<void> {
    if (!loadR2Settings().enabled) return;
    const sync = createR2Sync();
    if (!sync) return;
    try {
      if (opts.readingId) {
        const reading = repository.find(opts.readingId);
        if (reading) await sync.pushReading(reading);
      }
      if (opts.folderId) {
        const folder = repository.findFolder(opts.folderId);
        if (folder) await sync.pushFolder(folder);
      }
    } catch (error) {
      notify("R2 同步失败：" + (error instanceof Error ? error.message : "未知错误"));
    }
  }

  async function deleteFromR2(opts: { readingId?: string; folderId?: string }): Promise<void> {
    if (!loadR2Settings().enabled) return;
    const sync = createR2Sync();
    if (!sync) return;
    try {
      if (opts.readingId) await sync.deleteReading(opts.readingId);
      if (opts.folderId) await sync.deleteFolder(opts.folderId);
    } catch (error) {
      notify("R2 删除同步失败：" + (error instanceof Error ? error.message : "未知错误"));
    }
  }

  // ---- 解读流程 ----

  function startReading(mode: "manual" | "random") {
    const question = questionText.trim();
    if (!question) {
      notify("请先写下想探索的问题");
      return;
    }
    try {
      const created = readingService.createReading({
        question,
        mode,
        ...(activeFolderId ? { folderId: activeFolderId } : {}),
      });
      if (mode === "random") {
        const confirmed = readingService.confirmReading({ id: created.id });
        setCurrentReading(confirmed);
        refreshHistory();
        setView("result");
        void pushAfterWrite({ readingId: confirmed.id });
      } else {
        setDraftId(created.id);
        setDraftMode("manual");
        setDraftQuestion(question);
        setSelectedIndexes([]);
        setView("select");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "新建解读失败");
    }
  }

  function addCard(index: number) {
    setSelectedIndexes((prev) => {
      if (prev.includes(index)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, index];
    });
  }

  function removeCard(index: number) {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : prev,
    );
  }

  function toggleSelect(index: number) {
    if (selectedIndexes.includes(index)) {
      removeCard(index);
      return;
    }
    if (selectedIndexes.length >= 5) {
      notify("最多选择五张牌");
      return;
    }
    addCard(index);
  }

  function reshuffleDraft() {
    if (!draftId) return;
    try {
      readingService.reshuffle({ id: draftId });
      setSelectedIndexes([]);
      notify("已重新洗牌");
    } catch (error) {
      notify(error instanceof Error ? error.message : "洗牌失败");
    }
  }

  function confirmManual() {
    if (!draftId) return;
    if (selectedIndexes.length !== 5) {
      notify("请选择恰好五张牌");
      return;
    }
    try {
      const confirmed = readingService.confirmReading({ id: draftId, selectedIndexes });
      setCurrentReading(confirmed);
      refreshHistory();
      setView("result");
      void pushAfterWrite({ readingId: confirmed.id });
    } catch (error) {
      notify(error instanceof Error ? error.message : "确认牌阵失败");
    }
  }

  function redrawRandom() {
    if (!currentReading) return;
    try {
      const created = readingService.createReading({
        question: currentReading.question,
        mode: "random",
        ...(currentReading.folderId ? { folderId: currentReading.folderId } : {}),
      });
      const confirmed = readingService.confirmReading({ id: created.id });
      setCurrentReading(confirmed);
      refreshHistory();
      void pushAfterWrite({ readingId: confirmed.id });
    } catch (error) {
      notify(error instanceof Error ? error.message : "重新抽取失败");
    }
  }

  async function runInterpret(reading: PublicReading) {
    const apiKey = getApiKey();
    if (!apiKey) {
      notify("请先在「设置」里配置 API Token", () => setView("settings"), "去设置");
      return;
    }
    const settings = loadSettings();
    const provider = createProvider(settings, apiKey);
    setStreaming(true);
    setStreamText("");
    try {
      const result = await readingService.interpret(reading.id, provider, {
        stream: settings.streaming,
        onProgress: (delta) => {
          if (delta) setStreamText((prev) => prev + delta);
        },
      });
      setCurrentReading(result);
      refreshHistory();
      void pushAfterWrite({ readingId: result.id });
    } catch (error) {
      notify(error instanceof Error ? error.message : "解读失败，请检查连接后重试");
      const refreshed = readingService.find(reading.id);
      if (refreshed) setCurrentReading(refreshed);
    } finally {
      setStreaming(false);
    }
  }

  function openReading(id: string) {
    const reading = readingService.find(id);
    if (!reading) {
      notify("没有找到这条记录");
      return;
    }
    if (reading.status === "selecting") {
      setDraftId(reading.id);
      setDraftMode(reading.mode);
      setDraftQuestion(reading.question);
      setSelectedIndexes(reading.selectedIndexes ?? []);
      setView("select");
      return;
    }
    setCurrentReading(reading);
    setView("result");
  }

  function deleteReading(id: string) {
    try {
      readingService.deleteReading(id);
      refreshHistory();
      void deleteFromR2({ readingId: id });
      if (currentReading?.id === id) {
        setCurrentReading(null);
        setView("home");
      }
      notify("已删除记录");
    } catch (error) {
      notify(error instanceof Error ? error.message : "删除失败");
    }
  }

  function exportData() {
    try {
      const readings = readingService.history(1000);
      const folders = readingService.listFolders();
      const payload = {
        app: "@tarot/mobile",
        exportedAt: new Date().toISOString(),
        version: 1,
        note: "导出不含任何 API Key 或同步令牌",
        folders,
        readings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tarot-mobile-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify("已导出记录（不含任何密钥）");
    } catch (error) {
      notify(error instanceof Error ? error.message : "导出失败");
    }
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? null;

  // ---- 渲染 ----

  const showBottomNav = view === "home" || view === "history" || view === "settings";

  return (
    <div className="app">
      <header className="app-header">
        {view === "select" || view === "result" ? (
          <button
            className="header-back"
            onClick={() => {
              setCurrentReading(null);
              setStreamText("");
              setView("home");
            }}
          >
            ← 返回
          </button>
        ) : (
          <div className="brand">
            <StargateMark />
            <div>
              <b>星径 · 塔罗</b>
              <small>五张时间流 · 移动端</small>
            </div>
          </div>
        )}
        {view === "result" && currentReading ? (
          <span className="selection-status" style={{ margin: 0 }}>
            {currentReading.mode === "random" ? "随机" : "自选"} · {currentReading.status === "completed" ? "已完成" : "待解读"}
          </span>
        ) : null}
      </header>

      <main className="app-main">
        {view === "home" && (
          <HomeView
            questionText={questionText}
            onQuestion={setQuestionText}
            activeFolder={activeFolder}
            onOpenFolder={() => setFolderSheetOpen(true)}
            onStart={startReading}
          />
        )}

        {view === "select" && (
          <SelectView
            deckSize={DECK_SIZE}
            cardBackSrc={cardBackSrc}
            selectedIndexes={selectedIndexes}
            onToggle={toggleSelect}
            onAdd={addCard}
            onRemove={removeCard}
            onReshuffle={reshuffleDraft}
            onClear={() => setSelectedIndexes([])}
            onConfirm={confirmManual}
          />
        )}

        {view === "result" && currentReading && (
          <ResultView
            reading={currentReading}
            streaming={streaming}
            streamText={streamText}
            onInterpret={() => runInterpret(currentReading)}
            {...(draftMode === "random" ? { onRedraw: redrawRandom } : {})}
          />
        )}

        {view === "history" && (
          <HistoryView
            items={historyList}
            onOpen={openReading}
            onDelete={deleteReading}
            onClearHistory={() => {
              if (historyList.length === 0) return;
              historyList.forEach((item) => readingService.deleteReading(item.id));
              refreshHistory();
              notify("已清空记录");
            }}
            onExport={exportData}
          />
        )}

        {view === "settings" && (
          <SettingsView
            initialSettings={loadSettings()}
            hasKey={hasApiKey()}
            theme={theme}
            onToggleTheme={toggleTheme}
            onChanged={() => {
              refreshFolders();
              refreshHistory();
            }}
            onNotify={(msg) => notify(msg)}
          />
        )}
      </main>

      {showBottomNav && (
        <nav className="bottom-nav">
          <button data-active={view === "home"} onClick={() => setView("home")}>
            <CompassIcon />
            指引
          </button>
          <button data-active={view === "history"} onClick={() => { refreshHistory(); setView("history"); }}>
            <HistoryIcon />
            记录
          </button>
          <button data-active={view === "settings"} onClick={() => setView("settings")}>
            <GearIcon />
            设置
          </button>
        </nav>
      )}

      {folderSheetOpen && (
        <FolderSheet
          folders={folders}
          activeFolderId={activeFolderId}
          onClose={() => setFolderSheetOpen(false)}
          onPick={(id) => {
            setActiveFolderId(id);
            setFolderSheetOpen(false);
          }}
          onCreate={(name) => {
            try {
              const folder = readingService.createFolder(name);
              setActiveFolderId(folder.id);
              refreshFolders();
              void pushAfterWrite({ folderId: folder.id });
            } catch (error) {
              notify(error instanceof Error ? error.message : "创建分组失败");
            }
          }}
          onRename={(id, name) => {
            try {
              readingService.renameFolder(id, name);
              refreshFolders();
              void pushAfterWrite({ folderId: id });
            } catch (error) {
              notify(error instanceof Error ? error.message : "重命名失败");
            }
          }}
          onDelete={(id) => {
            try {
              if (activeFolderId === id) setActiveFolderId(null);
              readingService.deleteFolder(id);
              refreshFolders();
              void deleteFromR2({ folderId: id });
            } catch (error) {
              notify(error instanceof Error ? error.message : "删除分组失败");
            }
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel ?? "✓"}
            </button>
          )}
          {!toast.onAction && (
            <button onClick={() => setToast(null)}>×</button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Home =====

function HomeView(props: {
  questionText: string;
  onQuestion: (v: string) => void;
  activeFolder: ReadingFolder | null;
  onOpenFolder: () => void;
  onStart: (mode: "manual" | "random") => void;
}) {
  return (
    <section className="home">
      <div className="hero-orbit">
        <StargateMark />
      </div>
      <p className="eyebrow">五张时间流</p>
      <h1 className="view-title">此刻，你想看清什么？</h1>
      <p className="lead">
        写下你正探索的问题。星径会为你洗出一组牌，沿着「远处 → 现在」的顺序，陪你读出其中的脉络。
      </p>

      {props.activeFolder && (
        <button className="active-folder-chip" onClick={props.onOpenFolder}>
          <StargateMark />
          {props.activeFolder.name}
        </button>
      )}

      <div className="astryx-surface question-panel">
        <label htmlFor="q">你的问题</label>
        <textarea
          id="q"
          rows={3}
          placeholder="例如：这段关系接下来会往哪走？"
          value={props.questionText}
          onChange={(e) => props.onQuestion(e.target.value)}
        />
        <div className="question-footer">
          <span>问题越具体，脉络越清晰</span>
          <span>{props.questionText.length}/200</span>
        </div>
      </div>

      <div className="mode-actions">
        <button className="mode-card primary" onClick={() => props.onStart("manual")}>
          <span className="mode-icon">
            <HandPickIcon />
          </span>
          <b>手写选择</b>
          <span className="sub">亲手从牌阵中选出五张，更有参与感</span>
        </button>
        <button className="mode-card" onClick={() => props.onStart("random")}>
          <span className="mode-icon">
            <DiceIcon />
          </span>
          <b>随缘抽取</b>
          <span className="sub">交给随机，让牌自己找上你</span>
        </button>
      </div>

      {!props.activeFolder && (
        <button className="btn ghost block" style={{ marginTop: 14 }} onClick={props.onOpenFolder}>
          选择 / 新建分组
        </button>
      )}
    </section>
  );
}

// ===== 选牌 =====

function SelectView(props: {
  deckSize: number;
  cardBackSrc: string;
  selectedIndexes: number[];
  onToggle: (index: number) => void;
  onAdd: (index: number) => void;
  onRemove: (index: number) => void;
  onReshuffle: () => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const pips = Array.from({ length: 5 }, (_, i) => {
    const idx = props.selectedIndexes[i];
    return (
      <i key={i} className={typeof idx === "number" ? "filled" : ""}>
        {typeof idx === "number" ? idx + 1 : i + 1}
      </i>
    );
  });

  // ---- 拖动选牌：Pointer Events 统一鼠标/触摸/触控笔 ----
  // 触摸/触控笔不捕获指针（保留原生横向滚动）；鼠标捕获指针（拖动可靠涂选）。
  // 指针下的牌用 elementFromPoint 取（img/.order 已设 pointer-events:none）。
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<{
    active: boolean;
    moved: boolean;
    mode: "add" | "remove";
    start: number;
    visited: Set<number>;
    id: number;
  }>({ active: false, moved: false, mode: "add", start: -1, visited: new Set(), id: -1 });
  const suppressClick = useRef(false);

  function cardUnder(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const card = el?.closest("[data-index]") as HTMLElement | null;
    if (!card) return null;
    const n = Number(card.dataset.index);
    return Number.isInteger(n) ? n : null;
  }

  function applyAt(index: number) {
    const g = gesture.current;
    if (index < 0 || index >= props.deckSize) return;
    if (g.visited.has(index)) return;
    g.visited.add(index);
    if (g.mode === "add") props.onAdd(index);
    else props.onRemove(index);
  }

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (gesture.current.active) return; // 忽略第二根手指
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const idx = Number((e.currentTarget as HTMLElement).dataset.index);
    const selected = props.selectedIndexes.includes(idx);
    gesture.current = {
      active: true,
      moved: false,
      mode: selected ? "remove" : "add",
      start: idx,
      visited: new Set(),
      id: e.pointerId,
    };
    // 鼠标捕获指针，触摸/触控笔交给原生横向滚动
    if (e.pointerType === "mouse") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  }

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g.active || e.pointerId !== g.id) return;
    g.moved = true;
    const idx = cardUnder(e.clientX, e.clientY);
    if (idx !== null) applyAt(idx);
    // 鼠标拖动到边缘时手动滚动牌带
    const sc = scrollerRef.current;
    if (sc && e.pointerType === "mouse") {
      const r = sc.getBoundingClientRect();
      const EDGE = 56;
      if (e.clientX < r.left + EDGE) sc.scrollLeft -= 16;
      else if (e.clientX > r.right - EDGE) sc.scrollLeft += 16;
    }
  }

  function endGesture(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g.active) return;
    if (!g.moved && g.start >= 0) {
      // 未移动 = 点按：交给 onToggle（含键盘/单击语义）
      suppressClick.current = true;
      props.onToggle(g.start);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    gesture.current = { active: false, moved: false, mode: "add", start: -1, visited: new Set(), id: -1 };
  }

  function onClickCard(e: React.MouseEvent<HTMLButtonElement>) {
    if (suppressClick.current) {
      suppressClick.current = false; // 拖动产生的 click 直接吞掉
      return;
    }
    props.onToggle(Number((e.currentTarget as HTMLElement).dataset.index));
  }

  return (
    <section>
      <p className="eyebrow">手写选择</p>
      <h1 className="view-title">选出你的五张牌</h1>
      <p className="select-hint">轻点选一张，或在牌带上划过连续多选</p>
      <div className="selection-status">
        <span>已选 {props.selectedIndexes.length} / 5</span>
        <span className="pips">{pips}</span>
      </div>

      <div
        className="deck-scroller"
        ref={scrollerRef}
        role="listbox"
        aria-label="78 张塔罗牌"
        aria-multiselectable="true"
      >
        {Array.from({ length: props.deckSize }, (_, index) => {
          const order = props.selectedIndexes.indexOf(index);
          const selected = order >= 0;
          return (
            <button
              key={index}
              data-index={index}
              className={`deck-card${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={endGesture}
              onPointerCancel={endGesture}
              onClick={onClickCard}
            >
              <img src={props.cardBackSrc} alt="" loading="lazy" decoding="async" />
              {selected && <span className="order">{order + 1}</span>}
            </button>
          );
        })}
      </div>

      <div className="sticky-actions">
        <button className="btn ghost" onClick={props.onReshuffle}>
          重新洗牌
        </button>
        <button className="btn ghost" onClick={props.onClear}>
          清空
        </button>
        <button
          className="btn primary"
          disabled={props.selectedIndexes.length !== 5}
          onClick={props.onConfirm}
        >
          确认揭牌
        </button>
      </div>
    </section>
  );
}

// ===== 结果 =====

function ResultView(props: {
  reading: PublicReading;
  streaming: boolean;
  streamText: string;
  onInterpret: () => void;
  onRedraw?: () => void;
}) {
  const { reading } = props;
  const revealed = reading.revealed;
  const calculation = reading.calculation;
  const interpretation = reading.interpretation;

  const revealedByPos = useMemo(() => {
    const map = new Map<number, RevealedCard>();
    (revealed ?? []).forEach((card) => map.set(card.position, card));
    return map;
  }, [revealed]);

  const needsInterpret = !interpretation || reading.status === "failed";

  return (
    <section>
      <p className="eyebrow">{reading.question}</p>
      <h1 className="view-title">你的牌阵</h1>

      {revealed && (
        <div className="revealed-row">
          {revealed.map((card) => (
            <div className="revealed-card" key={card.position}>
              <div className="card-image">
                <img
                  src={imageOf(card.card.image)}
                  className={card.orientation === "reversed" ? "reversed" : ""}
                  alt={card.card.name}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="pos">{card.positionName}</span>
              <h3>{card.card.name}</h3>
              <small>{card.orientation === "reversed" ? "逆位" : "正位"}</small>
            </div>
          ))}
        </div>
      )}

      {calculation && <MetricsView calculation={calculation} />}

      {needsInterpret ? (
        <div className="interpret-cta">
          <p>
            牌已揭晓。点下方按钮，调用你配置的模型，把五张牌串成一段属于你此刻的解读。
          </p>
          <button className="btn primary block" disabled={props.streaming} onClick={props.onInterpret}>
            {props.streaming ? (
              <>
                <span className="spin" /> 解读中…
              </>
            ) : reading.status === "failed" ? (
              "重试解读"
            ) : (
              "开始解读"
            )}
          </button>
        </div>
      ) : null}

      {props.streaming && props.streamText && (
        <pre className="interpret-progress">{props.streamText}</pre>
      )}

      {!props.streaming && interpretation && (
        <InterpretationView interpretation={interpretation} revealedByPos={revealedByPos} />
      )}

      {props.onRedraw && !props.streaming && (
        <button className="btn ghost block" style={{ marginTop: 6 }} onClick={props.onRedraw}>
          再抽一次
        </button>
      )}
    </section>
  );
}

function MetricsView(props: { calculation: ReadingCalculation }) {
  const { calculation } = props;
  return (
    <div className="metrics">
      <div>
        <span>动量</span>
        <b>{calculation.momentum}</b>
        <small>{calculation.momentumLabel}</small>
      </div>
      <div>
        <span>价值</span>
        <b>{calculation.value}</b>
        <small>{calculation.valueLabel}</small>
      </div>
    </div>
  );
}

function InterpretationView(props: {
  interpretation: NonNullable<PublicReading["interpretation"]>;
  revealedByPos: Map<number, RevealedCard>;
}) {
  const it = props.interpretation;
  return (
    <div className="reading-content">
      <section>
        <h2>{it.headline}</h2>
        <p>{it.questionReflection}</p>
      </section>

      <section className="card-readings">
        <h2>逐张解读</h2>
        {it.cards.map((card) => {
          const revealed = props.revealedByPos.get(card.position);
          return (
            <article key={`${card.cardId}-${card.position}`}>
              <i>{card.position}</i>
              <div>
                <h3>{revealed?.card.name ?? card.cardId}</h3>
                <p>{card.meaning}</p>
                <small className="connection">{card.connectionToQuestion}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section>
        <h2>五张牌的脉络</h2>
        <p>{it.storyline}</p>
      </section>

      <section>
        <h2>动量与价值</h2>
        <p>{it.momentumInterpretation}</p>
        <p>{it.valueInterpretation}</p>
      </section>

      <section>
        <h2>可以怎么做</h2>
        <ol>
          {it.actionAdvice.map((advice, i) => (
            <li key={i}>{advice}</li>
          ))}
        </ol>
      </section>

      <blockquote>给自己的一个问题：{it.reflectionQuestion}</blockquote>
      <p className="disclaimer">{it.disclaimer}</p>
    </div>
  );
}

// ===== 记录 =====

function HistoryView(props: {
  items: PublicReading[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearHistory: () => void;
  onExport: () => void;
}) {
  if (props.items.length === 0) {
    return (
      <section>
        <p className="eyebrow">记录</p>
        <h1 className="view-title">过往的解读</h1>
        <div className="empty-state">
          <b>还没有记录</b>
          回去抽一组牌，解读会留在这里。
        </div>
      </section>
    );
  }
  return (
    <section>
      <p className="eyebrow">记录</p>
      <div className="history-head">
        <h1 className="view-title">过往的解读</h1>
        <button className="btn ghost" onClick={props.onExport}>
          导出
        </button>
      </div>
      <div className="history-list">
        {props.items.map((item) => (
          <div className="history-item" key={item.id}>
            <span className="glyph">
              <CompassIcon />
            </span>
            <button
              className="body"
              style={{ border: "none", background: "transparent", textAlign: "left", flex: 1, minWidth: 0 }}
              onClick={() => props.onOpen(item.id)}
            >
              <b>{item.question}</b>
              <small>
                {item.mode === "random" ? "随缘" : "手写"} · {item.status === "completed" ? "已完成" : "未完成"}
              </small>
            </button>
            <button className="del" aria-label="删除" onClick={() => props.onDelete(item.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="btn ghost block" style={{ marginTop: 14 }} onClick={props.onClearHistory}>
        清空全部记录
      </button>
    </section>
  );
}

// ===== 设置 =====

function SettingsView(props: {
  initialSettings: MobileSettings;
  hasKey: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onChanged: () => void;
  onNotify: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<MobileSettings>(props.initialSettings);
  const [apiKey, setApiKeyLocal] = useState(getApiKey() ?? "");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // ---- R2 云同步状态 ----
  const [r2, setR2] = useState<R2Settings>(loadR2Settings());
  const [secretAccessKeyLocal, setSecretAccessKeyLocal] = useState(getSecretAccessKey() ?? "");
  const [syncTokenLocal, setSyncTokenLocal] = useState(getSyncToken() ?? "");
  const [r2Test, setR2Test] = useState<{ ok: boolean; message: string } | null>(null);
  const [r2Testing, setR2Testing] = useState(false);
  const [r2Result, setR2Result] = useState<{ pulled: number; pushed: number; errors: string[] } | null>(null);
  const [r2Syncing, setR2Syncing] = useState(false);

  const r2Ready =
    r2.mode === "worker"
      ? Boolean(r2.workerUrl.trim() && syncTokenLocal.trim())
      : Boolean(
          r2.accountId.trim() &&
            r2.accessKeyId.trim() &&
            r2.bucketName.trim() &&
            secretAccessKeyLocal.trim(),
        );

  // 进入设置页且已启用并已配置时，后台自动做一次双向同步
  useEffect(() => {
    if (r2.enabled && r2Ready) void runSyncNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(type: string) {
    const preset = MOBILE_PRESETS.find((p) => p.type === type);
    if (!preset) return;
    setSettings({
      ...settings,
      providerType: preset.type,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
    });
  }

  function save() {
    saveSettings(settings);
    if (apiKey.trim()) setApiKey(apiKey);
    else clearApiKey();
    props.onChanged();
    setTest(null);
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const result = await testConnection(settings, apiKey.trim());
    setTest(result);
    setTesting(false);
  }

  // ---- R2 辅助 ----
  function buildClient(): R2Client | WorkerR2Client | null {
    if (r2.mode === "worker") {
      if (!r2.workerUrl.trim() || !syncTokenLocal.trim()) return null;
      return new WorkerR2Client({
        workerUrl: r2.workerUrl.trim(),
        syncToken: syncTokenLocal.trim(),
      });
    }
    if (
      !r2.accountId.trim() ||
      !r2.accessKeyId.trim() ||
      !r2.bucketName.trim() ||
      !secretAccessKeyLocal.trim()
    ) {
      return null;
    }
    try {
      const endpoint = resolveR2Endpoint({
        accountId: r2.accountId.trim(),
        endpoint: r2.endpoint.trim(),
      });
      return new R2Client({
        endpoint,
        accessKeyId: r2.accessKeyId.trim(),
        secretAccessKey: secretAccessKeyLocal.trim(),
        bucketName: r2.bucketName.trim(),
        region: r2.region.trim() || "auto",
      });
    } catch {
      return null;
    }
  }

  async function testR2() {
    const client = buildClient();
    if (!client) {
      const msg = r2.mode === "worker" ? "请先填写 Worker URL / Sync Token" : "请先填写 Account ID / Access Key / Secret / Bucket";
      setR2Test({ ok: false, message: msg });
      return;
    }
    setR2Testing(true);
    setR2Test(null);
    const result = await client.testConnection();
    setR2Test(result);
    setR2Testing(false);
  }

  function saveR2() {
    const next: R2Settings = {
      enabled: r2.enabled,
      mode: r2.mode,
      accountId: r2.accountId.trim(),
      endpoint: r2.endpoint.trim(),
      accessKeyId: r2.accessKeyId.trim(),
      bucketName: r2.bucketName.trim(),
      region: r2.region.trim() || "auto",
      workerUrl: r2.workerUrl.trim(),
    };
    saveR2Settings(next);
    setR2(next);
    if (r2.mode === "worker") {
      if (syncTokenLocal.trim()) setSyncToken(syncTokenLocal.trim());
      else clearSyncToken();
    } else {
      if (secretAccessKeyLocal.trim()) setSecretAccessKey(secretAccessKeyLocal.trim());
      else clearSecretAccessKey();
    }
    props.onNotify("R2 配置已保存");
  }

  async function runSyncNow(silent = false) {
    const client = buildClient();
    if (!client) {
      const msg = r2.mode === "worker" ? "请先保存 Worker URL / Sync Token" : "请先保存 Account ID / Access Key / Secret / Bucket";
      if (!silent) setR2Result({ pulled: 0, pushed: 0, errors: [msg] });
      return;
    }
    const sync = new MobileR2SyncService(client, repository);
    setR2Syncing(true);
    setR2Result(null);
    try {
      const report = await sync.sync();
      setR2Result(report);
      if (!silent) {
        props.onChanged();
        props.onNotify(`同步完成：拉取 ${report.pulled}，推送 ${report.pushed}`);
      }
    } catch (error) {
      setR2Result({ pulled: 0, pushed: 0, errors: [error instanceof Error ? error.message : "同步失败"] });
    } finally {
      setR2Syncing(false);
    }
  }

  return (
    <section>
      <p className="eyebrow">设置</p>
      <h1 className="view-title">连接与偏好</h1>

      <div className="settings-card">
        <h2>模型连接</h2>
        <p className="hint">手机端通过 OpenAI 兼容接口 /chat/completions 调用模型，支持 SSE 流式。</p>

        <label className="field">
          <span>服务商预设</span>
          <select value={settings.providerType} onChange={(e) => applyPreset(e.target.value)}>
            {MOBILE_PRESETS.map((p) => (
              <option key={p.type} value={p.type}>
                {p.label}
              </option>
            ))}
          </select>
          {MOBILE_PRESETS.find((p) => p.type === settings.providerType)?.description && (
            <small>{MOBILE_PRESETS.find((p) => p.type === settings.providerType)?.description}</small>
          )}
        </label>

        <label className="field">
          <span>接口地址 (Base URL)</span>
          <input
            value={settings.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          />
          <small>OpenAI 兼容的 /v1 路径</small>
        </label>

        <label className="field">
          <span>模型</span>
          <input
            value={settings.model}
            placeholder="如 gpt-5-mini / MiniMax-M3"
            list="model-suggestions"
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          />
          <datalist id="model-suggestions">
            {(MOBILE_PRESETS.find((p) => p.type === settings.providerType)?.models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>API Token</span>
          <input
            type="password"
            value={apiKey}
            placeholder={props.hasKey ? "已保存（留空表示不修改）" : "粘贴你的 Key"}
            autoComplete="off"
            onChange={(e) => setApiKeyLocal(e.target.value)}
          />
          <small>本地仅明文存于浏览器，建议仅在可信设备上使用</small>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.streaming}
            onChange={(e) => setSettings({ ...settings, streaming: e.target.checked })}
          />
          <span>
            流式输出
            <small>开启后用打字机效果渐进显示解读（SSE），关闭则等待完整结果一次返回</small>
          </span>
        </label>

        <div className="settings-actions">
          <button className="btn primary" onClick={save}>
            保存连接
          </button>
          <button className="btn" disabled={testing} onClick={runTest}>
            {testing ? (
              <>
                <span className="spin" /> 测试中
              </>
            ) : (
              "测试连接"
            )}
          </button>
          {test && (
            <span className={`test-result ${test.ok ? "ok" : "fail"}`}>{test.message}</span>
          )}
        </div>
      </div>

      <div className="settings-card r2-sync-card">
        <div className="card-head">
          <div className="provider-logo">R2</div>
          <div>
            <h2>Cloudflare R2 云同步</h2>
            <p className="hint">每条记录以 JSON 文件同步到 R2，手机与桌面共用同一个桶即可互相同步。</p>
          </div>
          <span className="settings-status" data-ready={r2Ready}>
            {r2Ready ? "已配置" : "未配置"}
          </span>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={r2.enabled}
            onChange={(e) => setR2({ ...r2, enabled: e.target.checked })}
          />
          <span>
            启用 R2 自动同步
            <small>开启后，每次新建/解读/删除都会自动推送到 R2</small>
          </span>
        </label>

        <label className="field">
          <span>连接模式</span>
          <select
            value={r2.mode}
            onChange={(e) => setR2({ ...r2, mode: e.target.value as R2Mode })}
          >
            <option value="worker">Worker 代理（推荐，密钥不落地前端）</option>
            <option value="direct">直连 R2（需配 CORS，密钥存浏览器）</option>
          </select>
          <small>
            {r2.mode === "worker"
              ? "前端只持 Worker URL + Sync Token，R2 密钥由 Worker 服务端持有，无 CORS 问题"
              : "浏览器直接用 SigV4 签名打 R2 端点，需在 R2 控制台配 CORS 策略"}
          </small>
        </label>

        {r2.mode === "worker" ? (
          <>
            <label className="field">
              <span>Worker URL</span>
              <input
                value={r2.workerUrl}
                placeholder="https://tarot-r2-sync.xxx.workers.dev"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, workerUrl: e.target.value })}
              />
              <small>部署 cloudflare-worker 后得到的 workers.dev 域名</small>
            </label>

            <label className="field">
              <span>Sync Token</span>
              <input
                type="password"
                value={syncTokenLocal}
                placeholder={getSyncToken() ? "已保存；输入新值以替换" : "wrangler secret put SYNC_TOKEN 时设的值"}
                autoComplete="off"
                onChange={(e) => setSyncTokenLocal(e.target.value)}
              />
              <small>与 Worker 侧 SYNC_TOKEN 一致即可通过鉴权</small>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Account ID</span>
              <input
                value={r2.accountId}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, accountId: e.target.value })}
              />
              <small>Cloudflare 账户 ID，用于构造 R2 端点</small>
            </label>

            <label className="field">
              <span>Endpoint（可选）</span>
              <input
                value={r2.endpoint}
                placeholder="留空则用 https://&lt;AccountID&gt;.r2.cloudflarestorage.com"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, endpoint: e.target.value })}
              />
              <small>自定义端点，留空自动按 Account ID 派生</small>
            </label>

            <label className="field">
              <span>Access Key ID</span>
              <input
                value={r2.accessKeyId}
                placeholder="R2 访问密钥 ID"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, accessKeyId: e.target.value })}
              />
              <small>R2 Object Read &amp; Write 令牌的 Access Key ID</small>
            </label>

            <label className="field">
              <span>Secret Access Key</span>
              <input
                type="password"
                value={secretAccessKeyLocal}
                placeholder={getSecretAccessKey() ? "已保存；输入新值以替换" : "与 Access Key ID 配对的密钥"}
                autoComplete="off"
                onChange={(e) => setSecretAccessKeyLocal(e.target.value)}
              />
              <small>保存在浏览器 localStorage（仅本机）；走 Capacitor 后将迁至系统钥匙串</small>
            </label>

            <label className="field">
              <span>Bucket 名称</span>
              <input
                value={r2.bucketName}
                placeholder="tarot-sync"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, bucketName: e.target.value })}
              />
              <small>R2 存储桶名称，需与桌面端一致才能互相同步</small>
            </label>

            <label className="field">
              <span>Region</span>
              <input
                value={r2.region}
                placeholder="auto"
                spellCheck={false}
                onChange={(e) => setR2({ ...r2, region: e.target.value })}
              />
              <small>R2 通常保持 auto 即可</small>
            </label>
          </>
        )}

        <div className="settings-actions">
          <button className="btn primary" onClick={saveR2}>
            保存 R2 配置
          </button>
          <button className="btn" disabled={r2Testing || !r2Ready} onClick={testR2}>
            {r2Testing ? (
              <>
                <span className="spin" /> 测试中
              </>
            ) : (
              "测试连接"
            )}
          </button>
          {r2Test && (
            <span className={`test-result ${r2Test.ok ? "ok" : "fail"}`}>{r2Test.message}</span>
          )}
        </div>

        <div className="settings-actions">
          <button
            className="btn"
            disabled={r2Syncing || !r2Ready}
            onClick={() => void runSyncNow(false)}
          >
            {r2Syncing ? (
              <>
                <span className="spin" /> 同步中
              </>
            ) : (
              "立即同步"
            )}
          </button>
          {r2Result && (
            <span className={`test-result ${r2Result.errors.length === 0 ? "ok" : "fail"}`}>
              {r2Result.errors.length === 0
                ? `✓ 拉取 ${r2Result.pulled} · 推送 ${r2Result.pushed}`
                : `✗ ${r2Result.errors[0]}`}
            </span>
          )}
        </div>
      </div>

      <div className="settings-card">
        <h2>外观</h2>
        <p className="hint">跟随系统或手动切换深色 / 浅色。</p>
        <button className="theme-toggle" onClick={props.onToggleTheme}>
          {props.theme === "dark" ? "🌙 深色" : "☀️ 浅色"}
        </button>
      </div>

      <div className="security-note">
        <span>🔒</span>
        <div>
          <b>关于安全</b>
          <br />
          当前为 Web/PWA 预览版，API Token 明文存于浏览器 localStorage，同源脚本可读。R2 同步走 Worker 代理模式时，R2 密钥不落地前端（仅 Sync Token 存浏览器）；走直连模式时 Secret Access Key 同样明文存 localStorage。建议仅在可信设备使用，走 Capacitor 原生包装后应改用系统钥匙串（Keychain / Keystore）。
        </div>
      </div>
    </section>
  );
}

// ===== 分组选择抽屉 =====

function FolderSheet(props: {
  folders: ReadingFolder[];
  activeFolderId: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(8,10,14,.45)",
        display: "grid",
        placeItems: "end center",
      }}
      onClick={props.onClose}
    >
      <div
        className="astryx-surface"
        style={{ width: "100%", maxWidth: 520, padding: 18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <b style={{ fontSize: 16 }}>选择分组</b>
          <button className="header-back" onClick={props.onClose}>
            完成
          </button>
        </div>

        <button
          className={`history-item${props.activeFolderId === null ? " selected" : ""}`}
          style={{ width: "100%", marginBottom: 8, background: props.activeFolderId === null ? "var(--accent-wash)" : "var(--background)" }}
          onClick={() => props.onPick(null)}
        >
          <span className="glyph">
            <CompassIcon />
          </span>
          <span className="body">
            <b>未分组</b>
            <small>不归入任何分组</small>
          </span>
        </button>

        {props.folders.map((folder) => (
          <div key={folder.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <button
              className="history-item"
              style={{ flex: 1, background: props.activeFolderId === folder.id ? "var(--accent-wash)" : "var(--background)" }}
              onClick={() => props.onPick(folder.id)}
            >
              <span className="glyph">
                <StargateMark />
              </span>
              <span className="body">
                <b>{folder.name}</b>
                <small>点击选用</small>
              </span>
            </button>
            <button className="btn ghost" onClick={() => props.onRename(folder.id, prompt("重命名为", folder.name) ?? folder.name)}>
              改名
            </button>
            <button className="btn danger ghost" onClick={() => props.onDelete(folder.id)}>
              删
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="field"
            style={{ flex: 1, border: "1px solid var(--border-strong)", borderRadius: 12, padding: "11px 13px", background: "var(--surface-subtle)" }}
            placeholder="新分组名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              props.onCreate(name.trim());
              setName("");
            }}
          >
            新建
          </button>
        </div>
      </div>
    </div>
  );
}
