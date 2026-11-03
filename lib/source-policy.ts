import type { SourcePage } from "./contracts";

// A notice is a reason to omit the entire page from model inputs, not a legal
// determination that the remaining pages carry a blanket license.
export function excludedFromModel(page: Pick<SourcePage, "text">) {
  const text = page.text.replace(/\s+/g, " ");
  return /excluded from (?:our|the|this) creative commons license|all rights reserved/i.test(
    text,
  );
}
