// 从 maka-agent 的 provider-registry.ts + model-factory.ts 抄来的精简版
// Provider 注册表：预设连接配置、错误分类、reasoning 处理

export type ProviderType =
  | "openai"           // OpenAI 官方
  | "minimax"          // MiniMax 国际平台（api.minimax.io）
  | "minimax-cn"       // MiniMax 国内平台（api.minimaxi.com）
  | "minimax-coding-plan" // MiniMax Coding Plan
  | "deepseek"         // DeepSeek
  | "siliconflow"      // 硅基流动（聚合站）
  | "qwen"             // 阿里通义千问（百炼）
  | "kimi"             // 月之暗面 Kimi
  | "tencent"          // 腾讯混元
  | "volcengine"       // 火山引擎
  | "stepfun"          // 阶跃星辰
  | "ollama"           // 本地 Ollama
  | "custom";          // 自定义

export type ProviderCategory = "domestic" | "overseas" | "local" | "custom";

export type ApiProtocol = "openai-chat" | "openai-responses";

export interface ProviderPreset {
  type: ProviderType;
  label: string;
  description: string;
  category: ProviderCategory;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  apiProtocol: ApiProtocol;
  supportsJsonSchema: boolean;
  /** 从 maka-agent 抄的：是否需要在请求中注入 reason 处理 */
  reasoningSplit?: boolean;
  /** 从 maka-agent 抄的：是否在响应中分离 reasoning_details */
  supportsReasoningDetails?: boolean;
  signupUrl?: string;
}

