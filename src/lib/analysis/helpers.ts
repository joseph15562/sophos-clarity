/**
 * Shared helpers for config analysis. Used by analyse-config and domain modules.
 */

import type { ExtractedSections, SectionData } from "../extract-sections";

export function findSection(sections: ExtractedSections, pattern: RegExp): SectionData | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}
