import { getEnv } from "@/lib/env";
import { Errors } from "@/server/errors";

/**
 * AI provider abstraction (Phase 84).
 *
 * Nothing in the app talks to a vendor SDK directly - everything goes through
 * this interface, so switching providers is a config change. The default
 * `openai-compatible` adapter speaks the widely-implemented /chat/completions
 * shape (OpenAI, Azure-compatible gateways, Groq, Together, local vLLM, Ollama
 * with the OpenAI shim, ...). A `mock` provider is available for dev/test so the
 * feature can be exercised deterministically without an API key.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Present on assistant messages that requested tools. */
  toolCalls?: ToolCallRequest[];
  /** Present on tool result messages. */
  toolCallId?: string;
  name?: string;
};

export type ToolCallRequest = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
};

export type ChatRequest = {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
};

export type ChatResponse = {
  content: string;
  toolCalls: ToolCallRequest[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  finishReason: "stop" | "tool_calls" | "length" | "error";
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

// --- OpenAI-compatible provider ----------------------------------------------

type OpenAiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor() {
    const env = getEnv();
    this.model = env.AI_MODEL;
    this.baseUrl = env.AI_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.AI_API_KEY;
    this.timeoutMs = 60_000;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw Errors.dependency("The AI provider is not configured (missing AI_API_KEY).");
    }
    const body = {
      model: this.model,
      messages: request.messages.map(serializeMessage),
      ...(request.tools && request.tools.length
        ? { tools: request.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }
        : {}),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1024,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw Errors.dependency(e instanceof Error && e.name === "AbortError" ? "The AI provider timed out." : "Could not reach the AI provider.");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Never surface the raw provider body (may contain account info).
      throw Errors.dependency(`The AI provider returned an error (HTTP ${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCall[] }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = json.choices?.[0];
    const message = choice?.message ?? {};
    const toolCalls: ToolCallRequest[] = (message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeJson(tc.function.arguments),
    }));

    return {
      content: message.content ?? "",
      toolCalls,
      model: this.model,
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
      finishReason: toolCalls.length ? "tool_calls" : ((choice?.finish_reason as ChatResponse["finishReason"]) ?? "stop"),
    };
  }
}

function serializeMessage(m: ChatMessage) {
  if (m.role === "tool") {
    return { role: "tool", content: m.content, tool_call_id: m.toolCallId };
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })),
    };
  }
  return { role: m.role, content: m.content };
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// --- Mock provider (dev/test) -------------------------------------------------

/**
 * A deterministic provider for development and tests. It echoes the last user
 * message and, when tools are offered and the user text names one, emits a
 * single tool call - which lets the whole tool-permission loop be exercised
 * end-to-end without an external service.
 */
class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "mock-1";
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const lastTool = [...request.messages].reverse().find((m) => m.role === "tool");
    if (lastTool) {
      return {
        content: `Based on the data: ${lastTool.content}`,
        toolCalls: [],
        model: this.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      };
    }
    const text = lastUser?.content ?? "";
    const wanted = request.tools?.find((t) => text.toLowerCase().includes(t.name.toLowerCase()));
    if (wanted) {
      return {
        content: "",
        toolCalls: [{ id: `mock-${Date.now()}`, name: wanted.name, arguments: {} }],
        model: this.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "tool_calls",
      };
    }
    return {
      content: `(mock) You said: ${text}`,
      toolCalls: [],
      model: this.model,
      usage: { inputTokens: 0, outputTokens: 0 },
      finishReason: "stop",
    };
  }
}

// --- Factory ------------------------------------------------------------------

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = env.AI_PROVIDER === "mock" ? new MockProvider() : new OpenAiCompatibleProvider();
  return cached;
}

/** True when a real (non-mock, keyed) provider is configured. */
export function isAiConfigured(): boolean {
  const env = getEnv();
  if (env.AI_PROVIDER === "mock") return true;
  return env.AI_API_KEY.length > 0;
}
