import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { getEnv } from "@/lib/env";
import { getAiProvider, isAiConfigured, type ChatMessage, type ToolCallRequest } from "@/server/ai/provider";
import { AI_TOOLS, toolSchemasFor, findTool, type AiTool } from "@/server/ai/tools";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * AI assistant orchestration (Phases 86-89).
 *
 * The agent loop: send messages + the actor's permitted tool schemas, execute any
 * tool the model asks for (re-checking the permission at call time), feed results
 * back, and repeat until the model answers or the tool-call budget is spent.
 *
 * Guardrails enforced here:
 *   - the model only ever sees tools the actor is permitted to use;
 *   - a tool is re-authorised at execution time (defence against a tampered name);
 *   - a hard cap on tool calls per turn (AI_MAX_TOOL_CALLS);
 *   - every turn and every tool call is audited (AI audit log, Phase 89);
 *   - the system prompt is role-aware and forbids inventing data.
 */

export type AiContext = "admin" | "teacher" | "student" | "parent";

const SYSTEM_PROMPTS: Record<AiContext, string> = {
  admin:
    "You are the school operations assistant for an administrator. Answer only from the data returned by the tools you call. " +
    "If the tools return no data, say so plainly - never invent numbers, names or trends. Prefer concise summaries with the data period stated.",
  teacher:
    "You are the teaching assistant for a teacher. Use the tools to summarise class performance and attendance. " +
    "Never claim a fact you did not get from a tool. You cannot change grades; you may only summarise and draft.",
  student:
    "You are the study assistant for a student. Explain learning material, summarise teacher-provided content, and help with study plans. " +
    "You must not reveal other students' data, and you must not do a student's active exam for them. Answer from the tools available.",
  parent:
    "You are the family assistant for a parent or guardian. You may only discuss the children linked to this account. " +
    "Never reveal other students' data. Answer from the tools available and state the data period.",
};

export type RunAssistantInput = {
  context: AiContext;
  message: string;
  conversationId?: string;
};

export type AssistantReply = {
  conversationId: string;
  content: string;
  toolCalls: { name: string; arguments: Record<string, unknown>; summary: string; succeeded: boolean }[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

/** Run one assistant turn, creating or continuing a conversation. */
export async function runAssistant(actor: Actor, input: RunAssistantInput): Promise<AssistantReply> {
  authorize(actor, "ai.use");
  const tenantId = requireTenantId(actor);
  if (!isAiConfigured()) {
    throw Errors.dependency("The AI assistant is not configured. Set AI_PROVIDER=mock or provide AI_API_KEY.");
  }
  const message = input.message.trim();
  if (!message) throw Errors.validation("Please type a message.");
  if (message.length > 4000) throw Errors.validation("Message is too long.");

  const env = getEnv();
  const maxToolCalls = Math.max(1, env.AI_MAX_TOOL_CALLS);

  // Resolve or create the conversation (scoped to the actor + tenant).
  const conversation = input.conversationId
    ? await prisma.aIConversation.findFirst({ where: { id: input.conversationId, tenantId, userId: actor.userId }, select: { id: true } })
    : null;
  const conversationId =
    conversation?.id ??
    (
      await prisma.aIConversation.create({
        data: { tenantId, userId: actor.userId, title: message.slice(0, 80), context: input.context },
        select: { id: true },
      })
    ).id;

  // Persist the user's message.
  await prisma.aIMessage.create({
    data: { tenantId, conversationId, role: "user", content: message },
  });

  // Load recent history (last 12 messages) for context continuity.
  const history = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { role: true, content: true },
  });
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPTS[input.context] },
    ...history.reverse().map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
  ];

  const provider = getAiProvider();
  const tools = toolSchemasFor(actor, input.context);
  const executed: AssistantReply["toolCalls"] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let toolCallsUsed = 0;
  let finalContent = "";
  let model = provider.model;

  for (let step = 0; step < maxToolCalls + 1; step++) {
    const response = await provider.chat({ messages, tools, temperature: 0.2, maxTokens: 1024 });
    model = response.model;
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    if (response.toolCalls.length === 0) {
      finalContent = response.content;
      break;
    }

    // Record the assistant's tool-request turn so the transcript matches.
    messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      if (toolCallsUsed >= maxToolCalls) {
        messages.push({ role: "tool", toolCallId: call.id, content: "Tool budget exhausted; answer with what you have." });
        continue;
      }
      toolCallsUsed++;
      const result = await executeTool(actor, call);
      executed.push({ name: call.name, arguments: call.arguments, summary: result.summary, succeeded: result.ok });
      messages.push({ role: "tool", toolCallId: call.id, content: result.serialized });

      const assistantMsg = await prisma.aIMessage.create({ data: { tenantId, conversationId, role: "assistant", content: "", model }, select: { id: true } });
      await prisma.aIToolCall.create({
        data: {
          tenantId,
          messageId: assistantMsg.id,
          toolName: call.name,
          arguments: call.arguments as never,
          resultSummary: result.summary.slice(0, 500),
          succeeded: result.ok,
        },
      });
    }

    if (step === maxToolCalls) {
      finalContent = "I reached the tool-call limit for this question. Here is what I gathered so far.";
      break;
    }
  }

  // Persist the final assistant answer.
  await prisma.aIMessage.create({ data: { tenantId, conversationId, role: "assistant", content: finalContent, model, tokenIn: usage.inputTokens, tokenOut: usage.outputTokens } });
  await prisma.aIUsage.create({ data: { tenantId, userId: actor.userId, model, tokenIn: usage.inputTokens, tokenOut: usage.outputTokens } });

  await recordAudit({
    actor: { ...actor, actorType: "ai" as never },
    action: "ai.assistant.turn",
    resource: "AIConversation",
    resourceId: conversationId,
    metadata: { context: input.context, tools: executed.map((e) => e.name), model },
  });

  return { conversationId, content: finalContent, toolCalls: executed, model, usage };
}

