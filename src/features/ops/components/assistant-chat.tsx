"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { askAssistantAction, type AssistantActionResult } from "@/features/ops/assistant-actions";

type Turn = { role: "user" | "assistant"; content: string; tools?: { name: string }[] };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      <Send className="size-4" aria-hidden /> {pending ? "Thinking…" : "Ask"}
    </Button>
  );
}

export function AssistantChat({ context, tools }: { context: "admin" | "teacher" | "student" | "parent"; tools: string[] }) {
  const [state, action] = useActionState<AssistantActionResult | null, FormData>(askAssistantAction, null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingMessage, setPendingMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const conversationRef = useRef<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.ok) {
      conversationRef.current = state.reply.conversationId;
      setTurns((prev) => [...prev, { role: "assistant", content: state.reply.content, tools: state.reply.toolCalls.map((t) => ({ name: t.name })) }]);
      setPendingMessage("");
    }
  }, [state]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pendingMessage]);

  return (
    <div className="space-y-4">
      {turns.length > 0 || pendingMessage ? (
        <div className="space-y-3" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={t.role === "user" ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[85%] rounded-lg border border-border bg-surface px-3 py-2 text-sm"}>
                <p className="whitespace-pre-wrap">{t.content}</p>
                {t.tools && t.tools.length > 0 ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="size-3" aria-hidden /> used: {t.tools.map((x) => x.name).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {pendingMessage ? (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{pendingMessage}</div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      ) : null}

      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        ref={formRef}
        action={action}
        className="space-y-2"
        onSubmit={(e) => {
          const fd = new FormData(e.currentTarget);
          setPendingMessage(String(fd.get("message") ?? ""));
        }}
      >
        <input type="hidden" name="context" value={context} />
        <input type="hidden" name="conversationId" value={conversationRef.current} />
        <Label htmlFor="assistant-message" className="sr-only">
          Your message
        </Label>
        <Textarea id="assistant-message" name="message" rows={3} required placeholder="Ask about attendance, enrollment, a class, or a student…" maxLength={4000} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {tools.length ? `Tools available to you: ${tools.join(", ")}` : "No tools are available to your role."}
          </p>
          <SendButton />
        </div>
      </form>
    </div>
  );
}
