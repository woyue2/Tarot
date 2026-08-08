import { z } from "zod";

const scoreSchema = z.object({ semantic: z.number(), dynamic: z.number(), rank: z.number(), final: z.number(), basis: z.string().min(1), scoreTableVersion: z.string().min(1) });
const calculationSchema = z.object({ formulaVersion: z.string().min(1), momentum: z.number(), momentumLabel: z.string().min(1), value: z.number(), valueLabel: z.string().min(1) });
const patternSummarySchema = z.object({ majorMinorRatio: z.string(), suitDistribution: z.string(), repeatedNumbers: z.array(z.string()), repeatedSymbols: z.array(z.string()), directionFlow: z.string() });
const spreadSchema = z.object({ id: z.string().min(1), name: z.string().min(1), positions: z.array(z.object({ index: z.number().int().min(1), name: z.string().min(1), hint: z.string().optional() })).min(1), supportsScoring: z.boolean() });

export const interpretationInputSchema = z.object({
  readingId: z.string().min(1), contentVersion: z.string().min(1), question: z.string().min(1), spread: spreadSchema,
  scoring: z.boolean(), energyFlow: z.boolean(), draw: z.object({ mode: z.enum(["manual", "random"]), confirmed: z.literal(true) }),
  cards: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), orientation: z.enum(["upright", "reversed"]), position: z.number().int().min(1), positionName: z.string().min(1), visualDescription: z.string().min(1), symbols: z.array(z.string()), direction: z.string(), score: scoreSchema })),
  calculation: calculationSchema.optional(), patterns: patternSummarySchema.optional(),
  methodology: z.object({ version: z.string().min(1), style: z.string().min(1) }), promptVersion: z.string().min(1), outputLanguage: z.literal("zh-CN"),
}).superRefine((input, context) => {
  if (input.cards.length !== input.spread.positions.length) context.addIssue({ code: "custom", message: "抽牌数量必须与牌阵位置数量一致", path: ["cards"] });
  const positions = input.cards.map((card) => card.position).sort((a, b) => a - b);
  if (positions.join(",") !== input.spread.positions.map((position) => position.index).join(",")) context.addIssue({ code: "custom", message: "位置编号必须覆盖牌阵全部位置", path: ["cards"] });
  if (new Set(input.cards.map((card) => card.id)).size !== input.cards.length) context.addIssue({ code: "custom", message: "Cards must be unique", path: ["cards"] });
  if (input.scoring && !input.spread.supportsScoring) context.addIssue({ code: "custom", message: "该牌阵不支持评分", path: ["scoring"] });
  if (input.scoring !== Boolean(input.calculation)) context.addIssue({ code: "custom", message: "评分与 calculation 必须一致", path: ["calculation"] });
  if (input.energyFlow !== Boolean(input.patterns)) context.addIssue({ code: "custom", message: "能量流与 patterns 必须一致", path: ["patterns"] });
});

const baseInterpretationSchema = z.object({ headline: z.string().min(1), questionReflection: z.string().min(1), cards: z.array(z.object({ cardId: z.string().min(1), position: z.number().int().min(1), meaning: z.string().min(1), connectionToQuestion: z.string().min(1) })), storyline: z.string().min(1), actionAdvice: z.array(z.string().min(1)).min(2).max(3), reflectionQuestion: z.string().min(1), disclaimer: z.string().min(1) });
export const interpretationSchema = baseInterpretationSchema.extend({ calculation: calculationSchema.optional(), momentumInterpretation: z.string().min(1).optional(), valueInterpretation: z.string().min(1).optional(), energyFlow: z.string().min(1).optional(), overallTheme: z.string().min(1).optional(), patterns: z.array(z.string().min(1)).optional(), holisticReading: z.string().min(1).optional() });

export function validateInterpretationForInput(input: TarotInterpretationInput, output: TarotInterpretation): TarotInterpretation {
  if (output.cards.length !== input.cards.length) throw new Error("模型返回的逐牌解读数量与牌阵不一致");
  if (input.scoring && (!output.momentumInterpretation || !output.valueInterpretation)) throw new Error("评分模式缺少动量或价值解读");
  if (input.energyFlow && (!output.energyFlow || !output.overallTheme || !output.patterns || !output.holisticReading)) throw new Error("能量流模式缺少整体解读字段");
  return output;
}

export type TarotInterpretationInput = z.infer<typeof interpretationInputSchema>;
export type TarotInterpretation = z.infer<typeof interpretationSchema>;
