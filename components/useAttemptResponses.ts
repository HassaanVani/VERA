"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attempt } from "@/lib/contracts";

export default function useAttemptResponses(
  attempt: Attempt,
  update: (path: string, body: unknown) => Promise<unknown>,
) {
  const key = `vera:responses:${attempt.id}`;
  const [initial] = useState(() => {
    try {
      const cached: unknown = JSON.parse(localStorage.getItem(key) || "null");
      if (
        cached &&
        typeof cached === "object" &&
        Object.values(cached).every((v) => typeof v === "string") &&
        Date.now() < attempt.endsAt
      )
        return {
          responses: {
            ...attempt.responses,
            ...(cached as Record<string, string>),
          },
          restored: true,
        };
    } catch {
      /* Browser backup is optional. */
    }
    return { responses: attempt.responses, restored: false };
  });
  const [responses, setResponses] = useState(initial.responses);
  const [status, setStatus] = useState<
    "saved" | "unsaved" | "saving" | "error"
  >(initial.restored ? "unsaved" : "saved");
  const [error, setError] = useState("");
  const latest = useRef(initial.responses),
    version = useRef(initial.restored ? 1 : 0),
    acknowledged = useRef(0);
  const chain = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const snapshot = latest.current,
      revision = version.current;
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        if (acknowledged.current >= revision) return;
        setStatus("saving");
        try {
          if (Date.now() >= attempt.endsAt)
            throw new Error(
              "Time is up. Only responses saved before the deadline count.",
            );
          const saved = (await update(`attempts/${attempt.id}`, {
            responses: snapshot,
          })) as Attempt;
          if (
            saved.responses &&
            Object.entries(snapshot).some(
              ([number, response]) => saved.responses[number] !== response,
            )
          )
            throw new Error(
              "The attempt closed before your latest answer was saved. Only previously saved responses will count.",
            );
          acknowledged.current = revision;
          if (version.current === revision) {
            setStatus("saved");
            setError("");
            try {
              localStorage.removeItem(key);
            } catch {
              /* Server save remains valid. */
            }
          }
        } catch (cause) {
          setStatus("error");
          setError(
            cause instanceof Error
              ? cause.message
              : "Your answer could not be saved.",
          );
          throw cause;
        }
      });
    return chain.current;
  }, [attempt.id, attempt.endsAt, key, update]);

  useEffect(() => {
    if (initial.restored)
      timer.current = setTimeout(() => {
        void flush().catch(() => {});
      }, 650);
    return () => clearTimeout(timer.current);
  }, [initial.restored, flush]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (version.current > acknowledged.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  function answer(number: number, value: string) {
    if (Date.now() >= attempt.endsAt) return;
    latest.current = { ...latest.current, [number]: value };
    version.current++;
    setResponses(latest.current);
    setStatus("unsaved");
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch {
      /* Keep in memory until the server acknowledges. */
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 650);
  }
  return {
    responses,
    status,
    error,
    answer,
    flush,
    waitForSave: () => chain.current.catch(() => {}),
  };
}
