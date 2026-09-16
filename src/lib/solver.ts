import type { PuzzleInput, SolveResult } from './types';

/** 一个 2×2 异或约束：a,b,c,d 为四个单元的行优先下标，a⊕b⊕c⊕d === p。 */
interface XorConstraint {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
}

interface Snapshot {
  grid: Int8Array;
  rowRem: Int32Array;
  colRem: Int32Array;
  rowFree: Int32Array;
  colFree: Int32Array;
  xorUnk: Int32Array;
  xorPar: Int32Array;
}

function impossible(nodes: number, maxDepth = 0): SolveResult {
  return { status: 'impossible', solutions: [], witness: null, firstDifference: null, nodes, maxDepth };
}

/**
 * 带基数（行/列熔断数）与四位异或（2×2 区块奇偶）约束的传播回溯求解器。
 *
 * 传播规则：
 *  - 基数：剩余需求 <0 或 > 剩余未定位数即矛盾；为 0 时余格全置 0，相等时全置 1；
 *  - 异或：已定位奇偶与 p 不符即矛盾；仅剩 1 个未知格时唯一确定其值。
 * 回溯：始终选择行优先顺序的第一个未知格，按 0 再 1 尝试，
 * 因此收集到的解严格按行优先位串字典序排列；找到两个解即停止，绝不枚举全部解。
 */
