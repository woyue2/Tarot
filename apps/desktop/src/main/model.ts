import { interpretationSchema, type TarotInterpretation, type TarotInterpretationInput } from "@tarot/core";
import type { ModelProvider } from "@tarot/runtime";

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "questionReflection", "cards", "storyline", "momentumInterpretation", "valueInterpretation", "actionAdvice", "reflectionQuestion", "disclaimer"],
  properties: {
    headline: { type: "string" },
    questionReflection: { type: "string" },
    cards: { type: "array", minItems: 5, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["cardId", "position", "meaning", "connectionToQuestion"], properties: { cardId: { type: "string" }, position: { type: "integer" }, meaning: { type: "string" }, connectionToQuestion: { type: "string" } } } },
    storyline: { type: "string" },
    momentumInterpretation: { type: "string" },
    valueInterpretation: { type: "string" },
    actionAdvice: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    reflectionQuestion: { type: "string" },
    disclaimer: { type: "string" },
  },
};

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly options: { apiKey: string; model: string; baseUrl: string }) {}

  async interpret(input: TarotInterpretationInput): Promise<TarotInterpretation> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify({
        model: this.options.model,
        instructions: "你是一个克制、生活化、有共情力的塔罗解读助手。牌已由本地程序抽取并保存，你只能解释输入，不得换牌、补牌或声称确定预测未来。严格根据牌面、固定分值和方法论输出。",
        input: JSON.stringify(input),
        text: { format: { type: "json_schema", name: "tarot_reading", strict: true, schema: outputSchema } },
      }),
    });
    const payload = await response.json() as { error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    if (!response.ok) throw new Error(payload.error?.message ?? `模型请求失败（${response.status}）`);
    const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("模型没有返回可解析的结构化结果");
    return interpretationSchema.parse(JSON.parse(text));
  }
}
