import { useId } from "react";
import type { Exam } from "@/lib/contracts";
import { diagramGeometry } from "@/lib/diagram-geometry";
type Exhibit = NonNullable<Exam["exhibits"]>[number];
export default function GeometryDiagram({ exhibit }: { exhibit: Exhibit }) {
  const arrow = useId().replaceAll(":", "");
  const drawing = exhibit.drawing;
  const points = new Map(exhibit.points.map((p) => [p.label, p]));
  const { x, y, width, height, scale } = diagramGeometry(exhibit);
  return (
    <div className="geometry-reference">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          maxWidth: Math.min(620, (480 * width) / height),
          height: "auto",
        }}
        role="img"
        aria-label={`${exhibit.title}. ${drawing?.description || "Coordinates listed below."}`}
      >
        <defs>
          <marker
            id={arrow}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path
              d="M0 0L6 3L0 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </marker>
        </defs>
        {drawing?.axes !== "none" && (
          <g className="geometry-axes">
            <line x1="15" y1={y(0)} x2={width - 15} y2={y(0)} />
            <line x1={x(0)} y1="15" x2={x(0)} y2={height - 15} />
            <text x={width - 24} y={y(0) + 15}>
              x
            </text>
            <text x={x(0) + 8} y="22">
              y
            </text>
          </g>
        )}
        {(drawing?.paths ?? []).map((path, i) => {
          const vertices = path.points.map((label) => points.get(label));
          if (vertices.some((p) => !p)) return null;
          const coordinates = vertices
            .map((p) => `${x(p!.x)},${y(p!.y)}`)
            .join(" ");
          return (
            <g key={`path-${i}`}>
              {path.closed ? (
                <polygon
                  points={coordinates}
                  fill="#607e9c18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              ) : (
                <polyline
                  points={coordinates}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              )}
              {path.label && <title>{path.label}</title>}
            </g>
          );
        })}
        {(drawing?.circles ?? []).map((circle, i) => {
          const center = points.get(circle.center);
          return center ? (
            <circle
              key={`circle-${i}`}
              cx={x(center.x)}
              cy={y(center.y)}
              r={circle.radius * scale}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <title>{circle.label}</title>
            </circle>
          ) : null;
        })}
        {(drawing?.segments ?? []).map((segment, i) => {
          const a = points.get(segment.from),
            b = points.get(segment.to);
          return a && b ? (
            <g key={`segment-${i}`}>
              <line
                x1={x(a.x)}
                y1={y(a.y)}
                x2={x(b.x)}
                y2={y(b.y)}
                stroke="currentColor"
                strokeWidth="1.8"
                markerEnd={segment.arrow ? `url(#${arrow})` : undefined}
              />
              {segment.label && (
                <text
                  x={(x(a.x) + x(b.x)) / 2 + 5}
                  y={(y(a.y) + y(b.y)) / 2 - 7}
                  fontSize="11"
                >
                  {segment.label}
                </text>
              )}
            </g>
          ) : null;
        })}
        {exhibit.points.map((point, i) => (
          <g key={`point-${i}`}>
            <circle
              cx={x(point.x)}
              cy={y(point.y)}
              r="3.4"
              fill="currentColor"
            />
            <text
              x={x(point.x) + 6}
              y={y(point.y) - 7}
              fill="currentColor"
              fontSize="12"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      {drawing?.description && (
        <p className="diagram-description">{drawing.description}</p>
      )}
      <details className="diagram-data">
        <summary>Diagram data & description</summary>
        <ul>
          {exhibit.points.map((p, i) => (
            <li key={i}>
              {p.label}: ({p.x}, {p.y})
            </li>
          ))}
          {drawing?.segments.map((s, i) => (
            <li key={`s${i}`}>
              {s.arrow ? "Arrow" : "Segment"}: {s.from} to {s.to}
              {s.label ? ` · ${s.label}` : ""}
            </li>
          ))}
          {drawing?.paths.map((p, i) => (
            <li key={`p${i}`}>
              {p.closed ? "Polygon" : "Polyline"}: {p.points.join(" → ")}
              {p.label ? ` · ${p.label}` : ""}
            </li>
          ))}
          {drawing?.circles.map((c, i) => (
            <li key={`c${i}`}>
              Circle centered at {c.center}, radius {c.radius}
              {c.label ? ` · ${c.label}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
