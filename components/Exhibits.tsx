"use client";
import { useState, useId } from "react";
import { ArrowUpRight, FileSpreadsheet, MoveUpRight } from "lucide-react";
import type { Scenario, Exam } from "@/lib/contracts";
import MathText from "./MathText";
import { multiply } from "@/lib/domain";

export function TransformationDiagram({
  scenario,
  decorative = false,
}: {
  scenario: Scenario;
  decorative?: boolean;
}) {
  const arrow = useId().replace(/:/g, "");
  const points = scenario.vectors.map((v) => ({
    ...v,
    output: multiply(scenario.matrix, v.input),
  }));
  const bound =
    Math.max(
      5,
      ...points.flatMap((p) => [...p.input, ...p.output].map(Math.abs)),
      ...scenario.matrix.flat().map(Math.abs),
      ...scenario.matrix.map((row) => Math.abs(row[0] + row[1])),
    ) + 1;
  const scale = 130 / bound,
    x = (n: number) => 170 + n * scale,
    y = (n: number) => 170 - n * scale;
  return (
    <svg
      viewBox="0 0 340 340"
      className={decorative ? "hero-diagram" : "vector-diagram"}
      role="img"
      aria-label="Dashed blue arrows are input vectors. Solid teal arrows are transformed vectors on the same coordinate axes."
    >
      <defs>
        <marker
          id={arrow}
          markerWidth="7"
          markerHeight="7"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6" fill="context-stroke" />
        </marker>
      </defs>
      {Array.from({ length: 13 }, (_, i) => i - 6).map((n) => (
        <g key={n} className="diagram-grid">
          <line x1={x(n)} y1="20" x2={x(n)} y2="320" />
          <line x1="20" y1={y(n)} x2="320" y2={y(n)} />
        </g>
      ))}
      <g className="diagram-axis">
        <line x1="14" y1="170" x2="326" y2="170" />
        <line x1="170" y1="14" x2="170" y2="326" />
      </g>
      <polygon
        points={`${x(0)},${y(0)} ${x(scenario.matrix[0][0])},${y(scenario.matrix[1][0])} ${x(scenario.matrix[0][0] + scenario.matrix[0][1])},${y(scenario.matrix[1][0] + scenario.matrix[1][1])} ${x(scenario.matrix[0][1])},${y(scenario.matrix[1][1])}`}
        fill="rgba(29,107,255,.10)"
        stroke="#388bff"
        strokeDasharray="4 5"
      />
      {points.map((p, i) => (
        <g key={p.label}>
          <line
            x1="170"
            y1="170"
            x2={x(p.input[0])}
            y2={y(p.input[1])}
            stroke="#337bff"
            strokeWidth="2"
            strokeDasharray="4 3"
            markerEnd={`url(#${arrow})`}
          />
          <line
            x1="170"
            y1="170"
            x2={x(p.output[0])}
            y2={y(p.output[1])}
            stroke="#087d8f"
            strokeWidth="2.5"
            markerEnd={`url(#${arrow})`}
          />
          <text
            x={x(p.output[0]) + 8}
            y={y(p.output[1]) - 7}
            fill="currentColor"
            fontSize="11"
          >{`A${["u", "v", "w", "p", "q", "r"][i]}`}</text>
        </g>
      ))}
      <text x="321" y="187" fill="currentColor" fontSize="12">
        x
      </text>
      <text x="181" y="20" fill="currentColor" fontSize="12">
        y
      </text>
      {!decorative && (
        <text x="20" y="334" fill="currentColor" fontSize="10">
          Dashed: input · Solid: transformed · Grid: 1
        </text>
      )}
    </svg>
  );
}
function MatrixExhibits({ scenario }: { scenario: Scenario }) {
  const [tab, setTab] = useState("calibration");
  const tabId = useId();
  const tabs = [
    ["calibration", "01 Calibration"],
    ["vectors", "02 Measurements"],
    ["diagram", "03 Diagram"],
  ];
  return (
    <section className="exhibit-panel" aria-label="Supporting exhibits">
      <div className="exhibit-heading">
        <span className="eyebrow">
          <FileSpreadsheet size={14} /> EXHIBIT DESK
        </span>
        <span className="badge synthetic">Synthetic data</span>
      </div>
      <div
        className="exhibit-tabs"
        role="tablist"
        aria-label="Exhibit"
        onKeyDown={(event) => {
          if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const current = tabs.findIndex(([value]) => value === tab);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (current +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          setTab(tabs[next][0]);
          (event.currentTarget.children[next] as HTMLButtonElement).focus();
        }}
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            id={`${tabId}-${value}`}
            role="tab"
            aria-selected={tab === value}
            aria-controls={`${tabId}-panel`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="paper"
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${tab}`}
        tabIndex={0}
      >
        <div className="paper-top">
          <span>
            <MoveUpRight size={20} /> {scenario.company}
          </span>
          <span>LAB / 001</span>
        </div>
        <h3>
          {tab === "calibration"
            ? scenario.title
            : tab === "vectors"
              ? "Vector measurement log"
              : "Transformation field"}
        </h3>
        <p className="paper-sub">FICTIONAL SOURCE DOCUMENT · FOR PRACTICE</p>
        {tab === "calibration" ? (
          <>
            <p>{scenario.context}</p>
            <div className="matrix-block">
              <span>A =</span>
              <div className="matrix">
                {scenario.matrix.flat().map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
            </div>
            <div className="paper-note">
              <ArrowUpRight size={14} /> Coordinates are dimensionless. Apply
              this same matrix to every probe.
            </div>
          </>
        ) : tab === "vectors" ? (
          <>
            <p>
              Recorded input and output coordinates from the common calibration
              dataset.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Probe</th>
                  <th>Input</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {scenario.vectors.map((v) => (
                  <tr key={v.label}>
                    <td>{v.label}</td>
                    <td>({v.input.join(", ")})</td>
                    <td>({multiply(scenario.matrix, v.input).join(", ")})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <TransformationDiagram scenario={scenario} />
        )}
        <footer>
          VERA EXHIBITS <span>Generated from one shared dataset</span>
        </footer>
      </div>
    </section>
  );
}

export default function Exhibits({
  scenario,
  exhibits = [],
  ids,
}: {
  scenario?: Scenario;
  exhibits?: Exam["exhibits"];
  ids?: string[];
}) {
  const available = exhibits.filter((e) => !ids || ids.includes(e.id));
  const [selected, setSelected] = useState("");
  const tabId = useId();
  if (scenario) return <MatrixExhibits scenario={scenario} />;
  if (!available.length) return null;
  const current = available.find((e) => e.id === selected) ?? available[0];
  const bound =
    Math.max(
      1,
      ...current.points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]),
    ) * 1.2;
  return (
    <aside className="exhibit-panel" aria-label="Supporting exhibits">
      <div className="exhibit-heading">
        <span className="eyebrow">SUPPORTING MATERIAL</span>
        <span className="badge">
          {current.synthetic ? "Synthetic material" : "Source-based material"}
        </span>
      </div>
      <div
        className="exhibit-tabs"
        role="tablist"
        aria-label="Exhibit"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = available.indexOf(current);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? available.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    available.length) %
                  available.length;
          setSelected(available[next].id);
          (event.currentTarget.children[next] as HTMLButtonElement).focus();
        }}
      >
        {available.map((e) => (
          <button
            key={e.id}
            id={`${tabId}-${e.id}`}
            role="tab"
            aria-selected={current.id === e.id}
            aria-controls={`${tabId}-material`}
            tabIndex={current.id === e.id ? 0 : -1}
            onClick={() => setSelected(e.id)}
          >
            {e.title}
          </button>
        ))}
      </div>
      <div
        className="paper"
        role="tabpanel"
        id={`${tabId}-material`}
        aria-labelledby={`${tabId}-${current.id}`}
        tabIndex={0}
      >
        <h3>{current.title}</h3>
        <p className="paper-sub">
          {current.synthetic
            ? "CREATED FOR THIS PRACTICE"
            : "PREPARED FROM COURSE EVIDENCE"}
        </p>
        {current.content && <MathText text={current.content} />}
        {current.kind === "table" && (
          <div className="material-table">
            <table>
              <thead>
                <tr>
                  {current.columns.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>
                        <MathText text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {current.kind === "diagram" && (
          <>
            <svg
              viewBox="0 0 340 340"
              role="img"
              aria-label={`${current.title}. Coordinates listed below.`}
            >
              <line x1="10" y1="170" x2="330" y2="170" stroke="currentColor" />
              <line x1="170" y1="10" x2="170" y2="330" stroke="currentColor" />
              {current.points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={170 + (p.x / bound) * 145}
                    cy={170 - (p.y / bound) * 145}
                    r="4"
                    fill="#1766d9"
                  />
                  <text
                    x={175 + (p.x / bound) * 145}
                    y={165 - (p.y / bound) * 145}
                    fill="currentColor"
                    fontSize="12"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>
            <ul>
              {current.points.map((p, i) => (
                <li key={i}>
                  {p.label}: ({p.x}, {p.y})
                </li>
              ))}
            </ul>
          </>
        )}
        <footer>
          VERA <span>One shared reference for this assessment</span>
        </footer>
      </div>
    </aside>
  );
}
