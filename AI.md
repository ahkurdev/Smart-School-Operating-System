# AI Assistant

The AI assistant is a **permission-aware** helper for admins, teachers and
students. It is a supporting feature, never a replacement for the UI: critical
actions (deleting a student, publishing grades, accepting an applicant,
reversing a payment) always go through explicit, authorised UI flows.

## Provider abstraction

Nothing talks to a vendor SDK directly. `src/server/ai/provider.ts` defines a
provider interface; the default adapter speaks the **OpenAI-compatible chat
completions API**, so any compatible endpoint works.

```
AI_PROVIDER=openai-compatible   # or `mock` for deterministic offline/dev/testing
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
AI_MAX_TOOL_CALLS=6
```

The `mock` provider returns deterministic canned responses and enables the
assistant to be tested with no network and no key.

## Tools, not raw database access

The model never gets a database connection. It can only call **registered
tools** (`src/server/ai/tools.ts`). Every tool:

1. is offered only if the calling actor holds the permission the tool requires
   (`tool.requiredPermission`), and
2. **re-checks** that permission and the tenant at execution time — so a
   permission change mid-conversation cannot be bypassed.

Example tools: `searchStudent`, `getAttendanceSummary`, `getClassSchedule`,
`getAcademicStatistics`, `listPendingApplicants`, `draftAnnouncement`.

Because tools delegate to the same permission-checked services as the UI, the
assistant can only ever see data the user could already see. It cannot invent
numbers: answers are grounded in tool results, and the UI shows which tools ran.

## Guardrails (`src/server/ai/assistant.service.ts`)

- Role-aware system prompt (admin / teacher / student personas).
- Tool allow-list filtered by permission.
- Hard cap on tool calls per turn (`AI_MAX_TOOL_CALLS`).
- Tool argument validation.
- No PII in the QR/attendance path; sensitive fields stay behind permissions.
- Prompt-injection resistance: tool results are treated as data; the model
  cannot escalate its own permissions.

## Audit

Every turn is persisted and auditable: `AIConversation`, `AIMessage`,
`AIToolCall` (which tool, which arguments, whether it succeeded) and `AIUsage`
(tokens, latency where available). Secrets and raw sensitive prompts are not
stored.

## Student assistant limits

The student persona can explain provided material, summarise teacher content and
explain assignment instructions. It cannot help with an active exam, cannot see
other students' grades, and cannot reach admin data.

## Testing

`npm run test:ai` runs against the `mock` provider and asserts: tools are
filtered by permission, execution re-authorises, the tool-call cap is enforced,
and a user cannot read another user's conversation.
