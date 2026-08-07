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

/** 手机端内置的 Provider 预设（与桌面端 provider-registry.ts 的 PROVIDER_PRESETS 完全一致，只是字段名做了浏览器端适配）。
 *  直接复刻桌面，不裁剪。 */
export type MobileProviderCategory = "domestic" | "overseas" | "local" | "custom";

export interface MobilePreset {
  type: string;
  label: string;
  description: string;
  category: MobileProviderCategory;
  baseUrl: string;
  defaultModel: string;
  /** 与桌面 recommendedModels 对齐 */
  models: string[];
  signupUrl?: string;
}

export const MOBILE_PRESETS: MobilePreset[] = [
  {
    type: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API",
    category: "overseas",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    models: ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4.1-nano"],
    signupUrl: "https://platform.openai.com",
  },
  {
    type: "minimax",
    label: "MiniMax（国际平台）",
    description: "api.minimax.io，需在 platform.minimax.io 注册的 Key",
    category: "domestic",
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M3",
    models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.1"],
    signupUrl: "https://platform.minimax.io",
  },
  {
    type: "minimax-cn",
    label: "MiniMax（国内平台）",
    description: "api.minimaxi.com，需在 platform.minimaxi.com 注册的 Key",
    category: "domestic",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M3",
    models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1"],
    signupUrl: "https://platform.minimaxi.com",
  },
  {
    type: "minimax-coding-plan",
    label: "MiniMax Coding Plan",
    description: "Coding Plan 订阅用户，使用 sk-cp- 开头的 Subscription Key（与标准 MiniMax 同一端点）",
    category: "domestic",
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M3",
    models: ["MiniMax-M3", "MiniMax-M2.7"],
    signupUrl: "https://platform.minimax.io/subscribe/coding-plan",
  },
  {
    type: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek 官方 API，支持 V3/R1 等模型",
    category: "domestic",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    signupUrl: "https://platform.deepseek.com",
  },
  {
    type: "siliconflow",
    label: "硅基流动 SiliconFlow",
    description: "聚合平台，可调用 MiniMax/Kimi/Qwen 等 100+ 模型",
    category: "domestic",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "MiniMaxAI/MiniMax-M3",
    models: ["MiniMaxAI/MiniMax-M3", "moonshotai/Kimi-K2.6", "Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-V3"],
    signupUrl: "https://siliconflow.cn",
  },
  {
    type: "qwen",
    label: "阿里百炼（通义千问）",
    description: "阿里云百炼平台，支持 Qwen 系列模型",
    category: "domestic",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    signupUrl: "https://bailian.console.aliyun.com",
  },
  {
    type: "kimi",
    label: "月之暗面 Kimi",
    description: "Kimi 官方 API，支持 k2.6/k3 等模型",
    category: "domestic",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    models: ["kimi-k2.6", "kimi-k3", "kimi-latest"],
    signupUrl: "https://platform.moonshot.cn",
  },
  {
    type: "tencent",
    label: "腾讯混元 HunYuan",
    description: "腾讯混元大模型 API",
    category: "domestic",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbo",
    models: ["hunyuan-turbo", "hunyuan-pro", "hunyuan-standard"],
    signupUrl: "https://console.cloud.tencent.com/hunyuan",
  },
  {
    type: "volcengine",
    label: "火山引擎",
    description: "火山引擎方舟平台，支持豆包/DeepSeek/MiniMax 等",
    category: "domestic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2.0-pro",
    models: ["doubao-seed-2.0-pro", "doubao-seed-2.0-lite", "deepseek-v4-flash", "minimax-m2.7"],
    signupUrl: "https://console.volcengine.com/ark",
  },
  {
    type: "stepfun",
    label: "阶跃星辰 StepFun",
    description: "阶跃星辰 Step 系列模型 API",
    category: "domestic",
    baseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-3.7-flash",
    models: ["step-3.7-flash", "step-3.5-flash"],
    signupUrl: "https://platform.stepfun.com",
  },
  {
    type: "ollama",
    label: "Ollama（本地）",
    description: "本地运行的开源模型，需本地部署 Ollama 服务",
    category: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5:7b",
    models: ["qwen2.5:7b", "qwen2.5:14b", "llama3.2:3b", "deepseek-r1:7b"],
    signupUrl: "https://ollama.ai",
  },
  {
    type: "custom",
    label: "自定义 API",
    description: "填入任意 OpenAI 兼容端点的 Base URL 与模型名",
    category: "custom",
    baseUrl: "",
    defaultModel: "",
    models: [],
  },
];
