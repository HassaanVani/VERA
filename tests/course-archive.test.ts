import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  archiveCourse,
  restoreCourse,
  visibleCourses,
} from "../lib/course-archive";
import { get, put } from "../lib/store";
import type { Packet } from "../lib/contracts";

beforeAll(() => {
  process.env.VERA_DATA_DIR = mkdtempSync(
    path.join(tmpdir(), "vera-course-archive-"),
  );
});
describe("reversible course archive", () => {
  it("hides a course without deleting its sources or historical attempts", () => {
    const packet: Packet = {
      id: "course-a",
      name: "A course",
      fixture: false,
      documents: [],
      createdAt: "2026-11-03",
    };
    put("packet", packet);
    put("attempt", {
      id: "attempt-a",
      examId: "exam-a",
      answers: { "1": "Retain this answer" },
    });
    archiveCourse(packet.id, "Development cleanup");
    expect(visibleCourses()).not.toContainEqual(packet);
    expect(get("packet", packet.id)).toEqual(packet);
    expect(get("attempt", "attempt-a")).toMatchObject({
      answers: { "1": "Retain this answer" },
    });
    restoreCourse(packet.id);
    expect(visibleCourses()).toContainEqual(packet);
  });
  it("leaves unrelated real courses visible", () => {
    put("packet", {
      id: "course-b",
      name: "My biology notes",
      fixture: false,
      documents: [],
      createdAt: "2026-11-03",
    });
    archiveCourse("course-a", "Repeated cleanup");
    expect(visibleCourses().map((p) => p.id)).toContain("course-b");
  });
  it("blocks archiving during an active job", () => {
    put("job", { id: "active-job", packetId: "course-b", status: "running" });
    expect(() => archiveCourse("course-b", "Cleanup")).toThrow(
      /Finish or cancel/,
    );
    expect(visibleCourses().map((p) => p.id)).toContain("course-b");
  });
});