/** Execute one tool call, re-checking the permission and never leaking errors. */
async function executeTool(actor: Actor, call: ToolCallRequest): Promise<{ ok: boolean; serialized: string; summary: string }> {
  const tool = findTool(call.name);
  if (!tool) {
    return { ok: false, serialized: "This tool is not available.", summary: "unknown tool" };
  }
  // Re-authorise: the model must not be able to invoke a tool the actor lacks.
  if (!actor.permissions.has(tool.permission) && !actor.isPlatform) {
    return { ok: false, serialized: "You are not permitted to use that tool.", summary: "forbidden" };
  }
  try {
    const data = await tool.handler({ actor }, call.arguments);
    const serialized = JSON.stringify(data);
    return { ok: true, serialized: serialized.slice(0, 4000), summary: summarise(tool.name, data) };
  } catch {
    // A tool failing (e.g. not-found, forbidden at the service layer) is not a
    // crash - return a neutral message the model can recover from.
    return { ok: false, serialized: "That lookup did not return any data.", summary: "no data" };
  }
}

function summarise(name: string, data: unknown): string {
  if (data && typeof data === "object") {
    const keys = Object.keys(data as Record<string, unknown>);
    return `${name} -> {${keys.slice(0, 8).join(", ")}}`;
  }
  return `${name} -> ok`;
}

/** The set of tools the actor can currently use (for the UI to describe). */
export function availableToolNames(actor: Actor, context: AiContext): string[] {
  return AI_TOOLS.filter((t) => (actor.permissions.has(t.permission) || actor.isPlatform) && t.contexts.includes(context)).map((t) => t.name);
}

/** Recent conversations for the actor, for a history list. */
export async function listConversations(actor: Actor, limit = 20) {
  authorize(actor, "ai.use");
  const tenantId = requireTenantId(actor);
  return prisma.aIConversation.findMany({
    where: { tenantId, userId: actor.userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, context: true, updatedAt: true },
  });
}

export async function getConversation(actor: Actor, id: string) {
  authorize(actor, "ai.use");
  const tenantId = requireTenantId(actor);
  const convo = await prisma.aIConversation.findFirst({
    where: { id, tenantId, userId: actor.userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!convo) throw Errors.notFound("Conversation not found.");
  return convo;
}

export type { AiTool };
