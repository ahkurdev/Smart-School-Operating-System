"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAction } from "@/features/search/actions";
import type { SearchHit } from "@/server/services/search.service";
import { GraduationCap, Users, School, BookOpen, UserCog, UserRound } from "lucide-react";

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  student: "Students",
  teacher: "Teachers",
  class: "Classes",
  subject: "Subjects",
  guardian: "Guardians",
  user: "Users",
  applicant: "Applicants",
  page: "Pages",
};

const TYPE_ICON: Record<SearchHit["type"], React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  teacher: UserCog,
  class: School,
  subject: BookOpen,
  guardian: UserRound,
  user: Users,
  applicant: Users,
  page: BookOpen,
};

/**
 * Global command palette (Cmd/Ctrl+K). Search runs server-side and is
 * permission-aware: types the user cannot read are never queried. Navigation is
 * client-side; no results are cached across users.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchAction(q);
      if (id === reqId.current) {
        setHits(res);
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const grouped = hits.reduce<Record<string, SearchHit[]>>((acc, h) => {
    (acc[h.type] ??= []).push(h);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search students, teachers, classes…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Type at least two characters to search.
          </div>
        ) : loading && hits.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</div>
        ) : hits.length === 0 ? (
          <CommandEmpty>No matches found.</CommandEmpty>
        ) : (
          Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICON[type as SearchHit["type"]];
            return (
              <CommandGroup key={type} heading={TYPE_LABEL[type as SearchHit["type"]]}>
                {items.map((h) => (
                  <CommandItem
                    key={`${h.type}-${h.id}`}
                    value={`${h.type}-${h.id}`}
                    onSelect={() => go(h.href)}
                  >
                    <Icon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{h.title}</span>
                    {h.subtitle ? (
                      <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                        {h.subtitle}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}
