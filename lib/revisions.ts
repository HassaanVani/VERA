import type { Revision } from "./contracts";

// Record updates include approval invalidation. They must not make an old plan
// appear newer than its replacement, including writes in the same millisecond.
export function orderedRevisions(revisions: Revision[]): Revision[] {
  const byId = new Map(revisions.map((r) => [r.id, r]));
  const depth = (revision: Revision) => {
    const seen = new Set<string>();
    let current: Revision | undefined = revision;
    while (current?.parentRevisionId && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parentRevisionId);
    }
    return seen.size;
  };
  return [...revisions].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || depth(b) - depth(a),
  );
}
