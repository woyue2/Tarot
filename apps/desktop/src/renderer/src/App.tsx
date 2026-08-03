import { useEffect, useMemo, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { AnimatePresence, motion } from "framer-motion";

type Stage = "home" | "select" | "result";

const sparks = Array.from({ length: 18 }, (_, index) => ({ left: `${(index * 37) % 97}%`, top: `${(index * 53) % 89}%`, delay: `${(index % 7) * -0.8}s` }));

export function App() {
  const [stage, setStage] = useState<Stage>("home");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState<{ id: string; deckSize: number }>();
  const [selection, setSelection] = useState<number[]>([]);
  const [reading, setReading] = useState<ReadingView>();
  const [history, setHistory] = useState<ReadingView[]>([]);
  const [settings, setSettings] = useState<TarotSettings>({ model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1", hasApiKey: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void window.tarot.bootstrap().then((data) => { setHistory(data.history); setSettings(data.settings); }).catch(showError); }, []);

  function showError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message.replace(/^Error invoking remote method '[^']+': Error: /, ""));
  }

  async function begin(mode: "manual" | "random") {
    setError("");
    setBusy(true);
    try {
      const created = await window.tarot.createReading({ question, mode });
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
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  }

  function toggleCard(index: number) {
    setSelection((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 5 ? [...current, index] : current);
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
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  }

  async function interpret() {
    if (!reading) return;
    if (!settings.hasApiKey) { setSettingsOpen(true); setError("先配置模型 API Key；当前牌阵已经保存在本地。"); return; }
    setBusy(true);
    setError("");
    try {
      const completed = await window.tarot.interpret(reading.id);
      setReading(completed);
      setHistory(await window.tarot.history());
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      const saved = await window.tarot.saveSettings({ ...(apiKey ? { apiKey } : {}), model: settings.model, baseUrl: settings.baseUrl });
      setSettings(saved);
      setApiKey("");
      setSettingsOpen(false);
      setError("");
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  }

  function reset() {
    setStage("home"); setDraft(undefined); setReading(undefined); setSelection([]); setError("");
  }

  function openHistory(item: ReadingView) {
    if (!item.revealed) return;
    setReading(item); setQuestion(item.question); setStage("result"); setError("");
  }

  const progressLabel = useMemo(() => selection.length === 5 ? "五张已选好，可以确认" : `已选择 ${selection.length} / 5`, [selection.length]);

  return <div className="app-shell">
    <div className="ambient" aria-hidden="true">{sparks.map((spark, index) => <i key={index} style={spark} />)}</div>
    <header className="topbar">
      <button className="brand" onClick={reset} aria-label="回到首页"><span className="brand-mark">✦</span><span>星径</span><small>LOCAL TAROT</small></button>
      <div className="top-actions"><span className="privacy-dot">● 仅保存在本机</span><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="模型设置">⚙</button></div>
    </header>

    <main>
      <AnimatePresence mode="wait">
        {stage === "home" && <motion.section className="home" key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <p className="eyebrow">A QUIET SPACE FOR REFLECTION</p>
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
          {history.length > 0 && <section className="history-strip"><div className="section-heading"><h2>最近的解读</h2><span>{history.length} 次保存在本地</span></div><div className="history-list">{history.slice(0, 4).map((item) => <button key={item.id} onClick={() => openHistory(item)} disabled={!item.revealed}><span>{item.status === "completed" ? "✦" : "○"}</span><div><b>{item.question}</b><small>{new Date(item.updatedAt).toLocaleString("zh-CN")}</small></div></button>)}</div></section>}
        </motion.section>}

        {stage === "select" && draft && <motion.section className="selection-view" key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <p className="eyebrow">CHOOSE WITHOUT OVERTHINKING</p><h1>凭直觉选出五张牌</h1><p className="lead compact">左右滑动牌列，依次点选。再次点击可撤回；只有确认后，牌面与正逆位才会揭晓。</p>
          <div className="selection-status"><span>{progressLabel}</span><div>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < selection.length ? "filled" : ""}>{index < selection.length ? index + 1 : ""}</i>)}</div></div>
          <div className="deck-scroller" role="listbox" aria-label="78 张背面朝上的塔罗牌" aria-multiselectable="true">
            {Array.from({ length: draft.deckSize }, (_, index) => { const order = selection.indexOf(index); return <motion.button whileTap={{ scale: .97 }} key={index} className={`deck-card ${order >= 0 ? "selected" : ""}`} onClick={() => toggleCard(index)} role="option" aria-selected={order >= 0} aria-label={`第 ${index + 1} 张牌${order >= 0 ? `，选择顺序 ${order + 1}` : ""}`}><img src="/cards/card-back.webp" alt="" draggable={false} />{order >= 0 && <span>{order + 1}</span>}</motion.button>; })}
          </div>
          <div className="sticky-actions"><Button label="取消重选" variant="ghost" size="lg" onClick={reset} /><Button label={selection.length === 5 ? "确认并揭牌" : `还需选择 ${5 - selection.length} 张`} variant="primary" size="lg" isDisabled={selection.length !== 5 || busy} isLoading={busy} onClick={() => void confirmSelection()} /></div>
        </motion.section>}

        {stage === "result" && reading && <motion.section className="result-view" key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="eyebrow">YOUR FIVE-CARD TIMELINE</p><h1>{reading.interpretation?.headline ?? "牌阵已保存，等待解读"}</h1><p className="lead compact">{reading.question}</p>
          <div className="revealed-grid">{reading.revealed?.map((item) => <article className="revealed-card" key={item.cardId}><div className="card-image"><img src={`/${item.card.image}`} alt={item.card.name} className={item.orientation === "reversed" ? "reversed" : ""} /></div><span>{item.positionName}</span><h3>{item.card.name}</h3><small>{item.orientation === "upright" ? "正位" : "逆位"}</small></article>)}</div>
          {reading.calculation && <div className="metrics"><div><span>动量</span><b>{reading.calculation.momentum > 0 ? "+" : ""}{reading.calculation.momentum}</b><small>{reading.calculation.momentumLabel}</small></div><div><span>价值</span><b>{reading.calculation.value > 0 ? "+" : ""}{reading.calculation.value}</b><small>{reading.calculation.valueLabel}</small></div><p>数值来自本地固定表与公式，AI 无法修改。</p></div>}
          {!reading.interpretation ? <div className="interpret-cta"><p>你可以现在调用模型，也可以关闭应用后稍后继续。牌、顺序和正逆位不会改变。</p><Button label="开始 AI 解读" variant="primary" size="lg" isLoading={busy} isDisabled={busy} onClick={() => void interpret()} /></div> : <ReadingContent reading={reading} />}
          <div className="end-actions"><Button label="开始新的探索" variant="secondary" size="lg" onClick={reset} /></div>
        </motion.section>}
      </AnimatePresence>
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="关闭">×</button></div>}
    </main>

    <AnimatePresence>{settingsOpen && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSettingsOpen(false)}><motion.section className="settings-modal" initial={{ opacity: 0, scale: .97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button><p className="eyebrow">LOCAL MODEL SETTINGS</p><h2>模型连接</h2><p>密钥使用 Windows 安全存储加密；不会写入 SQLite 或前端历史。</p><label>API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.hasApiKey ? "已安全保存；留空保持不变" : "sk-…"} /></label><label>模型<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label><label>兼容端点<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label><Button label="安全保存" variant="primary" size="lg" width="100%" isLoading={busy} onClick={() => void saveSettings()} /></motion.section></motion.div>}</AnimatePresence>
  </div>;
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
