import { expect, it } from "vitest";
import { revealScale } from "./motion";

it("grows from the foundation, overshoots, and settles exactly", () => {
  expect(revealScale(-1)).toBe(0);
  expect(revealScale(0)).toBe(0);
  expect(revealScale(0.1)).toBeGreaterThan(0);
  expect(revealScale(0.25)).toBeGreaterThan(1);
  expect(revealScale(0.72)).toBe(1);
  expect(revealScale(10)).toBe(1);
});
