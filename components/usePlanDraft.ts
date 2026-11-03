"use client";
import { useState } from "react";
import type { Blueprint, Revision } from "@/lib/contracts";
import { EditableDraft } from "@/lib/plan-editor";

function load(revision?: Revision) {
  let value = revision ? structuredClone(revision.blueprint) : undefined;
  let notice = "";
  if (revision)
    try {
      const saved = EditableDraft.safeParse(
        JSON.parse(localStorage.getItem(`vera:plan:${revision.id}`) || "null"),
      );
      if (saved.success) {
        value = saved.data;
        notice = "Recovered your unfinished edits from this browser.";
      }
    } catch {
      /* The server's saved plan remains available. */
    }
  return { id: revision?.id, value, notice };
}
export default function usePlanDraft(revision?: Revision) {
  const [snapshot, setSnapshot] = useState(() => load(revision));
  // Reset draft state together when a different server revision is selected.
  if (snapshot.id !== revision?.id) setSnapshot(load(revision));
  function edit(value: Blueprint) {
    let notice = "";
    if (revision)
      try {
        localStorage.setItem(`vera:plan:${revision.id}`, JSON.stringify(value));
      } catch {
        notice =
          "Edits are kept in this tab only. Save your draft before leaving.";
      }
    setSnapshot({ id: revision?.id, value, notice });
  }
  function reset() {
    if (!revision) return;
    try {
      localStorage.removeItem(`vera:plan:${revision.id}`);
    } catch {}
    setSnapshot({
      id: revision.id,
      value: structuredClone(revision.blueprint),
      notice: "Edits discarded. The saved plan is restored.",
    });
  }
  return { draft: snapshot.value, notice: snapshot.notice, edit, reset };
}
