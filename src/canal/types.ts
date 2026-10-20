export type Preset = "village" | "market" | "bridges";
export type Size = "small" | "medium" | "large";
export type Ground = "water" | "quay";
export interface Point {
  x: number;
  z: number;
}
export interface QuadCell {
  id: number;
  vertices: [number, number, number, number];
  neighbors: [number, number, number, number];
  neighborFaces: [number, number, number, number];
  center: Point;
}
export interface TownGrid {
  vertices: Point[];
  cells: QuadCell[];
  radius: number;
}
export interface Bridge {
  id: string;
  cells: number[];
  anchors: [number, number];
  faces: number[];
}
export interface WorldIntent {
  seed: string;
  size: Size;
  preset: Preset;
  ground: Ground[];
  heights: number[];
  bridges: Bridge[];
  /** Optional façade paint per cell; -1 keeps the seeded building colour. */
  paint?: number[];
}
export type Category = "air" | "ground" | "room" | "roof" | "bridge";
export interface DecorationAnchor {
  kind: string;
  position: [number, number, number];
  face?: number;
}
export interface ModuleDefinition {
  id: string;
  family: string;
  mesh: string;
  rotation: number;
  category: Category;
  sockets: [string, string, string, string, string, string];
  weight: number;
  mask: number;
  variant: number;
  anchors?: DecorationAnchor[];
}
export interface ModuleManifest {
  version: string;
  modules: ModuleDefinition[];
  families: string[];
  props: string[];
  coordinates: string;
}
export interface Link {
  to: number;
  face: number;
  otherFace: number;
}
export interface SolverProblem {
  modules: ModuleDefinition[];
  links: Link[][];
  domains: number[][];
  seed: string;
  preferred?: number[];
  maxBacktracks?: number;
  constraintReasons?: string[];
}
export type SolverStatus =
  "running" | "success" | "contradiction" | "exhausted" | "cancelled";
export interface SolverEvent {
  seq: number;
  type:
    | "constraint"
    | "observe"
    | "propagate"
    | "contradiction"
    | "backtrack"
    | "complete";
  slot: number;
  module?: number;
  removed?: number[];
  cause?: number;
  candidates?: number[];
  restored?: { slot: number; candidates: number[] }[];
  remaining: number;
  entropy: number;
  reason: string;
}
export interface SolverResult {
  status: SolverStatus;
  initialDomains?: number[][];
  assignments: number[];
  events: SolverEvent[];
  counts: number[];
  backtracks: number;
  operations: number;
}
export interface TownDocument {
  version: 1;
  kitVersion: string;
  intent: WorldIntent;
  assignments: number[];
  edit: number;
}
export interface TownState {
  grid: TownGrid;
  document: TownDocument;
  result: SolverResult;
}
export const LAYERS = 7;
export const FLOOR_HEIGHT = 1.4;
export const KIT_VERSION = "canal-1";
