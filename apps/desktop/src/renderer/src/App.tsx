import { useEffect, useMemo, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { AnimatePresence, motion } from "framer-motion";

type Stage = "home" | "select" | "result" | "settings";

const stageTitles: Record<Stage, string> = {
  home: "新解读",
  select: "选择牌面",
  result: "解读详情",
  settings: "模型连接",
};

export function App() {
  const [stage, setStage] = useState<Stage>("home");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState<{ id: string; deckSize: number }>();
  const [selection, setSelection] = useState<number[]>([]);
  const [reading, setReading] = useState<ReadingView>();
  const [history, setHistory] = useState<ReadingView[]>([]);
  const [folders, setFolders] = useState<ReadingFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>();
  const [settings, setSettings] = useState<TarotSettings>({ model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1", hasApiKey: false });
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    void window.tarot.bootstrap().then((data) => {
      setHistory(data.history);
      setFolders(data.folders);
      setSettings(data.settings);
    }).catch(showError);
  }, []);

  function showError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message.replace(/^Error invoking remote method '[^']+': Error: /, ""));
  }

  async function begin(mode: "manual" | "random") {
    setError("");
    setBusy(true);
    try {
      const created = await window.tarot.createReading({ question, mode, ...(activeFolderId ? { folderId: activeFolderId } : {}) });
      if (mode === "random") {
        const confirmed = await window.tarot.confirmReading({ id: created.id });
        setReading(confirmed);
        setStage("result");
      } else {
        setDraft(created);
        setSelection([]);
        setStage("select");
      }
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  function toggleCard(index: number) {
    setSelection((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : current.length < 5 ? [...current, index] : current);
  }

  async function confirmSelection() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const confirmed = await window.tarot.confirmReading({ id: draft.id, selectedIndexes: selection });
      setReading(confirmed);
      setStage("result");
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function interpret() {
    if (!reading) return;
    if (!settings.hasApiKey) {
      setStage("settings");
      setError("请先配置 API Token。当前牌阵已经保存在本地。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const completed = await window.tarot.interpret(reading.id);
      setReading(completed);
      setHistory(await window.tarot.history());
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(clearApiKey = false) {
    setBusy(true);
    setSavedNotice("");
    try {
      const saved = await window.tarot.saveSettings({
        ...(apiKey ? { apiKey } : {}),
        ...(clearApiKey ? { clearApiKey: true } : {}),
        model: settings.model,
        baseUrl: settings.baseUrl,
      });
      setSettings(saved);
      setApiKey("");
      setError("");
      setSavedNotice(clearApiKey ? "Token 已清除" : "连接设置已保存");
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("home");
    setActiveFolderId(undefined);
    setQuestion("");
    setDraft(undefined);
    setReading(undefined);
    setSelection([]);
    setError("");
  }

  function openHistory(item: ReadingView) {
    if (!item.revealed) return;
    setReading(item);
    setActiveFolderId(item.folderId);
    setQuestion(item.question);
    setStage("result");
    setError("");
  }

  function startInFolder(folderId: string) {
    setActiveFolderId(folderId);
    setStage("home");
    setQuestion("");
    setDraft(undefined);
    setReading(undefined);
    setSelection([]);
    setError("");
  }

  async function createFolder(name: string) {
    try {
      const folder = await window.tarot.createFolder(name);
      setFolders((current) => [folder, ...current]);
      startInFolder(folder.id);
    } catch (reason) {
      showError(reason);
    }
  }

  async function renameFolder(id: string, name: string) {
    try {
      const renamed = await window.tarot.renameFolder({ id, name });
      setFolders((current) => current.map((folder) => folder.id === id ? renamed : folder));
    } catch (reason) {
      showError(reason);
    }
  }
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const progressLabel = useMemo(
    () => selection.length === 5 ? "五张已选好，可以确认" : `已选择 ${selection.length} / 5`,
    [selection.length],
  );

  return <div className="app-frame">
    <Sidebar
      stage={stage}
      history={history}
      folders={folders}
      activeFolderId={activeFolderId}
      settings={settings}
      onNewReading={reset}
      onNewReadingInFolder={startInFolder}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onOpenHistory={openHistory}
      onOpenSettings={() => { setStage("settings"); setSavedNotice(""); }}
    />

    <section className="content-shell">
      <header className="content-titlebar">
        <div><span>星径</span><b>{stageTitles[stage]}</b></div>
        <button className="connection-chip" data-ready={settings.hasApiKey} onClick={() => setStage("settings")}>
          <i />{settings.hasApiKey ? settings.model : "配置模型"}
        </button>
      </header>

      <main className="content-scroll">
        <AnimatePresence mode="wait">
          {stage === "home" && <motion.section className="home" key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="hero-orbit" aria-hidden="true"><span>✦</span></div>
            <p className="eyebrow">A QUIET SPACE FOR REFLECTION</p>
            {activeFolder && <div className="active-folder-chip"><span>▱</span><b>{activeFolder.name}</b><small>新问题</small></div>}
            <h1>让五张牌，照见此刻的路径</h1>
            <p className="lead">写下你想探索的问题。牌由本地程序抽取并锁定，AI 只负责解释，不替你做决定。</p>
            <div className="question-panel astryx-surface">
              <TextArea label="你想探索什么？" value={question} onChange={setQuestion} placeholder="例如：未来三个月，我该如何调整工作方向？" rows={4} isRequired />
              <div className="question-footer"><span>{question.length} / 300</span><span>尽量聚焦一个时间范围和主题</span></div>
            </div>
            <div className="mode-actions">
              <Button label="自己选五张" variant="primary" size="lg" width="100%" isDisabled={!question.trim() || busy} isLoading={busy} onClick={() => void begin("manual")} />
              <Button label="随机抽五张" variant="secondary" size="lg" width="100%" isDisabled={!question.trim() || busy} onClick={() => void begin("random")} />
            </div>
          </motion.section>}

          {stage === "select" && draft && <motion.section className="selection-view" key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="eyebrow">CHOOSE WITHOUT OVERTHINKING</p>
            <h1>凭直觉选出五张牌</h1>
            <p className="lead compact">左右滑动牌列，依次点选。再次点击可撤回；确认以后才会揭晓牌面与正逆位。</p>
            <div className="selection-status"><span>{progressLabel}</span><div>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < selection.length ? "filled" : ""}>{index < selection.length ? index + 1 : ""}</i>)}</div></div>
            <div className="deck-scroller" role="listbox" aria-label="78 张背面朝上的塔罗牌" aria-multiselectable="true">
              {Array.from({ length: draft.deckSize }, (_, index) => {
                const order = selection.indexOf(index);
                return <motion.button whileTap={{ scale: .97 }} key={index} className={`deck-card ${order >= 0 ? "selected" : ""}`} onClick={() => toggleCard(index)} role="option" aria-selected={order >= 0} aria-label={`第 ${index + 1} 张牌${order >= 0 ? `，选择顺序 ${order + 1}` : ""}`}>
                  <img src="/cards/card-back.webp" alt="" draggable={false} />{order >= 0 && <span>{order + 1}</span>}
                </motion.button>;
              })}
            </div>
            <div className="sticky-actions"><Button label="取消重选" variant="ghost" size="lg" onClick={reset} /><Button label={selection.length === 5 ? "确认并揭牌" : `还需选择 ${5 - selection.length} 张`} variant="primary" size="lg" isDisabled={selection.length !== 5 || busy} isLoading={busy} onClick={() => void confirmSelection()} /></div>
          </motion.section>}

          {stage === "result" && reading && <motion.section className="result-view" key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">YOUR FIVE-CARD TIMELINE</p>
            <h1>{reading.interpretation?.headline ?? "牌阵已保存，等待解读"}</h1>
            <p className="lead compact">{reading.question}</p>
            <div className="revealed-grid">{reading.revealed?.map((item) => <article className="revealed-card" key={item.cardId}><div className="card-image"><img src={`/${item.card.image}`} alt={item.card.name} className={item.orientation === "reversed" ? "reversed" : ""} /></div><span>{item.positionName}</span><h3>{item.card.name}</h3><small>{item.orientation === "upright" ? "正位" : "逆位"}</small></article>)}</div>
            {reading.calculation && <div className="metrics"><div><span>动量</span><b>{reading.calculation.momentum > 0 ? "+" : ""}{reading.calculation.momentum}</b><small>{reading.calculation.momentumLabel}</small></div><div><span>价值</span><b>{reading.calculation.value > 0 ? "+" : ""}{reading.calculation.value}</b><small>{reading.calculation.valueLabel}</small></div><p>数值来自本地固定表与公式，AI 无法修改。</p></div>}
            {!reading.interpretation ? <div className="interpret-cta"><p>可以现在调用模型，也可以关闭应用后稍后继续。牌、顺序和正逆位不会改变。</p><Button label="开始 AI 解读" variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={() => void interpret()} /></div> : <ReadingContent reading={reading} />}
            <div className="end-actions"><Button label="开始新的探索" variant="secondary" size="lg" onClick={reset} /></div>
          </motion.section>}

          {stage === "settings" && <ModelSettings
            key="settings"
            settings={settings}
            apiKey={apiKey}
            busy={busy}
            savedNotice={savedNotice}
            onApiKeyChange={setApiKey}
            onSettingsChange={setSettings}
            onSave={() => void saveSettings(false)}
            onClear={() => void saveSettings(true)}
          />}
        </AnimatePresence>
      </main>
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="关闭">×</button></div>}
    </section>
  </div>;
}

function Sidebar({ stage, history, folders, activeFolderId, settings, onNewReading, onNewReadingInFolder, onCreateFolder, onRenameFolder, onOpenHistory, onOpenSettings }: {
  stage: Stage;
  history: ReadingView[];
  folders: ReadingFolder[];
  activeFolderId?: string | undefined;
  settings: TarotSettings;
  onNewReading(): void;
  onNewReadingInFolder(folderId: string): void;
  onCreateFolder(name: string): Promise<void>;
  onRenameFolder(id: string, name: string): Promise<void>;
  onOpenHistory(item: ReadingView): void;
  onOpenSettings(): void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");

  async function submitFolder() {
    if (!folderName.trim()) return;
    await onCreateFolder(folderName.trim());
    setFolderName("");
    setCreatingFolder(false);
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(undefined);
      return;
    }
    await onRenameFolder(id, renameValue.trim());
    setRenamingId(undefined);
    setRenameValue("");
  }

  const visibleHistory = history.filter((item) => item.revealed);
  const renderConversation = (item: ReadingView) => <button className="folder-conversation" key={item.id} onClick={() => onOpenHistory(item)}><span>{item.status === "completed" ? "✦" : "○"}</span><div><b>{item.question}</b><small>{new Date(item.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</small></div></button>;

  return <aside className="sidebar">
    <div className="sidebar-brand"><span className="brand-mark">✦</span><div><b>星径</b><small>LOCAL TAROT</small></div></div>
    <button className="new-reading-button" onClick={onNewReading}><span>＋</span><b>新解读</b><kbd>Ctrl N</kbd></button>
    <nav className="sidebar-nav" aria-label="主导航">
      <button data-active={stage !== "settings"} onClick={onNewReading}><span>✧</span><b>探索</b></button>
      <button data-active={stage === "settings"} onClick={onOpenSettings}><span>⌘</span><b>模型连接</b><i className={settings.hasApiKey ? "ready" : ""} /></button>
    </nav>
    <section className="sidebar-history folder-tree">
      <div className="sidebar-section-title"><span>最近记录</span><button className="add-folder-button" onClick={() => setCreatingFolder(true)} title="新建 Folder" aria-label="新建 Folder">＋</button></div>
      {creatingFolder && <div className="folder-create-row"><span>▱</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitFolder(); if (event.key === "Escape") setCreatingFolder(false); }} onBlur={() => { if (!folderName.trim()) setCreatingFolder(false); }} placeholder="Folder 名称" /><button onMouseDown={(event) => event.preventDefault()} onClick={() => void submitFolder()}>确认</button></div>}
      <div className="folder-list">
        {folders.map((folder) => {
          const items = visibleHistory.filter((item) => item.folderId === folder.id);
          const isCollapsed = collapsed[folder.id] === true;
          const isRenaming = renamingId === folder.id;
          return <div className="folder-group" key={folder.id} data-active={activeFolderId === folder.id}>
            <div className="folder-row">
              <button className="folder-toggle" onClick={() => setCollapsed((current) => ({ ...current, [folder.id]: !isCollapsed }))} aria-label={isCollapsed ? "展开" : "折叠"}>{isCollapsed ? "›" : "⌄"}</button>
              <span className="folder-icon">▱</span>
              {isRenaming ? <input className="folder-rename-input" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitRename(folder.id); if (event.key === "Escape") setRenamingId(undefined); }} onBlur={() => void submitRename(folder.id)} /> : <button className="folder-name" onDoubleClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }} onClick={() => setCollapsed((current) => ({ ...current, [folder.id]: false }))}>{folder.name}<small>{items.length}</small></button>}
              <button className="folder-rename" onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }} title="重命名 Folder" aria-label={`重命名 ${folder.name}`}>···</button>
              <button className="folder-compose" onClick={() => { setCollapsed((current) => ({ ...current, [folder.id]: false })); onNewReadingInFolder(folder.id); }} title="在此 Folder 下新建解读" aria-label={`在 ${folder.name} 下新建解读`}>✎</button>
            </div>
            {!isCollapsed && <div className="folder-children">{items.length > 0 ? items.map(renderConversation) : <button className="folder-empty" onClick={() => onNewReadingInFolder(folder.id)}>＋ 添加第一个问题</button>}</div>}
          </div>;
        })}
        {visibleHistory.some((item) => !item.folderId) && <div className="folder-group ungrouped"><div className="folder-row"><button className="folder-toggle" onClick={() => setCollapsed((current) => ({ ...current, ungrouped: !current.ungrouped }))}>{collapsed.ungrouped ? "›" : "⌄"}</button><span className="folder-icon">▱</span><button className="folder-name">未分组<small>{visibleHistory.filter((item) => !item.folderId).length}</small></button></div>{!collapsed.ungrouped && <div className="folder-children">{visibleHistory.filter((item) => !item.folderId).map(renderConversation)}</div>}</div>}
      </div>
    </section>
    <footer className="sidebar-footer">
      <button onClick={onOpenSettings}><span className="model-status" data-ready={settings.hasApiKey} /><div><b>{settings.hasApiKey ? settings.model : "尚未连接模型"}</b><small>{settings.hasApiKey ? "API 已配置" : "设置 API 地址与 Token"}</small></div><span>›</span></button>
      <p>● 数据仅保存在本机</p>
    </footer>
  </aside>;
}
function ModelSettings({ settings, apiKey, busy, savedNotice, onApiKeyChange, onSettingsChange, onSave, onClear }: {
  settings: TarotSettings;
  apiKey: string;
  busy: boolean;
  savedNotice: string;
  onApiKeyChange(value: string): void;
  onSettingsChange(value: TarotSettings): void;
  onSave(): void;
  onClear(): void;
}) {
  return <motion.section className="settings-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="settings-heading"><p className="eyebrow">SETTINGS · MODELS</p><h1>模型连接</h1><p>配置兼容 OpenAI Responses API 的云端或本地模型。运行时只把已确认的牌阵交给模型解释。</p></div>
    <div className="settings-card">
      <div className="settings-card-header"><div className="provider-logo">AI</div><div><h2>自定义 API</h2><p>OpenAI-compatible</p></div><span className="settings-status" data-ready={settings.hasApiKey}>{settings.hasApiKey ? "已连接" : "未配置"}</span></div>
      <div className="settings-fields">
        <label><span>API 地址</span><small>填写到版本路径，例如 https://api.openai.com/v1</small><input value={settings.baseUrl} onChange={(event) => onSettingsChange({ ...settings, baseUrl: event.target.value })} spellCheck={false} /></label>
        <label><span>模型名称</span><small>服务端接受的实际 model ID</small><input value={settings.model} onChange={(event) => onSettingsChange({ ...settings, model: event.target.value })} spellCheck={false} /></label>
        <label><span>API Token</span><small>{settings.hasApiKey ? "已加密保存在 Windows 安全存储；输入新值即可更换" : "Token 不会传给渲染界面或写入解读历史"}</small><input type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder={settings.hasApiKey ? "输入新的 Token 以替换现有值" : "sk-…"} autoComplete="off" /></label>
      </div>
      <div className="settings-actions">{settings.hasApiKey && <Button label="清除 Token" variant="ghost" size="lg" isDisabled={busy} onClick={onClear} />}<span>{savedNotice}</span><Button label={settings.hasApiKey ? "保存并更新连接" : "保存连接"} variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={onSave} /></div>
    </div>
    <div className="security-note"><span>⌁</span><div><b>本地安全边界</b><p>API 地址和模型名保存在本地设置文件；Token 使用 Electron safeStorage 调用 Windows DPAPI 加密。前端只能知道“是否已配置”，无法读取明文。</p></div></div>
  </motion.section>;
}

function ReadingContent({ reading }: { reading: ReadingView }) {
  const result = reading.interpretation!;
  return <div className="reading-content">
    <section className="reading-hero"><span>整体脉络</span><p>{result.questionReflection}</p><p>{result.storyline}</p></section>
    <section><h2>五张牌如何连接</h2><div className="card-readings">{result.cards.map((item, index) => <article key={item.cardId}><i>{index + 1}</i><div><h3>{reading.revealed?.[index]?.card.name}</h3><p>{item.meaning}</p><p className="connection">{item.connectionToQuestion}</p></div></article>)}</div></section>
    <section className="two-column"><article><span>动量提示</span><p>{result.momentumInterpretation}</p></article><article><span>价值提示</span><p>{result.valueInterpretation}</p></article></section>
    <section className="advice"><h2>带回现实的行动</h2><ol>{result.actionAdvice.map((advice) => <li key={advice}>{advice}</li>)}</ol><blockquote>{result.reflectionQuestion}</blockquote></section>
    <p className="disclaimer">{result.disclaimer}</p>
  </div>;
}
