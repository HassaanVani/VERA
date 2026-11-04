"use client";
import { useId, useRef, useState } from "react";
import type { Exam } from "@/lib/contracts";
import {
  emptyVectorResponse,
  encodeVectorResponse,
  readVectorResponse,
  type DiagramConfig,
} from "@/lib/vector-response";
import MathText from "./MathText";
type Point = [number, number];
export default function VectorAnswer({
  config,
  exhibit,
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: {
  config: DiagramConfig;
  exhibit?: NonNullable<Exam["exhibits"]>[number];
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const marker = useId().replaceAll(":", ""),
    instructions = useId();
  const response = readVectorResponse(value) ?? emptyVectorResponse();
  const [pending, setPending] = useState<Point>(),
    [preview, setPreview] = useState<Point>(),
    [notice, setNotice] = useState("");
  const [fields, setFields] = useState(["0", "0", "", ""]);
  const down = useRef<{ point: Point; client: Point } | undefined>(undefined);
  const scale = Math.min(
      500 / (config.maxX - config.minX),
      340 / (config.maxY - config.minY),
    ),
    width = (config.maxX - config.minX) * scale + 80,
    height = (config.maxY - config.minY) * scale + 80;
  const x = (n: number) => 40 + (n - config.minX) * scale,
    y = (n: number) => height - 40 - (n - config.minY) * scale;
  const canDraw =
    !readOnly && !disabled && response.vectors.length < config.maxVectors;
  const inBounds = ([a, b]: Point) =>
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= config.minX &&
    a <= config.maxX &&
    b >= config.minY &&
    b <= config.maxY;
  const commit = (from: Point, to: Point) => {
    if (!canDraw || !inBounds(from) || !inBounds(to)) {
      setNotice("Use coordinates within the diagram bounds.");
      return;
    }
    onChange?.(
      encodeVectorResponse({
        ...response,
        vectors: [...response.vectors, { from, to }],
      }),
    );
    setPending(undefined);
    setPreview(undefined);
    setNotice(`Vector ${response.vectors.length + 1} added.`);
  };
  const pointAt = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const svg = event.currentTarget,
      matrix = svg.getScreenCTM();
    if (!matrix) return [NaN, NaN];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return [
      Math.round(
        Math.max(
          config.minX,
          Math.min(config.maxX, config.minX + (point.x - 40) / scale),
        ) * 100,
      ) / 100,
      Math.round(
        Math.max(
          config.minY,
          Math.min(config.maxY, config.minY + (height - 40 - point.y) / scale),
        ) * 100,
      ) / 100,
    ];
  };
  const given = new Map(exhibit?.points.map((p) => [p.label, p]) ?? []);
  const stepX = Math.max(1, Math.ceil((config.maxX - config.minX) / 10)),
    stepY = Math.max(1, Math.ceil((config.maxY - config.minY) / 10));
  const ticksX = Array.from(
      { length: Math.floor((config.maxX - config.minX) / stepX) + 1 },
      (_, i) => config.minX + i * stepX,
    ),
    ticksY = Array.from(
      { length: Math.floor((config.maxY - config.minY) / stepY) + 1 },
      (_, i) => config.minY + i * stepY,
    );
  const vectors = [
    ...response.vectors,
    ...(pending && preview ? [{ from: pending, to: preview }] : []),
  ];
  return (
    <section
      className={`vector-answer ${readOnly ? "is-readonly" : ""}`}
      aria-label={readOnly ? "Your saved vector drawing" : "Draw your answer"}
    >
      {!readOnly && (
        <>
          <h4>Draw your answer</h4>
          <p id={instructions}>
            Drag an arrow, or tap its start and end. You can also enter
            coordinates below. {config.maxVectors} vectors maximum. Pointer
            positions round to two decimal places.
          </p>
        </>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Coordinate diagram with given geometry and your answer vectors"
        aria-describedby={readOnly ? undefined : instructions}
        className="vector-answer-canvas"
        onPointerDown={(event) => {
          if (!canDraw || event.button !== 0) return;
          down.current = {
            point: pointAt(event),
            client: [event.clientX, event.clientY],
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!canDraw) return;
          if (
            down.current &&
            Math.hypot(
              event.clientX - down.current.client[0],
              event.clientY - down.current.client[1],
            ) > 4
          ) {
            setPending(down.current.point);
            setPreview(pointAt(event));
          } else if (pending) setPreview(pointAt(event));
        }}
        onPointerUp={(event) => {
          const start = down.current;
          down.current = undefined;
          if (!start || !canDraw) return;
          const end = pointAt(event);
          if (
            Math.hypot(
              event.clientX - start.client[0],
              event.clientY - start.client[1],
            ) > 8
          )
            commit(start.point, end);
          else if (pending) commit(pending, end);
          else {
            setPending(end);
            setNotice(
              `Start selected at (${end.join(", ")}). Choose the endpoint.`,
            );
          }
        }}
        onPointerCancel={() => {
          down.current = undefined;
          setPending(undefined);
          setPreview(undefined);
        }}
      >
        <defs>
          <marker
            id={marker}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" fill="#126ca8" />
          </marker>
          <marker
            id={`${marker}-given`}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" fill="#354d61" />
          </marker>
        </defs>
        <rect width={width} height={height} fill="#faf9f5" />
        <g className="vector-grid">
          {ticksX.map((n) => (
            <g key={n}>
              <line x1={x(n)} y1="28" x2={x(n)} y2={height - 30} />
              <text x={x(n)} y={height - 12}>
                {n}
              </text>
            </g>
          ))}
          {ticksY.map((n) => (
            <g key={n}>
              <line x1="28" y1={y(n)} x2={width - 28} y2={y(n)} />
              <text x="15" y={y(n) + 4}>
                {n}
              </text>
            </g>
          ))}
        </g>
        <g stroke="#707e89">
          {config.minY <= 0 && config.maxY >= 0 && (
            <line x1="28" x2={width - 28} y1={y(0)} y2={y(0)} />
          )}{" "}
          {config.minX <= 0 && config.maxX >= 0 && (
            <line x1={x(0)} x2={x(0)} y1="28" y2={height - 30} />
          )}
        </g>
        <g className="vector-givens">
          {(exhibit?.drawing?.paths ?? []).map((path, i) => {
            const coordinates = path.points
              .map((label) => given.get(label))
              .filter((p) => !!p)
              .map((p) => `${x(p.x)},${y(p.y)}`)
              .join(" ");
            return path.closed ? (
              <polygon key={i} points={coordinates} />
            ) : (
              <polyline key={i} points={coordinates} />
            );
          })}
          {(exhibit?.drawing?.circles ?? []).map((circle, i) => {
            const p = given.get(circle.center);
            return p ? (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={circle.radius * scale}
              />
            ) : null;
          })}
          {(exhibit?.drawing?.segments ?? []).map((line, i) => {
            const a = given.get(line.from),
              b = given.get(line.to);
            return a && b ? (
              <line
                key={i}
                x1={x(a.x)}
                y1={y(a.y)}
                x2={x(b.x)}
                y2={y(b.y)}
                markerEnd={line.arrow ? `url(#${marker}-given)` : undefined}
              />
            ) : null;
          })}
          {exhibit?.points.map((p) => (
            <g key={p.label}>
              <circle cx={x(p.x)} cy={y(p.y)} r="3" />
              <text x={x(p.x) + 6} y={y(p.y) - 7}>
                {p.label}
              </text>
            </g>
          ))}
        </g>
        {vectors.map((v, i) => (
          <g key={i} className="answer-vector">
            <line
              x1={x(v.from[0])}
              y1={y(v.from[1])}
              x2={x(v.to[0])}
              y2={y(v.to[1])}
              markerEnd={`url(#${marker})`}
              strokeDasharray={i >= response.vectors.length ? "5 4" : undefined}
            />
            <text x={x(v.to[0]) + 8} y={y(v.to[1]) - 8}>
              {i + 1}
            </text>
          </g>
        ))}
        {pending && (
          <circle cx={x(pending[0])} cy={y(pending[1])} r="5" fill="#126ca8" />
        )}
      </svg>
      {exhibit && (
        <details className="diagram-data vector-given-data">
          <summary>Given diagram data</summary>
          <MathText text={exhibit.drawing?.description || exhibit.content} />
          <ul>
            {exhibit.points.map((p) => (
              <li key={p.label}>
                {p.label}: ({p.x}, {p.y})
              </li>
            ))}
          </ul>
        </details>
      )}
      <ol className="vector-list">
        {response.vectors.map((v, i) => (
          <li key={i}>
            Vector {i + 1}: ({v.from.join(", ")}) → ({v.to.join(", ")})
          </li>
        ))}
      </ol>
      {!readOnly && (
        <>
          <div className="vector-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || !response.vectors.length}
              onClick={() =>
                onChange?.(
                  encodeVectorResponse({
                    ...response,
                    vectors: response.vectors.slice(0, -1),
                  }),
                )
              }
            >
              Remove last vector
            </button>
            {pending && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPending(undefined);
                  setPreview(undefined);
                  setNotice("Unfinished vector cancelled.");
                }}
              >
                Cancel unfinished vector
              </button>
            )}
          </div>
          <details className="vector-coordinate-entry">
            <summary>Enter exact coordinates instead</summary>
            <div className="vector-fields">
              {["Start x", "Start y", "End x", "End y"].map((label, index) => (
                <label key={label}>
                  {label}
                  <input
                    type="number"
                    step="any"
                    min={index % 2 ? config.minY : config.minX}
                    max={index % 2 ? config.maxY : config.maxX}
                    value={fields[index]}
                    disabled={!canDraw}
                    onChange={(e) =>
                      setFields(
                        fields.map((value, i) =>
                          i === index ? e.target.value : value,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              disabled={!canDraw}
              onClick={() => {
                if (fields.some((v) => !v.trim())) {
                  setNotice("Enter all four coordinates.");
                  return;
                }
                commit(
                  [Number(fields[0]), Number(fields[1])],
                  [Number(fields[2]), Number(fields[3])],
                );
              }}
            >
              Add vector
            </button>
          </details>
          <p className="vector-notice" role="status">
            {notice}
          </p>
          <label className="response-label">
            Explain your drawing
            <textarea
              value={response.reasoning}
              maxLength={12000}
              rows={3}
              disabled={disabled}
              onChange={(e) =>
                onChange?.(
                  encodeVectorResponse({
                    ...response,
                    reasoning: e.target.value,
                  }),
                )
              }
            />
          </label>
          <p className="muted small">
            Your drawing and explanation are saved together. Self-score them
            against the rubric after submission; the drawing is not
            automatically graded.
          </p>
        </>
      )}
      {readOnly && (
        <MathText
          text={response.reasoning || "No written explanation recorded."}
        />
      )}
    </section>
  );
}
