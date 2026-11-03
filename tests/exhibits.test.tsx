import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Exhibits, { TransformationDiagram } from "../components/Exhibits";
import { demoScenario } from "../lib/demo-client";
import type { Exam } from "../lib/contracts";

const table: NonNullable<Exam["exhibits"]>[number] = {
  id: "measurements",
  kind: "table",
  title: "Measured values",
  content: "Original synthetic measurements",
  columns: ["Sample", "Value"],
  rows: [
    ["A", "2"],
    ["B", "3"],
  ],
  points: [],
  synthetic: true,
};

describe("structured supporting material", () => {
  it("hides an unused desk and filters references to relevant material", () => {
    expect(renderToStaticMarkup(<Exhibits />)).toBe("");
    expect(
      renderToStaticMarkup(<Exhibits exhibits={[table]} ids={["other"]} />),
    ).toBe("");
    const markup = renderToStaticMarkup(
      <Exhibits exhibits={[table]} ids={[table.id]} />,
    );
    expect(markup).not.toContain('role="tablist"');
    expect(markup).toContain('role="region"');
    expect(
      renderToStaticMarkup(
        <Exhibits exhibits={[table, { ...table, id: "second" }]} />,
      ),
    ).toContain('role="tablist"');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("Measured values");
    expect(markup).toContain("Synthetic material");
  });
  it("renders model text as text rather than executable markup", () => {
    const markup = renderToStaticMarkup(
      <Exhibits
        exhibits={[{ ...table, title: "<script>alert(1)</script>" }]}
      />,
    );
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;");
  });
  it("places positive diagram coordinates above and to the right of the origin", () => {
    const markup = renderToStaticMarkup(
      <Exhibits
        exhibits={[
          {
            ...table,
            kind: "diagram",
            points: [
              { label: "Origin", x: 0, y: 0 },
              { label: "P", x: 1, y: 1 },
            ],
          },
        ]}
      />,
    );
    const points = [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
    expect(points).toHaveLength(2);
    expect(Number(points[1][1])).toBeGreaterThan(Number(points[0][1]));
    expect(Number(points[1][2])).toBeLessThan(Number(points[0][2]));
    expect(markup).toContain("P: (1, 1)");
  });
  it("keeps the legacy parallelogram inside the sheet even when probes cancel large columns", () => {
    const scenario = {
      ...demoScenario,
      matrix: [
        [1000, 1000],
        [1000, 1001],
      ] as [[number, number], [number, number]],
      vectors: [
        { label: "u", input: [1, -1] as [number, number] },
        { label: "v", input: [-1, 1] as [number, number] },
      ],
    };
    const markup = renderToStaticMarkup(
        <TransformationDiagram scenario={scenario} />,
      ),
      polygon = /<polygon points="([^"]+)"/.exec(markup)![1];
    for (const value of polygon.split(/[ ,]/).map(Number)) {
      expect(value).toBeGreaterThanOrEqual(20);
      expect(value).toBeLessThanOrEqual(320);
    }
  });
});
