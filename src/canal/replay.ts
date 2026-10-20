import type { SolverEvent } from "./types";
export function replay(
  domains: number[][],
  events: SolverEvent[],
  cursor: number,
) {
  const current = domains.map((d) => [...d]);
  events.slice(0, cursor + 1).forEach((e) => {
    if (e.restored)
      e.restored.forEach((r) => {
        current[r.slot] = r.candidates;
      });
    if (e.slot >= 0 && e.candidates) current[e.slot] = e.candidates;
  });
  return {
    assignments: current.map((d) => (d.length === 1 ? d[0] : -1)),
    counts: current.map((d) => d.length),
    domains: current,
  };
}
