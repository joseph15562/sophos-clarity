import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Asserts no axe violations with impact `critical` or `serious` (aligns with jest-axe helper in
 * `src/test/test-utils.tsx`). Use after the page under test is stable.
 *
 * Do not disable `color-contrast` here — fix UI tokens instead (see `.cursor/rules/e2e-a11y.mdc`).
 */
export async function expectNoCriticalOrSeriousAxeViolations(
  page: Page,
  messagePrefix?: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const body = JSON.stringify(serious, null, 2);
  expect(serious, messagePrefix ? `${messagePrefix}\n${body}` : body).toEqual([]);
}
