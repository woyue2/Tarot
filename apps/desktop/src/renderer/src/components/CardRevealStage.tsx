import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { getSpreadById, type SpreadPosition } from "@tarot/core";

interface RevealedCard {
  cardId: string;
  orientation: "upright" | "reversed";
  position: number;
  positionName: string;
  card: { id: string; name: string; nameEn: string; image: string };
}

interface CardRevealStageProps {
  cards: RevealedCard[];
  spreadId?: string;
  autoReveal?: boolean;
  onComplete?: () => void;
  className?: string;
}

const CARD_W = 1.3;
const CARD_H = 1.95;
const CARD_D = 0.04;
const BOX_ARGS: [number, number, number] = [CARD_W, CARD_H, CARD_D];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 根据牌数与真实视口计算合适的排布参数。
 *  关键：canvas 是横向宽屏，必须用水平视口宽度约束牌排总宽，
 *  否则牌只会占水平方向的一小条、显得过小。 */
function useLayout(n: number, viewportW: number, viewportH: number, positions?: readonly SpreadPosition[]) {
  return useMemo(() => {
    if (positions?.length === n) {
      const isRow = positions.every(
        (position) =>
          position.placement.y === positions[0]?.placement.y &&
          (position.placement.rotation ?? 0) === 0,
      );
      if (!isRow) {
        // Shape-based spreads should stay recognizable instead of collapsing into
        // tiny thumbnails as the card count grows. The canvas still limits the
        // scale so dense spreads remain usable.
        const maxShapeScale = n > 10 ? 0.62 : n > 7 ? 0.78 : 0.98;
        const scale = Math.max(0.34, Math.min(maxShapeScale, viewportW / 6.6, viewportH / 4.6));
        return {
          scale,
          step: 0,
          points: positions.map((position) => ({
            x: ((position.placement.x - 50) / 100) * viewportW * 0.82,
            y: ((50 - position.placement.y) / 100) * viewportH * 0.82,
            z: (position.placement.zIndex ?? 0) * 0.035,
            rotation: ((position.placement.rotation ?? 0) * Math.PI) / 180,
          })),
        };
      }
    }
    const gap = 0.06;
    const rawTotal = n * CARD_W + (n - 1) * gap;
    // 牌排占水平视口 90%、牌高不超垂直视口 82%，更紧凑、比例更舒展
    const scaleByW = (viewportW * 0.9) / rawTotal;
    const scaleByH = (viewportH * 0.82) / CARD_H;
    const scale = Math.max(0.1, Math.min(scaleByW, scaleByH, 2.16));
    const step = (CARD_W + gap) * scale;
    return { scale, step, points: undefined };
  }, [n, viewportW, viewportH, positions]);
}

interface Rand {
  sx: number;
  sy: number;
  sz: number;
  delay: number;
  dur: number;
  arc: number;
  yaw0: number;
  spin: number;
  roll: number;
  breathPhase: number;
  breathFreq: number;
  hoverPhase: number;
  hoverPhase2: number;
  hoverFreq: number;
}

function makeRand(index: number, count: number): Rand {
  const base = Math.sin(index * 12.9898 + count * 78.233) * 43758.5453;
  const frac = (base - Math.floor(base)) as unknown as number;
  const rnd = () => frac;
  return {
    sx: (index - (count - 1) / 2) * 0.35 + (Math.random() - 0.5) * 0.6,
    sy: -3.2 - Math.random() * 0.8,
    sz: -1.2 - Math.random() * 1.4,
    delay: 0.1 + Math.random() * 0.55,
    dur: 0.9 + Math.random() * 0.5,
    arc: 0.25 + Math.random() * 0.35,
    yaw0: (Math.random() - 0.5) * 0.7,
    spin: (Math.random() - 0.5) * 0.6,
    roll: (Math.random() - 0.5) * 0.45,
    breathPhase: Math.random() * Math.PI * 2,
    breathFreq: 0.55 + Math.random() * 0.45,
    hoverPhase: Math.random() * Math.PI * 2,
    hoverPhase2: Math.random() * Math.PI * 2,
    hoverFreq: 0.45 + Math.random() * 0.4,
  };
}

