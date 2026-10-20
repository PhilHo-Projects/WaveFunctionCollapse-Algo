import type {
  SolverEvent,
  SolverProblem,
  SolverResult,
  SolverStatus,
} from "./types";
import { random } from "./random";

/** Arc consistency over arbitrary oriented graphs. Domains are not limited to 32 tiles. */
export function* solveSteps(
  problem: SolverProblem,
  cancelled = () => false,
): Generator<SolverEvent, SolverResult> {
  const { modules, links } = problem;
  const n = modules.length,
    words = Math.ceil(n / 32),
    rng = random(problem.seed);
  const domains: Uint32Array[] = problem.domains.map((values) => {
    const bits = new Uint32Array(words);
    values.forEach((v) => {
      bits[v >>> 5] |= 1 << (v & 31);
    });
    return bits;
  });
  const counts = new Int32Array(domains.length),
    entropies = new Float64Array(domains.length);
  const events: SolverEvent[] = [];
  let operations = 0,
    backtracks = 0;
  const values = (slot: number) => {
    const out: number[] = [];
    for (let v = 0; v < n; v++)
      if (domains[slot][v >>> 5] & (1 << (v & 31))) out.push(v);
    return out;
  };
  const weight = (slot: number, v: number) =>
    modules[v].weight * (problem.preferred?.[slot] === v ? 30 : 1);
  const refresh = (slot: number) => {
    const vs = values(slot);
    counts[slot] = vs.length;
    let sum = 0,
      logSum = 0;
    for (const v of vs) {
      const w = weight(slot, v);
      sum += w;
      logSum += w * Math.log(w);
    }
    entropies[slot] = sum ? Math.log(sum) - logSum / sum : 0;
  };
  domains.forEach((_, i) => refresh(i));
  const compatibility = new Map<string, Uint32Array[]>();
  for (const list of links)
    for (const link of list) {
      const key = `${link.face}:${link.otherFace}`;
      if (compatibility.has(key)) continue;
      compatibility.set(
        key,
        modules.map((a) => {
          const bits = new Uint32Array(words);
          modules.forEach((b, id) => {
            if (a.sockets[link.face] === b.sockets[link.otherFace])
              bits[id >>> 5] |= 1 << (id & 31);
          });
          return bits;
        }),
      );
    }
  let queue = domains.map((_, i) => i),
    cursor = 0;
  const queued = new Set(queue);
  const trail: { slot: number; bits: Uint32Array }[] = [];
  const decisions: { slot: number; remaining: number[]; checkpoint: number }[] =
    [];
  const event = (
    type: SolverEvent["type"],
    slot: number,
    reason: string,
    extras: Partial<SolverEvent> = {},
  ): SolverEvent => {
    const e = {
      seq: events.length,
      type,
      slot,
      reason,
      candidates: slot >= 0 ? values(slot) : [],
      remaining: counts[slot] ?? 0,
      entropy: entropies[slot] ?? 0,
      ...extras,
    };
    events.push(e);
    return e;
  };
  const enqueue = (slot: number) => {
    if (!queued.has(slot)) {
      queued.add(slot);
      queue.push(slot);
    }
  };
  const restrict = (slot: number, v: number) => {
    trail.push({ slot, bits: domains[slot].slice() });
    domains[slot].fill(0);
    domains[slot][v >>> 5] |= 1 << (v & 31);
    refresh(slot);
    enqueue(slot);
  };
  const finish = (status: SolverStatus): SolverResult => ({
    status,
    initialDomains: problem.domains,
    assignments: domains.map((_, i) => (counts[i] === 1 ? values(i)[0] : -1)),
    events,
    counts: Array.from(counts),
    backtracks,
    operations,
  });
  for (let i = 0; i < domains.length; i++)
    if (problem.domains[i].length < n)
      yield event(
        "constraint",
        i,
        problem.constraintReasons?.[i] ??
          "Supplied boundary or occupied-volume constraints restrict this slot.",
      );
  while (true) {
    if (cancelled()) return finish("cancelled");
    if (operations > 3_000_000) return finish("exhausted");
    let conflict = counts.findIndex((c) => c === 0);
    while (cursor < queue.length && conflict < 0) {
      const slot = queue[cursor++];
      queued.delete(slot);
      const source = values(slot);
      for (const link of links[slot]) {
        operations++;
        const table = compatibility.get(`${link.face}:${link.otherFace}`)!;
        const allowed = new Uint32Array(words);
        for (const v of source)
          for (let w = 0; w < words; w++) allowed[w] |= table[v][w];
        const old = domains[link.to];
        const next = old.map((bits, w) => bits & allowed[w]);
        if (next.every((bits, w) => bits === old[w])) continue;
        const removed = values(link.to).filter(
          (v) => !(next[v >>> 5] & (1 << (v & 31))),
        );
        trail.push({ slot: link.to, bits: old });
        domains[link.to] = next;
        refresh(link.to);
        enqueue(link.to);
        yield event(
          "propagate",
          link.to,
          `${link.otherFace < 4 ? `Edge ${link.otherFace}` : link.otherFace === 4 ? "Support below" : "Connection above"} must meet slot ${slot} (${[...new Set(source.map((v) => modules[v].sockets[link.face]))].join(" or ")}). Remove ${removed.length} incompatible candidate${removed.length === 1 ? "" : "s"}.`,
          { cause: slot, removed },
        );
        if (!counts[link.to]) {
          conflict = link.to;
          break;
        }
      }
    }
    queue = [];
    cursor = 0;
    queued.clear();
    if (conflict >= 0) {
      yield event("contradiction", conflict, "No compatible module remains.");
      let decision = decisions.pop();
      while (decision && !decision.remaining.length) decision = decisions.pop();
      if (!decision) return finish("contradiction");
      if (++backtracks > (problem.maxBacktracks ?? 4096))
        return finish("exhausted");
      const restoredSlots = new Set<number>();
      while (trail.length > decision.checkpoint) {
        const previous = trail.pop()!;
        domains[previous.slot] = previous.bits;
        refresh(previous.slot);
        restoredSlots.add(previous.slot);
      }
      const chosen = decision.remaining.pop()!;
      decisions.push(decision);
      yield event(
        "backtrack",
        decision.slot,
        "Restore the last decision and try a different compatible module.",
        {
          module: chosen,
          restored: [...restoredSlots].map((slot) => ({
            slot,
            candidates: values(slot),
          })),
        },
      );
      restrict(decision.slot, chosen);
      yield event(
        "observe",
        decision.slot,
        `Try ${modules[chosen].family} after restoring the previous decision.`,
        { module: chosen },
      );
      queue = domains.map((_, i) => i);
      queue.forEach((i) => queued.add(i));
      continue;
    }
    let target = -1,
      lowest = Infinity;
    for (let i = 0; i < domains.length; i++)
      if (counts[i] > 1) {
        const score = entropies[i] + rng() * 1e-8;
        if (score < lowest) {
          lowest = score;
          target = i;
        }
      }
    if (target < 0) {
      const result = finish("success");
      for (let i = 0; i < links.length; i++)
        for (const link of links[i])
          if (
            modules[result.assignments[i]].sockets[link.face] !==
            modules[result.assignments[link.to]].sockets[link.otherFace]
          )
            return finish("contradiction");
      yield event("complete", -1, "Every slot and shared connector is valid.");
      return finish("success");
    }
    const available = values(target),
      order: number[] = [];
    while (available.length) {
      let roll =
        rng() * available.reduce((sum, v) => sum + weight(target, v), 0);
      let pick = available.length - 1;
      for (let i = 0; i < available.length; i++)
        if ((roll -= weight(target, available[i])) <= 0) {
          pick = i;
          break;
        }
      order.push(available.splice(pick, 1)[0]);
    }
    const chosen = order.shift()!;
    decisions.push({
      slot: target,
      remaining: order.reverse(),
      checkpoint: trail.length,
    });
    restrict(target, chosen);
    operations++;
    yield event(
      "observe",
      target,
      `Choose ${modules[chosen].family} from the lowest weighted entropy slot.`,
      { module: chosen },
    );
  }
}
export function solve(problem: SolverProblem): SolverResult {
  const iterator = solveSteps(problem);
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}
