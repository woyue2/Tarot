import { interpretationSchema, type TarotInterpretation, type TarotInterpretationInput } from "@tarot/core";
import type { ModelProvider } from "@tarot/runtime";
import { PROVIDER_PRESETS, stripReasoningContent, type ProviderType } from "./provider-registry";

export type { ProviderType };

// ====== 从 maka-agent 的 model-fetcher.ts 抄的：模型发现 ======
export interface DiscoveredModel {
  id: string;
  displayName?: string;
}

export async function fetchProviderModels(baseUrl: string, apiKey: string, providerType?: string): Promise<DiscoveredModel[]> {
  const rawUrl = baseUrl.replace(/\/$/, "");
  try {
    // Ollama 用 /api/tags 端点
    if (providerType === "ollama") {
      const ollamaUrl = rawUrl.replace(/\/v1$/, "");
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { models?: Array<{ name?: string }> };
      return (data.models ?? []).flatMap((m) => m.name ? [{ id: m.name }] : []);
    }

    // 标准 OpenAI 兼容 /models 端点
    const response = await fetch(`${rawUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { data?: Array<{ id?: string; name?: string; display_name?: string }> };
    return (data.data ?? [])
      .filter((m) => typeof m.id === "string" && m.id.length > 0)
      .map((m) => ({
        id: m.id!,
        ...(m.display_name || m.name ? { displayName: (m.display_name ?? m.name)! } : {}),
      }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "拉取模型列表失败");
  }
}

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

// 当不支持 json_schema strict 模式时，用这个 prompt 明确告诉模型要返回什么结构
const JSON_STRUCTURE_PROMPT = `你必须只返回一个 JSON 对象，不要包含任何其他文字、解释、markdown 代码块标记或思考过程。

JSON 对象必须严格使用以下字段名和结构：
{
  "headline": "一句话标题（字符串）",
  "questionReflection": "对提问者状态的理解（字符串）",
  "cards": [
    {
      "cardId": "牌的ID，如 major-00（字符串）",
      "position": 位置编号1到5（整数）,
      "meaning": "这张牌的含义（字符串）",
      "connectionToQuestion": "这张牌与问题的关联（字符串）"
    }
  ],
  "storyline": "五张牌串联起来的叙事（字符串）",
  "momentumInterpretation": "动量牌的解读（字符串）",
  "valueInterpretation": "价值牌的解读（字符串）",
  "actionAdvice": ["建议1（字符串）", "建议2（字符串）"],
  "reflectionQuestion": "给提问者的反思问题（字符串）",
  "disclaimer": "免责声明（字符串）"
}

注意：cards 数组必须恰好包含 5 个元素，actionAdvice 数组包含 2 到 3 个元素。不要使用其他字段名。`;

// ====== OpenAI Responses API 适配器（保留原有逻辑） ======
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

  // Responses API 不支持文本流式预览，直接走非流式（调用方可据此回退）
  async interpretStream(
    input: TarotInterpretationInput,
    _onProgress: (delta: string, reasoning: string) => void,
  ): Promise<TarotInterpretation> {
    return this.interpret(input);
  }
}

// ====== Chat Completions API 适配器（给国内 / 本地模型用） ======
export class ChatCompletionProvider implements ModelProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      baseUrl: string;
      reasoningSplit: boolean | undefined;
      supportsJsonSchema: boolean | undefined;
      /** 是否支持 strict: true 的 JSON Schema */
      useStrictJsonSchema: boolean | undefined;
    },
  ) {}

  async interpret(input: TarotInterpretationInput): Promise<TarotInterpretation> {
    const rawUrl = this.options.baseUrl.replace(/\/$/, "");

    const systemPrompt =
      "你是一个克制、生活化、有共情力的塔罗解读助手。牌已由本地程序抽取并保存，你只能解释输入，不得换牌、补牌或声称确定预测未来。严格根据牌面、固定分值和方法论输出。\n\n" +
      JSON_STRUCTURE_PROMPT;

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    };

    if (this.options.useStrictJsonSchema !== false && this.options.supportsJsonSchema !== false) {
      // 支持 strict: true 的模型用 json_schema 强制结构化输出
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "tarot_reading",
          strict: true,
          schema: outputSchema,
        },
      };
    } else if (this.options.supportsJsonSchema !== false) {
      // 不支持 strict 但支持 json_object 的模型（如 MiniMax）
      // 用 json_object 模式 + prompt 里写明字段结构
      body.response_format = { type: "json_object" };
    }

    // MiniMax 等模型需要 reasoning_split 分离思考内容到 reasoning_content 字段
    if (this.options.reasoningSplit) {
      body.reasoning_split = true;
    }

    const url = `${rawUrl}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `模型请求失败（${response.status}）`);
    }

    let text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error("模型没有返回可解析的结构化结果");

    // 调试日志：查看模型原始返回
    console.log("[model] 原始 content 前300字符:", text.slice(0, 300));

    // 清洗 reasoning 标签内容（think 标签、reasoning_content 等）
    text = stripReasoningContent(text);

    // 始终尝试从文本中提取 JSON（不管是否用了 json_schema）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON 解析失败，可能是 max_tokens 截断导致 JSON 不完整
      // 尝试补全缺失的括号
      const fixed = text + "}".repeat(text.split("{").length - text.split("}").length);
      try {
        parsed = JSON.parse(fixed);
        console.log("[model] JSON 补全括号后解析成功");
      } catch {
        const preview = text.slice(0, 500);
        throw new Error(`模型返回的内容无法解析为 JSON。前 500 字符：\n${preview}`);
      }
    }

    return interpretationSchema.parse(parsed);
  }

  // ====== 从 maka-agent 的 openai-chat-reasoning-transport.ts 抄的：流式输出 ======
  async interpretStream(
    input: TarotInterpretationInput,
    onProgress: (delta: string, reasoning: string) => void,
  ): Promise<TarotInterpretation> {
    const rawUrl = this.options.baseUrl.replace(/\/$/, "");

    const systemPrompt =
      "你是一个克制、生活化、有共情力的塔罗解读助手。牌已由本地程序抽取并保存，你只能解释输入，不得换牌、补牌或声称确定预测未来。严格根据牌面、固定分值和方法论输出。\n\n" +
      JSON_STRUCTURE_PROMPT;

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      stream: true, // 开启流式输出
    };

    if (this.options.useStrictJsonSchema !== false && this.options.supportsJsonSchema !== false) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "tarot_reading", strict: true, schema: outputSchema },
      };
    } else if (this.options.supportsJsonSchema !== false) {
      body.response_format = { type: "json_object" };
    }

    if (this.options.reasoningSplit) {
      body.reasoning_split = true;
    }

    const url = `${rawUrl}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? `模型请求失败（${response.status}）`);
    }

    if (!response.body) throw new Error("模型没有返回流式响应");

    // 从 maka-agent 的 openAiChatSseNormalizer 抄的 SSE 解析逻辑
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let fullContent = "";
    let fullReasoning = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, newlineIdx).trim();
        buffered = buffered.slice(newlineIdx + 1);

        // 解析 SSE data: 行
        const match = /^data:\s*(.*)$/.exec(line);
        const data = match?.[1];
        if (!data || data === "[DONE]") continue;

        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string; reasoning?: string };
            }>;
          };
          const delta = chunk.choices?.[0]?.delta;
          if (delta) {
            if (delta.content) {
              fullContent += delta.content;
              onProgress(delta.content, "");
            }
            const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
            if (reasoningDelta) {
              fullReasoning += reasoningDelta;
              onProgress("", reasoningDelta);
            }
          }
        } catch {
          // 忽略无法解析的 SSE 行
        }
      }
    }

    // 流式结束后，解析完整 JSON
    let text = stripReasoningContent(fullContent);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const fixed = text + "}".repeat(text.split("{").length - text.split("}").length);
      try {
        parsed = JSON.parse(fixed);
      } catch {
        const preview = text.slice(0, 500);
        throw new Error(`模型返回的内容无法解析为 JSON。前 500 字符：\n${preview}`);
      }
    }

    return interpretationSchema.parse(parsed);
  }
}

// ====== 从 maka-agent 的 model-factory.ts 抄的：工厂函数 ======
export interface ModelProviderOptions {
  providerType: ProviderType;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function createModelProvider(options: ModelProviderOptions): ModelProvider {
  const { providerType, apiKey, model, baseUrl } = options;

  switch (providerType) {
    case "openai":
      // OpenAI 官方走 Responses API（原有逻辑）
      return new OpenAICompatibleProvider({ apiKey, model, baseUrl });

    case "minimax":
    case "minimax-cn":
    case "minimax-coding-plan": {
      // MiniMax 不支持 strict: true，用 json_object 模式 + prompt 引导
      const preset = PROVIDER_PRESETS[providerType];
      return new ChatCompletionProvider({
        apiKey,
        model,
        baseUrl,
        reasoningSplit: preset.reasoningSplit,
        supportsJsonSchema: preset.supportsJsonSchema,
        useStrictJsonSchema: false,
      });
    }

    case "deepseek":
    case "siliconflow":
    case "qwen":
    case "kimi":
    case "tencent":
    case "volcengine":
    case "stepfun":
    case "ollama":
    case "custom":
      return new ChatCompletionProvider({
        apiKey,
        model,
        baseUrl,
        supportsJsonSchema: providerType !== "ollama" ? true : false,
        reasoningSplit: undefined,
        useStrictJsonSchema: providerType !== "ollama" ? true : false,
      });

    default:
      throw new Error(`未知的 Provider 类型: ${providerType}`);
  }
}