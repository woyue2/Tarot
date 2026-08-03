import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const scorePath = path.join(dataDir, "calculate-tarot-momentum-value", "references", "card-scores.csv");
const visualDir = path.join(dataDir, "牌面视觉描述");
const imageDir = path.join(dataDir, "图片");
const outputDir = path.join(root, "resources");
const outputCardDir = path.join(outputDir, "cards");

const groups = [
  { arcana: "major", suit: null, prefix: "major", source: "大阿尔卡那.md", count: 22 },
  { arcana: "minor", suit: "wands", prefix: "wands", source: "权杖.md", imagePrefix: "权杖", count: 14 },
  { arcana: "minor", suit: "cups", prefix: "cups", source: "圣杯.md", imagePrefix: "圣杯", count: 14 },
  { arcana: "minor", suit: "swords", prefix: "swords", source: "宝剑.md", imagePrefix: "宝剑", count: 14 },
  { arcana: "minor", suit: "pentacles", prefix: "pentacles", source: "星币.md", imagePrefix: "星币", count: 14 },
];

const aliases = new Map([
  ["愚人", ["愚者"]],
  ["皇后", ["女皇"]],
  ["隐者", ["隐士"]],
  ["权杖侍从", ["权杖侍者"]],
  ["圣杯侍从", ["圣杯侍者"]],
  ["宝剑侍从", ["宝剑侍者"]],
  ["星币侍从", ["星币侍者"]],
  ["权杖王后", ["权杖女王"]],
  ["圣杯王后", ["圣杯女王"]],
  ["宝剑王后", ["宝剑女王"]],
  ["星币王后", ["星币女王"]],
]);

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...records] = rows;
  if (!headers) throw new Error("card-scores.csv is empty");
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function parseVisualCards(markdown) {
  const sections = markdown.split(/^## /m).slice(1);
  return sections.map((section) => {
    const [heading = "", ...bodyLines] = section.split("\n");
    const body = bodyLines.join("\n");
    const readSection = (title) => {
      const match = body.match(new RegExp(`^### ${title}\\s*\\n([\\s\\S]*?)(?=^### |^---\\s*$|$)`, "m"));
      return match?.[1]?.trim() ?? "";
    };
    const symbolsText = readSection("关键符号");
    const symbols = [...symbolsText.matchAll(/^- \*\*(.+?)\*\*[：:]\s*(.+)$/gm)].map((match) => ({
      name: match[1].trim(),
      meaning: match[2].trim(),
    }));
    return {
      sourceHeading: heading.trim(),
      direction: readSection("朝向"),
      posture: readSection("姿态"),
      colors: readSection("主色调"),
      lighting: readSection("天气/光线"),
      symbols,
      story: readSection("画面故事"),
      pitfalls: readSection("易错点").replace(/^⚠️\s*/, ""),
    };
  });
}

function rankScore(arcana, number) {
  return arcana === "major" ? (20 * number) / 21 - 10 : (20 * (number - 1)) / 13 - 10;
}

function roundHalfAway(value) {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

function fixedScore(semantic, dynamic, rank, basis) {
  return {
    semantic,
    dynamic,
    rank: Number(rank.toFixed(4)),
    final: roundHalfAway(0.8 * semantic + 0.15 * dynamic + 0.05 * rank),
    basis,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

await mkdir(outputCardDir, { recursive: true });
const scoreSource = await readFile(scorePath, "utf8");
const scoreRows = parseCsv(scoreSource.replace(/^\uFEFF/, ""));
if (scoreRows.length !== 78) throw new Error(`Expected 78 score rows, received ${scoreRows.length}`);

const visualByGroup = new Map();
for (const group of groups) {
  const source = await readFile(path.join(visualDir, group.source), "utf8");
  const cards = parseVisualCards(source);
  if (cards.length !== group.count) throw new Error(`${group.source}: expected ${group.count} cards, received ${cards.length}`);
  visualByGroup.set(group.prefix, { cards, source });
}

const imageNames = await readdir(imageDir);
const generatedCards = [];
let scoreIndex = 0;
for (const group of groups) {
  const visualRecord = visualByGroup.get(group.prefix);
  if (!visualRecord) throw new Error(`Missing visuals for ${group.prefix}`);
  for (let localIndex = 0; localIndex < group.count; localIndex += 1) {
    const score = scoreRows[scoreIndex];
    if (!score) throw new Error(`Missing score row ${scoreIndex}`);
    const expectedNumber = group.arcana === "major" ? localIndex : localIndex + 1;
    if (score.arcana !== group.arcana || Number(score.number) !== expectedNumber) {
      throw new Error(`Unexpected score order at row ${scoreIndex + 1}: ${score.card_zh}`);
    }
    const numberText = String(expectedNumber).padStart(2, "0");
    const id = `${group.prefix}-${numberText}`;
    const imagePrefix = group.arcana === "major" ? `${numberText}_` : `${group.imagePrefix}${numberText}_`;
    const imageName = imageNames.find((name) => name.startsWith(imagePrefix) && name.endsWith(".webp"));
    if (!imageName) throw new Error(`${id}: image not found for prefix ${imagePrefix}`);
    const outputImageName = `${id}.webp`;
    await copyFile(path.join(imageDir, imageName), path.join(outputCardDir, outputImageName));
    const rank = rankScore(group.arcana, expectedNumber);
    generatedCards.push({
      id,
      name: score.card_zh,
      nameEn: score.card_en,
      aliases: aliases.get(score.card_zh) ?? [],
      arcana: group.arcana,
      ...(group.suit ? { suit: group.suit } : {}),
      rank: expectedNumber,
      image: `cards/${outputImageName}`,
      visual: visualRecord.cards[localIndex],
      scores: {
        upright: fixedScore(Number(score.upright_s), Number(score.upright_d), rank, score.upright_basis),
        reversed: fixedScore(Number(score.reversed_s), Number(score.reversed_d), rank, score.reversed_basis),
      },
    });
    scoreIndex += 1;
  }
}

const cardBackOutput = "card-back.webp";
await copyFile(path.join(imageDir, "_牌背.webp"), path.join(outputCardDir, cardBackOutput));

const methodologySource = await readFile(path.join(dataDir, "解牌方法论深度解析.txt"), "utf8");
const methodology = {
  version: `methodology-${sha256(methodologySource).slice(0, 12)}`,
  principles: [
    "先理解用户问题和情绪，再解释牌面。",
    "先逐牌解读，再构建从较远背景到当前状态的故事线。",
    "使用生活化语言，不用绝对预测代替用户决策。",
    "正逆位是方向提示；建议必须具体、温和且保留主观能动性。",
    "负价值只针对当前问题路径，不扩大到用户整个领域或人生。",
  ],
};

const sourceHashes = {
  scores: sha256(scoreSource),
  methodology: sha256(methodologySource),
  visuals: Object.fromEntries(groups.map((group) => [group.source, sha256(visualByGroup.get(group.prefix).source)])),
};
const contentVersion = `content-${sha256(JSON.stringify(sourceHashes)).slice(0, 12)}`;
const scoreTableVersion = `scores-${sourceHashes.scores.slice(0, 12)}`;
const cardsPayload = {
  contentVersion,
  scoreTableVersion,
  formulaVersion: "momentum-value-v0.1",
  cardBack: `cards/${cardBackOutput}`,
  cards: generatedCards,
};
const manifest = {
  contentVersion,
  scoreTableVersion,
  methodologyVersion: methodology.version,
  cards: generatedCards.length,
  orientationScores: generatedCards.length * 2,
  sourceHashes,
};

await writeFile(path.join(outputDir, "cards.json"), `${JSON.stringify(cardsPayload, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDir, "methodology.json"), `${JSON.stringify(methodology, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDir, "content-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${generatedCards.length} cards (${generatedCards.length * 2} scores), ${contentVersion}.\n`);
