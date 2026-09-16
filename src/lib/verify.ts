import type { PuzzleInput } from './types';

/** 核验一个完整行优先位串是否满足谜题的全部约束（基数、已知位、区块异或）。 */
export function verifySolution(puzzle: PuzzleInput, bits: string): boolean {
  const { height: H, width: W } = puzzle;
  if (bits.length !== H * W || !/^[01]+$/.test(bits)) return false;

  const at = (r: number, c: number): number => bits.charCodeAt(r * W + c) - 48;

  for (let r = 0; r < H; r++) {
    let s = 0;
    for (let c = 0; c < W; c++) s += at(r, c);
    if (s !== puzzle.rowCounts[r]) return false;
  }
  for (let c = 0; c < W; c++) {
    let s = 0;
    for (let r = 0; r < H; r++) s += at(r, c);
    if (s !== puzzle.colCounts[c]) return false;
  }
  for (const [r, c, v] of puzzle.known) {
    if (at(r, c) !== v) return false;
  }
  for (const [r, c, p] of puzzle.blocks) {
    if ((at(r, c) ^ at(r + 1, c) ^ at(r, c + 1) ^ at(r + 1, c + 1)) !== p) return false;
  }
  return true;
}

/** 朴素的全枚举参考实现（仅用于小规模交叉验证）。 */
export function bruteForce(puzzle: PuzzleInput): string[] {
  const N = puzzle.height * puzzle.width;
  const out: string[] = [];
  const bits = new Uint8Array(N);
  const walk = (i: number): void => {
    if (i === N) {
      const s = bits.join('');
      if (verifySolution(puzzle, s)) out.push(s);
      return;
    }
    // 行优先、0 先 1 后，与求解器同序。
    bits[i] = 0;
    walk(i + 1);
    bits[i] = 1;
    walk(i + 1);
  };
  walk(0);
  return out;
}

/** 行优先下标 → (r,c)。 */
export function rcOf(index: number, width: number): [number, number] {
  return [Math.floor(index / width), index - Math.floor(index / width) * width];
}
