"use client";
import katex from "katex";
export default function MathText({ text }: { text: string }) {
  return (
    <span className="math-text">
      {text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          const display = part.startsWith("$$"),
            content = part.slice(display ? 2 : 1, display ? -2 : -1);
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(content, {
                  throwOnError: false,
                  displayMode: display,
                  trust: false,
                  strict: "warn",
                }),
              }}
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
