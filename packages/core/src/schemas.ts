import { z } from "zod";

const scoreSchema = z.object({
  semantic: z.number(),
  dynamic: z.number(),
  rank: z.number(),
  final: z.number(),
  basis: z.string().min(1),
  scoreTableVersion: z.string().min(1),
});

export const interpretationInputSchema = z.object({
  readingId: z.string().min(1),
  contentVersion: z.string().min(1),
  question: z.string().min(1),
  spread: z.object({
    id: z.literal("five_card_timeline_v1"),
    name: z.literal("五张时间流"),
    positions: z.tuple([
      z.literal("较远背景"),
      z.literal("早期状态"),
      z.literal("中间状态"),
      z.literal("近期状态"),
      z.literal("当前状态"),
    ]),
  }),
  draw: z.object({ mode: z.enum(["manual", "random"]), confirmed: z.literal(true) }),
  cards: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    orientation: z.enum(["upright", "reversed"]),
    position: z.number().int().min(1).max(5),
    positionName: z.string().min(1),
    visualDescription: z.string().min(1),
    symbols: z.array(z.string()),
    direction: z.string(),
    score: scoreSchema,
  })).length(5),
  calculation: z.object({
    formulaVersion: z.string().min(1),
    momentum: z.number(),
    momentumLabel: z.string().min(1),
    value: z.number(),
    valueLabel: z.string().min(1),
  }),
  methodology: z.object({ version: z.string().min(1), style: z.string().min(1) }),
  promptVersion: z.string().min(1),
  outputLanguage: z.literal("zh-CN"),
}).superRefine((input, context) => {
  if (new Set(input.cards.map((card) => card.id)).size !== 5) {
    context.addIssue({ code: "custom", message: "Cards must be unique", path: ["cards"] });
  }
  const positions = input.cards.map((card) => card.position).sort();
  if (positions.join(",") !== "1,2,3,4,5") {
    context.addIssue({ code: "custom", message: "Positions must cover 1 through 5", path: ["cards"] });
  }
});

export const interpretationSchema = z.object({
  headline: z.string().min(1),
  questionReflection: z.string().min(1),
  cards: z.array(z.object({
    cardId: z.string().min(1),
    position: z.number().int().min(1).max(5),
    meaning: z.string().min(1),
    connectionToQuestion: z.string().min(1),
  })).length(5),
  storyline: z.string().min(1),
  momentumInterpretation: z.string().min(1),
  valueInterpretation: z.string().min(1),
  actionAdvice: z.array(z.string().min(1)).min(2).max(3),
  reflectionQuestion: z.string().min(1),
  disclaimer: z.string().min(1),
});

export type TarotInterpretationInput = z.infer<typeof interpretationInputSchema>;
export type TarotInterpretation = z.infer<typeof interpretationSchema>;