interface CardMeshProps {
  index: number;
  count: number;
  faceUrl: string;
  backUrl: string;
  started: boolean;
  flipped: boolean;
  instant: boolean;
  runId: number;
  scale: number;
  step: number;
  endPoint?: { x: number; y: number; z: number; rotation: number } | undefined;
  onOpen?: () => void;
}

function PositionBadge({ number, point, scale }: { number: number; point: { x: number; y: number; z: number }; scale: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.beginPath();
    context.arc(48, 48, 42, 0, Math.PI * 2);
    context.fillStyle = "rgba(24, 22, 18, 0.92)";
    context.fill();
    context.fillStyle = "#fff";
    context.font = "600 48px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(number), 48, 49);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.needsUpdate = true;
    return next;
  }, [number]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <sprite position={[point.x - 0.74 * scale, point.y + 1.02 * scale, point.z + 0.18]} scale={[0.32 * scale, 0.32 * scale, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

function CardMesh({
  index,
  count,
  faceUrl,
  backUrl,
  started,
  flipped,
  instant,
  runId,
  scale,
  step,
  endPoint,
  onOpen,
}: CardMeshProps) {
  const ref = useRef<THREE.Mesh>(null);
  const textures = useLoader(THREE.TextureLoader, [faceUrl, backUrl]);
  const faceTex = textures[0]!;
  const backTex = textures[1]!;
  const r = useRef<Rand>(makeRand(index, count));
  const startRef = useRef<number | null>(null);
  const revealedRef = useRef(false);
  const faceUpAtRef = useRef<number | null>(null);

  useEffect(() => {
    [faceTex, backTex].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });
    faceTex.wrapS = THREE.RepeatWrapping;
    faceTex.repeat.x = -1;
    faceTex.offset.x = 1;
  }, [faceTex, backTex]);

  useEffect(() => {
    r.current = makeRand(index, count);
    startRef.current = null;
    revealedRef.current = false;
    faceUpAtRef.current = null;
    if (ref.current) {
      ref.current.position.set(r.current.sx, r.current.sy, r.current.sz);
      ref.current.scale.set(scale, scale, scale);
    }
  }, [runId, index, count, scale]);

  const endPos = useMemo(
    () => new THREE.Vector3(endPoint?.x ?? (index - (count - 1) / 2) * step, endPoint?.y ?? 0, endPoint?.z ?? 0),
    [endPoint, index, count, step],
  );

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;

    if (instant) {
      m.position.copy(endPos);
      m.rotation.set(0, flipped ? Math.PI : 0, endPoint?.rotation ?? 0);
      m.scale.set(scale, scale, scale);
      if (flipped && faceUpAtRef.current === null) {
        faceUpAtRef.current = clock.getElapsedTime();
      }
      return;
    }

    if (!started) {
      startRef.current = null;
      m.position.set(r.current.sx, r.current.sy, r.current.sz);
      m.rotation.set(0, 0, 0);
      m.scale.set(scale, scale, scale);
      return;
    }

    if (startRef.current === null) startRef.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startRef.current - r.current.delay;
    const t = Math.max(0, Math.min(1, elapsed / r.current.dur));
    const e = easeOutCubic(t);

    m.position.x = THREE.MathUtils.lerp(r.current.sx, endPos.x, e);
    m.position.y = THREE.MathUtils.lerp(r.current.sy, endPos.y, e) + r.current.arc * Math.sin(Math.PI * t);
    m.position.z = THREE.MathUtils.lerp(r.current.sz, endPos.z, e);

    const wob = 1 - t;
    m.rotation.x = r.current.spin * wob * Math.sin(t * 6.0);
    m.rotation.z = THREE.MathUtils.lerp(r.current.roll, endPoint?.rotation ?? 0, e) + r.current.roll * wob * Math.sin(t * 5.0 + 1.0);

    if (t >= 1) {
      const targetYaw = flipped ? Math.PI : 0;
      m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, targetYaw, 0.12);
    } else {
      m.rotation.y = THREE.MathUtils.lerp(r.current.yaw0, 0, e);
    }

    if (t >= 1 && flipped && !revealedRef.current) {
      revealedRef.current = true;
      faceUpAtRef.current = clock.getElapsedTime();
    }

    if (t >= 1 && flipped) {
      const time = clock.getElapsedTime();
      const faceUpTime = Math.max(0, time - (faceUpAtRef.current ?? time));
      const decay = Math.exp(-faceUpTime / 2.6);
      const breathAmp = 0.014 * decay + 0.0015;
      const hoverAmpX = 0.022 * decay + 0.002;
      const hoverAmpY = 0.045 * decay + 0.003;
      const hoverAmpZ = 0.02 * decay + 0.002;
      const tiltAmpX = 0.008 * decay + 0.001;
      const tiltAmpZ = 0.006 * decay + 0.001;
      const breath = 1 + breathAmp * Math.sin(time * r.current.breathFreq + r.current.breathPhase);
      m.scale.set(scale * breath, scale * breath, scale * (1 + (breath - 1) * 0.25));
      m.position.x += hoverAmpX * Math.sin(time * r.current.hoverFreq + r.current.hoverPhase);
      m.position.y += hoverAmpY * Math.sin(time * r.current.hoverFreq * 0.72 + r.current.hoverPhase2);
      m.position.z += hoverAmpZ * Math.sin(time * r.current.hoverFreq * 1.15 + r.current.breathPhase);
      m.rotation.x += tiltAmpX * Math.sin(time * r.current.breathFreq * 0.42 + r.current.hoverPhase);
      m.rotation.z += tiltAmpZ * Math.sin(time * r.current.hoverFreq * 0.58 + r.current.breathPhase);
    } else {
      m.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onOpen?.(); }}>
      <boxGeometry args={BOX_ARGS} />
      <meshBasicMaterial
        attach="material-4"
        map={backTex ?? null}
        color="#ffffff"
        toneMapped={false}
      />
      <meshBasicMaterial
        attach="material-5"
        map={faceTex ?? null}
        color="#ffffff"
        toneMapped={false}
      />
      <meshBasicMaterial attach="material-0" color="#ffffff" />
      <meshBasicMaterial attach="material-1" color="#ffffff" />
      <meshBasicMaterial attach="material-2" color="#ffffff" />
      <meshBasicMaterial attach="material-3" color="#ffffff" />
    </mesh>
  );
}

