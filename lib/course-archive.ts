import type { Job, Packet } from "./contracts";
import { get, list, put, transaction } from "./store";

type Archive = {
  id: string;
  packetId: string;
  reason: string;
  archivedAt: string;
  restoredAt?: string;
};
export function visibleCourses() {
  const hidden = new Set(
    list<Archive>("course-archive")
      .filter((a) => !a.restoredAt)
      .map((a) => a.packetId),
  );
  return list<Packet>("packet").filter((p) => !hidden.has(p.id));
}
export function archiveCourse(packetId: string, reason: string) {
  return transaction(() => {
    if (!get<Packet>("packet", packetId)) throw new Error("Course not found.");
    if (
      list<Job>("job").some(
        (j) =>
          j.packetId === packetId && ["running", "queued"].includes(j.status),
      )
    )
      throw new Error("Finish or cancel the course job before archiving.");
    return put<Archive>("course-archive", {
      id: `course-archive:${packetId}`,
      packetId,
      reason,
      archivedAt: new Date().toISOString(),
    });
  });
}
export function restoreCourse(packetId: string) {
  const record = get<Archive>("course-archive", `course-archive:${packetId}`);
  if (!record) throw new Error("Archived course not found.");
  return put("course-archive", {
    ...record,
    restoredAt: new Date().toISOString(),
  });
}