export function solve(puzzle: PuzzleInput): SolveResult {
  const H = puzzle.height;
  const W = puzzle.width;
  const N = H * W;

  // 全局总量不一致：任何完整位串都不可能同时满足两组基数。
  const totalRows = puzzle.rowCounts.reduce((s, v) => s + v, 0);
  const totalCols = puzzle.colCounts.reduce((s, v) => s + v, 0);
  if (totalRows !== totalCols) return impossible(1);

  const xors: XorConstraint[] = puzzle.blocks.map(([r, c, p]) => {
    const a = r * W + c;
    return { a, b: a + W, c: a + 1, d: a + W + 1, p };
  });
  // 每个单元最多属于 4 个区块。
  const cellXors: number[][] = Array.from({ length: N }, () => []);
  xors.forEach((x, bi) => {
    cellXors[x.a].push(bi);
    cellXors[x.b].push(bi);
    cellXors[x.c].push(bi);
    cellXors[x.d].push(bi);
  });

  const state = {
    grid: new Int8Array(N).fill(-1),
    rowRem: Int32Array.from(puzzle.rowCounts),
    colRem: Int32Array.from(puzzle.colCounts),
    rowFree: new Int32Array(H).fill(W),
    colFree: new Int32Array(W).fill(H),
    xorUnk: new Int32Array(xors.length).fill(4),
    xorPar: new Int32Array(xors.length),
    queue: new Array<number>(),
    contradiction: false,
  };

  const enqueue = (cell: number, val: number) => {
    state.queue.push(cell, val);
  };

  const assign = (cell: number, val: number): void => {
    const cur = state.grid[cell];
    if (cur !== -1) {
      if (cur !== val) state.contradiction = true;
      return;
    }
    state.grid[cell] = val;
    const r = Math.floor(cell / W);
    const c = cell - r * W;

    state.rowFree[r]--;
    state.colFree[c]--;
    if (val === 1) {
      state.rowRem[r]--;
      state.colRem[c]--;
    }
    if (
      state.rowRem[r] < 0 ||
      state.colRem[c] < 0 ||
      state.rowRem[r] > state.rowFree[r] ||
      state.colRem[c] > state.colFree[c]
    ) {
      state.contradiction = true;
    }

    for (const bi of cellXors[cell]) {
      state.xorUnk[bi]--;
      state.xorPar[bi] ^= val;
      const x = xors[bi];
      if (state.xorUnk[bi] === 0) {
        if (state.xorPar[bi] !== x.p) state.contradiction = true;
      } else if (state.xorUnk[bi] === 1) {
        let last = x.a;
        if (state.grid[x.a] !== -1) {
          if (state.grid[x.b] === -1) last = x.b;
          else if (state.grid[x.c] === -1) last = x.c;
          else last = x.d;
        }
        enqueue(last, x.p ^ state.xorPar[bi]);
      }
    }

    if (state.contradiction) return;

    // 基数强制：本行/本列余格全部置位或清零。
    if (state.rowRem[r] === 0) {
      for (let c2 = 0; c2 < W; c2++) {
        const idx = r * W + c2;
        if (state.grid[idx] === -1) enqueue(idx, 0);
      }
    } else if (state.rowRem[r] === state.rowFree[r]) {
      for (let c2 = 0; c2 < W; c2++) {
        const idx = r * W + c2;
        if (state.grid[idx] === -1) enqueue(idx, 1);
      }
    }
    if (state.colRem[c] === 0) {
      for (let r2 = 0; r2 < H; r2++) {
        const idx = r2 * W + c;
        if (state.grid[idx] === -1) enqueue(idx, 0);
      }
    } else if (state.colRem[c] === state.colFree[c]) {
      for (let r2 = 0; r2 < H; r2++) {
        const idx = r2 * W + c;
        if (state.grid[idx] === -1) enqueue(idx, 1);
      }
    }
  };

  /** 处理传播队列；出现矛盾时清空队列并返回 false。 */
  const drainQueue = (): boolean => {
    const q = state.queue;
    while (q.length > 0) {
      const val = q.pop() as number;
      const cell = q.pop() as number;
      assign(cell, val);
      if (state.contradiction) {
        q.length = 0;
        return false;
      }
    }
    return true;
  };

  const snapshot = (): Snapshot => ({
    grid: state.grid.slice(),
    rowRem: state.rowRem.slice(),
    colRem: state.colRem.slice(),
    rowFree: state.rowFree.slice(),
    colFree: state.colFree.slice(),
    xorUnk: state.xorUnk.slice(),
    xorPar: state.xorPar.slice(),
  });

  const restore = (s: Snapshot): void => {
    state.grid = s.grid;
    state.rowRem = s.rowRem;
    state.colRem = s.colRem;
    state.rowFree = s.rowFree;
    state.colFree = s.colFree;
    state.xorUnk = s.xorUnk;
    state.xorPar = s.xorPar;
    state.contradiction = false;
  };

  const bitsToString = (g: Int8Array): string => {
    let out = '';
    for (let i = 0; i < g.length; i++) out += g[i] === 1 ? '1' : '0';
    return out;
  };

  // 先用已知位触发传播（已知位之间的冲突已在校验阶段拦截，
  // 这里的矛盾意味着已知位与基数/异或约束不相容）。
  state.queue.length = 0;
  for (const [r, c, v] of puzzle.known) enqueue(r * W + c, v);
  if (!drainQueue()) return impossible(1);

  const found: string[] = [];
  let nodes = 0;
  let maxDepth = 0;

  const dfs = (depth: number): boolean => {
    nodes++;
    if (depth > maxDepth) maxDepth = depth;

    let cell = -1;
    for (let i = 0; i < N; i++) {
      if (state.grid[i] === -1) {
        cell = i;
        break;
      }
    }
    if (cell === -1) {
      // 完整赋值：传播已保证各行各列余量为 0 且每个区块奇偶成立。
      found.push(bitsToString(state.grid));
      return found.length >= 2;
    }

    for (const val of [0, 1] as const) {
      const snap = snapshot();
      state.queue.length = 0;
      enqueue(cell, val);
      if (drainQueue() && dfs(depth + 1)) return true;
      restore(snap);
    }
    return false;
  };

  dfs(0);

  if (found.length === 0) return impossible(nodes, maxDepth);

  if (found.length === 1) {
    return { status: 'unique', solutions: found, witness: null, firstDifference: null, nodes, maxDepth };
  }

  const [s1, s2] = found;
  let d = 0;
  while (d < N && s1[d] === s2[d]) d++;
  // 见证：共同前缀 + 分叉位置 0（s1 在该位必为 0、s2 必为 1），其余未定（'?'）。
  const witness = `${s1.slice(0, d)}0${'?'.repeat(N - d - 1)}`;
  return {
    status: 'ambiguous',
    solutions: found,
    witness,
    firstDifference: d,
    nodes,
    maxDepth,
  };
}