function MagicCircle() {
  return (
    <div className="card-reveal-magic-circle" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="0.6" opacity="0.45" />
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" opacity="0.32" />
        <circle cx="100" cy="100" r="64" stroke="currentColor" strokeWidth="0.5" opacity="0.22" strokeDasharray="3 5" />
        <circle cx="100" cy="100" r="48" stroke="currentColor" strokeWidth="0.4" opacity="0.18" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const x1 = 100 + Math.cos(a) * 54;
          const y1 = 100 + Math.sin(a) * 54;
          const x2 = 100 + Math.cos(a) * 62;
          const y2 = 100 + Math.sin(a) * 62;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.6" opacity="0.35" />;
        })}
        <polygon
          points={Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 - 90) * Math.PI / 180;
            return `${100 + Math.cos(a) * 38},${100 + Math.sin(a) * 38}`;
          }).join(" ")}
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.22"
        />
      </svg>
    </div>
  );
}

function Scene({
  cards,
  started,
  flipped,
  instant,
  runId,
  onOpen,
  positions,
}: {
  cards: RevealedCard[];
  started: boolean;
  flipped: boolean[];
  instant: boolean;
  runId: number;
  onOpen: (index: number) => void;
  positions?: readonly SpreadPosition[] | undefined;
}) {
  const { viewport } = useThree();

  const { scale, step, points } = useLayout(cards.length, viewport.width, viewport.height, positions);
  const backUrl = "/cards/card-back.webp";
  const showPositionBadges = Boolean(points && positions);

  return (
    <Suspense fallback={null}>
      <ambientLight intensity={0.42} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#fff8e7" />
      <pointLight position={[0, 0, 3.2]} intensity={0.7} color="#f5c842" />
      <spotLight position={[-5, 2, 4]} angle={0.35} penumbra={0.6} intensity={1.1} color="#fff0c8" target-position={[0, 0, 0]} />
      {cards.map((card, i) => (
        <group key={card.cardId}>
          <CardMesh
            index={i}
            count={cards.length}
            faceUrl={`/${card.card.image}`}
            backUrl={backUrl}
            started={started}
            flipped={flipped[i] ?? false}
            instant={instant}
            runId={runId}
            scale={scale}
            step={step}
          endPoint={points?.[card.position - 1]}
            onOpen={() => onOpen(i)}
          />
          {showPositionBadges && points?.[card.position - 1] && <PositionBadge number={card.position} point={points[card.position - 1]!} scale={scale} />}
        </group>
      ))}
    </Suspense>
  );
}

