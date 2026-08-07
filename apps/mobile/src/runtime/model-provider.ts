import { interpretationSchema, type TarotInterpretation, type TarotInterpretationInput } from "@tarot/core";
import type { ModelProvider } from "@tarot/runtime";
import type { MobileSettings } from "./credentials";

// 手机端模型适配器：走标准 OpenAI 兼容 /chat/completions（含 SSE 流式）。
// 逻辑对齐桌面端 model.ts 的 ChatCompletionProvider，但用浏览器 fetch。

const SYSTEM_PROMPT =
  "你是一个克制、生活化、有共情力的塔罗解读助手。牌已由本地程序抽取并保存，你只能解释输入，不得换牌、补牌或声称确定预测未来。严格根据牌面、固定分值和方法论输出。";

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

function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function parseInterpretation(raw: string): TarotInterpretation {
  let text = stripReasoning(raw);
  const match = text.match(/\{[\s\S]*\}/);
  if (match) text = match[0];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // max_tokens 截断导致括号不齐时尝试补全
    const fixed = text + "}".repeat(Math.max(0, text.split("{").length - text.split("}").length));
    parsed = JSON.parse(fixed);
  }
  return interpretationSchema.parse(parsed);
}

export interface FetchProviderOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export class FetchChatCompletionProvider implements ModelProvider {
  constructor(private readonly options: FetchProviderOptions) {}

  private endpoint(): string {
    return `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private buildBody(input: TarotInterpretationInput, stream: boolean): Record<string, unknown> {
    return {
      model: this.options.model,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${JSON_STRUCTURE_PROMPT}` },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      ...(stream ? { stream: true } : {}),
    };
  }

  async interpret(input: TarotInterpretationInput): Promise<TarotInterpretation> {
    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify(this.buildBody(input, false)),
    });
    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) throw new Error(payload.error?.message ?? `模型请求失败（${response.status}）`);
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error("模型没有返回可解析的结构化结果");
    return parseInterpretation(text);
  }

  async interpretStream(
    input: TarotInterpretationInput,
    onProgress: (delta: string, reasoning: string) => void,
  ): Promise<TarotInterpretation> {
    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify(this.buildBody(input, true)),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? `模型请求失败（${response.status}）`);
    }
    if (!response.body) throw new Error("模型没有返回流式响应");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let fullContent = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);
        const match = /^data:\s*(.*)$/.exec(line);
        const data = match?.[1];
        if (!data || data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string; reasoning?: string } }>;
          };
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onProgress(delta.content, "");
          }
          const reasoning = delta?.reasoning_content ?? delta?.reasoning;
          if (reasoning) onProgress("", reasoning);
        } catch {
          // 忽略无法解析的 SSE 行
        }
      }
    }

    return parseInterpretation(fullContent);
  }
}

export function createProvider(settings: MobileSettings, apiKey: string): ModelProvider {
  return new FetchChatCompletionProvider({ apiKey, model: settings.model, baseUrl: settings.baseUrl });
}

/** 测试连接：发一条极短请求验证 baseUrl / model / token 是否可用。 */
export async function testConnection(settings: MobileSettings, apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey) return { ok: false, message: "尚未配置 API Token" };
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: "reply with ok" }], max_tokens: 10, temperature: 0 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, message: `${payload.error?.message ?? `HTTP ${response.status}`}` };
    }
    return { ok: true, message: "连接成功 ✅" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "连接失败" };
  }
}

/** 手机端内置的少量 Provider 预设（可在设置里快速切换 baseUrl + 默认模型）。 */
export interface MobilePreset {
  type: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export const MOBILE_PRESETS: MobilePreset[] = [
  { type: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"] },
  { type: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", models: ["deepseek-chat", "deepseek-reasoner"] },
  { type: "kimi", label: "Kimi (Moonshot)", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k", models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
  { type: "qwen", label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", models: ["qwen-plus", "qwen-turbo", "qwen-max"] },
  { type: "custom", label: "自定义 API", baseUrl: "", defaultModel: "", models: [] },
];
