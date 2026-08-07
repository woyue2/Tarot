import type { TarotCard } from "@tarot/core";
import type { ContentBundle } from "@tarot/runtime";
import cardsData from "../../../../resources/cards.json";
import manifest from "../../../../resources/content-manifest.json";
import methodology from "../../../../resources/methodology.json";

// 复用桌面端同一份牌组与内容资源（resources/*.json）。
// 图片路径 card.image（如 "cards/major-00.webp"）由 vite.config 的中间件/拷贝
// 映射到 /cards/*，与桌面端渲染逻辑保持一致。
export const cardBack = cardsData.cardBack as string;

export const contentBundle: ContentBundle = {
  cards: cardsData.cards as unknown as TarotCard[],
  contentVersion: cardsData.contentVersion,
  scoreTableVersion: cardsData.scoreTableVersion,
  methodologyVersion: manifest.methodologyVersion,
  methodologyStyle: (methodology.principles as string[]).join("；"),
};