function CardInfo({ card, index }: { card: RevealedCard; index: number }) {
  return (
    <motion.div
      className="card-reveal-info"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.3 }}
    >
      <span className="card-reveal-position">{card.position}. {card.positionName}</span>
      <h3>{card.card.name}</h3>
      <small>{card.orientation === "upright" ? "正位" : "逆位"}</small>
    </motion.div>
  );
}

export function CardRevealStage({ cards, spreadId, autoReveal = true, onComplete, className }: CardRevealStageProps) {
  const [started, setStarted] = useState(false);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [instant, setInstant] = useState(false);
  const [runId, setRunId] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const spread = spreadId ? getSpreadById(spreadId) : undefined;

  useEffect(() => {
    if (zoomedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomedIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomedIndex]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = () => {
    clearTimers();
    setRunId((n) => n + 1);
    setFlipped(new Array(cards.length).fill(false));
    setShowInfo(false);
    setInstant(false);
    setStarted(false);

    if (prefersReducedMotion()) {
      setStarted(true);
      setFlipped(new Array(cards.length).fill(true));
      setShowInfo(true);
      onComplete?.();
      return;
    }

    timers.current.push(window.setTimeout(() => setStarted(true), 650));
    cards.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setFlipped((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
          if (i === cards.length - 1) {
            timers.current.push(window.setTimeout(() => {
              setShowInfo(true);
              onComplete?.();
            }, 1200));
          }
        }, 1250 + i * 360),
      );
    });
  };

  useEffect(() => {
    if (autoReveal) play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, autoReveal]);

  const openZoom = (index: number) => {
    if (!showInfo) return;
    setZoomedIndex(index);
  };

  const skip = () => {
    clearTimers();
    setInstant(true);
    setStarted(true);
    setFlipped(new Array(cards.length).fill(true));
    setShowInfo(true);
    onComplete?.();
  };

  return (
    <div className={`card-reveal-stage ${className ?? ""}`}>
      <MagicCircle />
      <div className="card-reveal-canvas-wrap">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 42, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={Math.min(window.devicePixelRatio, 2)}
        >
          <Scene cards={cards} positions={spread?.positions} started={started} flipped={flipped} instant={instant} runId={runId} onOpen={openZoom} />
        </Canvas>
      </div>
      <div className="card-reveal-toolbar">
        <button type="button" onClick={play}>重新揭牌</button>
        <button type="button" onClick={skip}>跳过动画</button>
      </div>
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="card-reveal-info-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {cards.map((card, i) => (
              <CardInfo key={card.cardId} card={card} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {zoomedIndex !== null && cards[zoomedIndex] && (
          <motion.div
            className="card-zoom-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`${cards[zoomedIndex].card.name} 放大视图`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedIndex(null)}
          >
            <motion.div
              className="card-zoom-dialog"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 6 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button className="card-zoom-close" type="button" onClick={() => setZoomedIndex(null)} aria-label="关闭放大视图">×</button>
              <img
                className={`card-zoom-image${cards[zoomedIndex].orientation === "reversed" ? " reversed" : ""}`}
                src={`/${cards[zoomedIndex].card.image}`}
                alt={cards[zoomedIndex].card.name}
              />
              <div className="card-zoom-meta">
                <span>{cards[zoomedIndex].position}. {cards[zoomedIndex].positionName}</span>
                <h2>{cards[zoomedIndex].card.name}</h2>
                <small>{cards[zoomedIndex].orientation === "upright" ? "正位" : "逆位"}</small>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
