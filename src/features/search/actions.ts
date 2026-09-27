"use server";

import { requireActor } from "@/server/auth/context";
import { globalSearch, type SearchHit } from "@/server/services/search.service";

/** Palette search. Returns [] on any error rather than throwing into the UI. */
export async function searchAction(query: string): Promise<SearchHit[]> {
  try {
    const actor = await requireActor();
    return await globalSearch(actor, query);
  } catch {
    return [];
  }
}