export const PROVIDER_PRESETS: Record<Exclude<ProviderType, "custom">, ProviderPreset> = {
  openai: {
    type: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API",
    category: "overseas",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    recommendedModels: ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4.1-nano"],
    apiProtocol: "openai-responses",
    supportsJsonSchema: true,
    signupUrl: "https://platform.openai.com",
  },
  minimax: {
    type: "minimax",
    label: "MiniMax（国际平台）",
    description: "api.minimax.io，需在 platform.minimax.io 注册的 Key",
    category: "domestic",
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M3",
    recommendedModels: [
      "MiniMax-M3",
      "MiniMax-M2.7",
      "MiniMax-M2.7-highspeed",
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
    ],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    reasoningSplit: true,
    supportsReasoningDetails: true,
    signupUrl: "https://platform.minimax.io",
  },
  "minimax-cn": {
    type: "minimax-cn",
    label: "MiniMax（国内平台）",
    description: "api.minimaxi.com，需在 platform.minimaxi.com 注册的 Key",
    category: "domestic",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M3",
    recommendedModels: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    reasoningSplit: true,
    supportsReasoningDetails: true,
    signupUrl: "https://platform.minimaxi.com",
  },
  "minimax-coding-plan": {
    type: "minimax-coding-plan",
    label: "MiniMax Coding Plan",
    description: "Coding Plan 订阅用户，使用 sk-cp- 开头的 Subscription Key（与标准 MiniMax 同一端点）",
    category: "domestic",
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M3",
    recommendedModels: ["MiniMax-M3", "MiniMax-M2.7"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    reasoningSplit: true,
    supportsReasoningDetails: true,
    signupUrl: "https://platform.minimax.io/subscribe/coding-plan",
  },
  deepseek: {
    type: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek 官方 API，支持 V3/R1 等模型",
    category: "domestic",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    recommendedModels: ["deepseek-chat", "deepseek-reasoner"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://platform.deepseek.com",
  },
  siliconflow: {
    type: "siliconflow",
    label: "硅基流动 SiliconFlow",
    description: "聚合平台，可调用 MiniMax/Kimi/Qwen 等 100+ 模型",
    category: "domestic",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "MiniMaxAI/MiniMax-M3",
    recommendedModels: [
      "MiniMaxAI/MiniMax-M3",
      "moonshotai/Kimi-K2.6",
      "Qwen/Qwen2.5-72B-Instruct",
      "deepseek-ai/DeepSeek-V3",
    ],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://siliconflow.cn",
  },
  qwen: {
    type: "qwen",
    label: "阿里百炼（通义千问）",
    description: "阿里云百炼平台，支持 Qwen 系列模型",
    category: "domestic",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    recommendedModels: ["qwen-plus", "qwen-max", "qwen-turbo"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://bailian.console.aliyun.com",
  },
  kimi: {
    type: "kimi",
    label: "月之暗面 Kimi",
    description: "Kimi 官方 API，支持 k2.6/k3 等模型",
    category: "domestic",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    recommendedModels: ["kimi-k2.6", "kimi-k3", "kimi-latest"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://platform.moonshot.cn",
  },
  tencent: {
    type: "tencent",
    label: "腾讯混元 HunYuan",
    description: "腾讯混元大模型 API",
    category: "domestic",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbo",
    recommendedModels: ["hunyuan-turbo", "hunyuan-pro", "hunyuan-standard"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://console.cloud.tencent.com/hunyuan",
  },
  volcengine: {
    type: "volcengine",
    label: "火山引擎",
    description: "火山引擎方舟平台，支持豆包/DeepSeek/MiniMax 等",
    category: "domestic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2.0-pro",
    recommendedModels: [
      "doubao-seed-2.0-pro",
      "doubao-seed-2.0-lite",
      "deepseek-v4-flash",
      "minimax-m2.7",
    ],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://console.volcengine.com/ark",
  },
  stepfun: {
    type: "stepfun",
    label: "阶跃星辰 StepFun",
    description: "阶跃星辰 Step 系列模型 API",
    category: "domestic",
    baseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-3.7-flash",
    recommendedModels: ["step-3.7-flash", "step-3.5-flash"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: true,
    signupUrl: "https://platform.stepfun.com",
  },
  ollama: {
    type: "ollama",
    label: "Ollama（本地）",
    description: "本地运行的开源模型，需本地部署 Ollama 服务",
    category: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5:7b",
    recommendedModels: ["qwen2.5:7b", "qwen2.5:14b", "llama3.2:3b", "deepseek-r1:7b"],
    apiProtocol: "openai-chat",
    supportsJsonSchema: false,
    signupUrl: "https://ollama.ai",
  },
};

export function applyProviderPreset(
  type: ProviderType,
): { providerType: ProviderType; baseUrl: string; model: string } {
  if (type === "custom") {
    return { providerType: type, baseUrl: "", model: "" };
  }
  const preset = PROVIDER_PRESETS[type];
  return {
    providerType: type,
    baseUrl: preset.baseUrl,
    model: preset.defaultModel,
  };
}

// ====== 从 maka-agent 抄的：错误分类（provider-error-classification.ts） ======

export interface ClassifiedError {
  kind: "auth" | "rate_limit" | "server_error" | "timeout" | "json_parse" | "unknown";
  userMessage: string;
  retryable: boolean;
}

export function classifyModelError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("authentication")) {
    return { kind: "auth", userMessage: "API Key 无效或已过期，请检查设置", retryable: false };
  }
  if (lower.includes("403") || lower.includes("forbidden") || lower.includes("insufficient") || lower.includes("quota")) {
    return { kind: "auth", userMessage: "无权限或余额不足，请检查账户状态", retryable: false };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { kind: "rate_limit", userMessage: "请求过于频繁，请稍后重试", retryable: true };
  }
  if (lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("service unavailable") || lower.includes("bad gateway") || lower.includes("server error")) {
    return { kind: "server_error", userMessage: "模型服务暂时不可用，请稍后重试", retryable: true };
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("econnrefused") || lower.includes("fetch failed") || lower.includes("network")) {
    return { kind: "timeout", userMessage: "网络连接超时，请检查网络或 API 地址", retryable: true };
  }
  if (lower.includes("json") && (lower.includes("parse") || lower.includes("invalid"))) {
    return { kind: "json_parse", userMessage: "模型返回内容格式异常，可能是不支持 JSON Schema 的模型", retryable: false };
  }
  return { kind: "unknown", userMessage: message, retryable: true };
}

// ====== 从 maka-agent 抄的：reasoning 内容清洗（model-factory.ts 精简版） ======

/**
 * 清理助手消息中的 reasoning 内容。
 * 某些模型（DeepSeek、MiniMax）会在 content 中嵌入 ` 思考` 标签，
 * 或者返回 `reasoning_content` 字段，需要剥离后才能正确解析 JSON。
 */
export function stripReasoningContent(text: string): string {
  // 从 maka-agent 的 openai-chat-reasoning-transport.ts 抄来的清洗逻辑
  let cleaned = text;
  // 1. 移除 think 标签及其内容
  const thinkEndTag = /<\/?think>/gi;
  if (thinkEndTag.test(cleaned)) {
    cleaned = cleaned.replace(/^[\s\S]*?<\/?think>/gi, "").trim();
  }
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  cleaned = cleaned.replace(/^[\s\S]*? reasoning[\s\S]*?(?=\{)/, "").trim();
  // 2. 如果 think 标签在开头，去掉 before 部分
  const tStart = cleaned.search(/<thinking>| thinking/i);
  if (tStart >= 0) {
    const tEnd = cleaned.search(/<\/thinking>|<\/think>/i);
    if (tEnd >= 0) cleaned = cleaned.slice(tEnd + 11).trim();
  }
  // 3. 移除 reasoning_content 行
  if (cleaned.includes("reasoning_content")) {
    cleaned = cleaned.split("\n").filter((l) => !l.trim().startsWith('"reasoning_content"')).join("\n").trim();
  }
  // 4. 取 JSON 部分
  const jm = cleaned.match(/\{[\s\S]*\}/);
  return jm ? jm[0] : cleaned;
}