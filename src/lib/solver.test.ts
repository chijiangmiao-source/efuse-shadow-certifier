import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { solve } from './solver';
import type { PuzzleInput } from './types';
import { bruteForce, verifySolution } from './verify';

const byName = (name: string): PuzzleInput =>
  EXAMPLES.find((e) => e.name === name)!.puzzle;

describe('验收夹具：深层唯一解', () => {
  const puz = byName('unique');

  it('状态为 unique，位串与朴素枚举的唯一解一致', () => {
    const res = solve(puz);
    const all = bruteForce(puz);
    expect(all).toHaveLength(1);
    expect(res.status).toBe('unique');
    expect(res.solutions).toEqual(['0010100101000111']);
    expect(res.solutions).toEqual(all);
    expect(res.witness).toBeNull();
    expect(res.firstDifference).toBeNull();
  });

  it('解确实满足全部基数、已知位与区块异或', () => {
    expect(verifySolution(puz, '0010100101000111')).toBe(true);
  });

  it('必须深层分叉：无区块约束时不唯一，完整求解需要多层回溯', () => {
    const res = solve(puz);
    expect(res.maxDepth).toBeGreaterThanOrEqual(4);
    expect(solve({ ...puz, blocks: [] }).status).not.toBe('unique');
  });
});

describe('验收夹具：晚分叉多解', () => {
  const puz = byName('ambiguous');

  it('朴素枚举共 10 解，求解器只保留字典序最小两个', () => {
    const all = bruteForce(puz);
    expect(all.length).toBeGreaterThan(2);
    expect(all).toHaveLength(10);
    const res = solve(puz);
    expect(res.status).toBe('ambiguous');
    expect(res.solutions).toHaveLength(2);
    expect(res.solutions).toEqual(all.slice(0, 2));
    expect(res.solutions[0] < res.solutions[1]).toBe(true);
  });

  it('见证与首差位置稳定：共同前缀 9 位，idx 9 首次分叉', () => {
    const res = solve(puz);
    expect(res.firstDifference).toBe(9);
    expect(res.solutions[0].slice(0, 9)).toBe(res.solutions[1].slice(0, 9));
    expect(res.solutions[0][9]).toBe('0');
    expect(res.solutions[1][9]).toBe('1');
    expect(res.witness).toBe(`${res.solutions[0].slice(0, 9)}0${'?'.repeat(6)}`);
    // 见证的已定位前缀与两解一致，因此本身可由 s1 满足。
    expect(verifySolution(puz, res.solutions[0])).toBe(true);
    expect(verifySolution(puz, res.solutions[1])).toBe(true);
  });

  it('不得枚举全部解：访问节点数远小于解空间 2^16', () => {
    const res = solve(puz);
    expect(res.nodes).toBeLessThan(20);
  });

  it('重复运行结果完全一致（确定性）', () => {
    expect(solve(puz)).toEqual(solve(puz));
  });
});

describe('验收夹具：传播后矛盾', () => {
  const puz = byName('impossible');

  it('状态为 impossible，朴素枚举同样 0 解', () => {
    const res = solve(puz);
    expect(res.status).toBe('impossible');
    expect(res.solutions).toEqual([]);
    expect(res.witness).toBeNull();
    expect(res.firstDifference).toBeNull();
    expect(bruteForce(puz)).toHaveLength(0);
  });

  it('矛盾在多层分叉后的传播中暴露（不是总量短路）', () => {
    const res = solve(puz);
    expect(res.maxDepth).toBeGreaterThanOrEqual(4);
    // 行/列各自自洽且总量相等，证明不是开局短路。
    expect(puz.rowCounts.reduce((a, b) => a + b, 0)).toBe(
      puz.colCounts.reduce((a, b) => a + b, 0),
    );
  });

  it('纯基数传播即可发现的矛盾也被识别', () => {
    const p: PuzzleInput = {
      height: 3,
      width: 3,
      rowCounts: [3, 0, 0],
      colCounts: [1, 1, 1],
      known: [],
      blocks: [[0, 0, 1]], // 唯一区块四格被基数钉死为 1,1,0,0，奇偶为 0 ≠ 1
    };
    expect(solve(p).status).toBe('impossible');
  });
});

describe('大规模多解时不枚举', () => {
  it('18×18 半空盘面也只返回两个解且快速完成', () => {
    const puz: PuzzleInput = {
      height: 18,
      width: 18,
      rowCounts: Array(18).fill(9),
      colCounts: Array(18).fill(9),
      known: [],
      blocks: [],
    };
    const t0 = Date.now();
    const res = solve(puz);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(res.status).toBe('ambiguous');
    expect(res.solutions).toHaveLength(2);
    expect(res.solutions[0] < res.solutions[1]).toBe(true);
    for (const s of res.solutions) expect(verifySolution(puz, s)).toBe(true);
    // 解空间是天文数字，节点数有界即证明找到两解后立即停止。
    expect(res.nodes).toBeLessThan(2000);
  });
});

describe('与朴素全枚举的随机一致性（字典序前两解）', () => {
  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cases: Array<{ h: number; w: number }> = [
    { h: 1, w: 1 }, { h: 1, w: 4 }, { h: 4, w: 1 }, { h: 3, w: 3 }, { h: 4, w: 4 },
  ];

  it.each(cases)('$h×$w 随机实例状态与前两解完全吻合', ({ h, w }) => {
    const rnd = mulberry32(42 + h * 31 + w);
    for (let trial = 0; trial < 60; trial++) {
      const g = Array.from({ length: h * w }, () => (rnd() < 0.5 ? 1 : 0));
      const rowCounts = Array(h).fill(0);
      const colCounts = Array(w).fill(0);
      g.forEach((v, i) => {
        if (v) {
          rowCounts[Math.floor(i / w)]++;
          colCounts[i % w]++;
        }
      });
      const blocks: Array<[number, number, number]> = [];
      for (let r = 0; r < h - 1; r++)
        for (let c = 0; c < w - 1; c++)
          if (rnd() < 0.4)
            blocks.push([
              r, c,
              g[r * w + c] ^ g[(r + 1) * w + c] ^ g[r * w + c + 1] ^ g[(r + 1) * w + c + 1],
            ]);
      const puz: PuzzleInput = { height: h, width: w, rowCounts, colCounts, known: [], blocks };
      const res = solve(puz);
      const all = bruteForce(puz);
      if (all.length === 0) {
        expect(res.status).toBe('impossible');
        expect(res.solutions).toEqual([]);
      } else if (all.length === 1) {
        expect(res.status).toBe('unique');
        expect(res.solutions).toEqual(all);
      } else {
        expect(res.status).toBe('ambiguous');
        expect(res.solutions).toEqual(all.slice(0, 2));
        // 首差与见证内部自洽。
        const d = res.firstDifference!;
        expect(res.solutions[0].slice(0, d)).toBe(res.solutions[1].slice(0, d));
        expect(res.solutions[0][d]).toBe('0');
        expect(res.solutions[1][d]).toBe('1');
        expect(res.witness![d]).toBe('0');
      }
    }
  });
});
