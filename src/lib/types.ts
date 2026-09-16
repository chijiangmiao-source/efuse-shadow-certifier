/** 一个已通过校验的熔丝阵列谜题。 */
export interface PuzzleInput {
  /** 行数（1..18） */
  height: number;
  /** 列数（1..18） */
  width: number;
  /** 每行熔断数，长度 = height，取值 0..width */
  rowCounts: number[];
  /** 每列熔断数，长度 = width，取值 0..height */
  colCounts: number[];
  /** 已知位 [r, c, v]，v ∈ {0,1}，坐标互不重复 */
  known: Array<[number, number, number]>;
  /** 2×2 区块奇偶校验 [r, c, p]，覆盖 (r,c),(r+1,c),(r,c+1),(r+1,c+1)，p 为四位异或 */
  blocks: Array<[number, number, number]>;
}

export type ValidationResult =
  | { ok: true; puzzle: PuzzleInput }
  | { ok: false; errors: string[] };

export type SolveStatus = 'unique' | 'ambiguous' | 'impossible';

export interface SolveResult {
  status: SolveStatus;
  /** 行优先位串；长度 0（impossible）、1（unique）或 2（ambiguous，字典序最小的两个） */
  solutions: string[];
  /** ambiguous 时的见证位串：两解共同前缀 + 首个分叉格被置 0 */
  witness: string | null;
  /** ambiguous 时首个差异格的行优先下标 */
  firstDifference: number | null;
  /** 搜索访问的节点数（诊断用，不参与验收判定） */
  nodes: number;
  /** 搜索达到的最大回溯深度（诊断用） */
  maxDepth: number;
}
