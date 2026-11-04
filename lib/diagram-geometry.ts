import type { Exam } from "./contracts";
type Exhibit = NonNullable<Exam["exhibits"]>[number];
export function diagramGeometry(exhibit: Exhibit) {
  const byLabel = new Map(exhibit.points.map((p) => [p.label, p]));
  const bounds = [...exhibit.points];
  if (exhibit.drawing?.axes !== "none") bounds.push({ label: "", x: 0, y: 0 });
  for (const circle of exhibit.drawing?.circles ?? []) {
    const center = byLabel.get(circle.center);
    if (center)
      for (const direction of [-1, 1])
        bounds.push({
          label: "",
          x: center.x + direction * circle.radius,
          y: center.y + direction * circle.radius,
        });
  }
  if (!bounds.length)
    bounds.push({ label: "", x: 0, y: 0 }, { label: "", x: 1, y: 1 });
  const minX = Math.min(...bounds.map((p) => p.x)),
    maxX = Math.max(...bounds.map((p) => p.x));
  const minY = Math.min(...bounds.map((p) => p.y)),
    maxY = Math.max(...bounds.map((p) => p.y));
  const rangeX = Math.max(1, maxX - minX),
    rangeY = Math.max(1, maxY - minY);
  const scale = Math.min(500 / rangeX, 340 / rangeY);
  const right = Math.min(
    150,
    Math.max(48, ...exhibit.points.map((p) => p.label.length * 6 + 12)),
  );
  const width = Math.max(220, rangeX * scale + 44 + right),
    height = Math.max(160, rangeY * scale + 88);
  return {
    width,
    height,
    scale,
    x: (value: number) => 44 + (value - minX) * scale,
    y: (value: number) => height - 44 - (value - minY) * scale,
  };
}
