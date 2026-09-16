import type { PuzzleInput } from './types';

export interface NamedExample {
  name: string;
  label: string;
  puzzle: PuzzleInput;
  json: string;
}

/**
 * 验收夹具。三者均已用 src/lib/verify.ts 的朴素全枚举（bruteForce）交叉验证：
 *  - unique：枚举恰 1 解，且与求解器输出位串一致；
 *  - ambiguous：枚举共 10 解，求解器只保留字典序最小两个，首差稳定在 idx 9；
 *  - impossible：枚举 0 解，矛盾需经历 4 层分叉后的传播才能暴露。
 */
export const EXAMPLES: NamedExample[] = [
  {
    name: 'unique',
    label: '深层唯一解',
    puzzle: {
      height: 4,
      width: 4,
      rowCounts: [1, 2, 1, 3],
      colCounts: [1, 2, 2, 2],
      known: [],
      blocks: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
        [2, 1, 1],
        [2, 2, 0],
      ],
    },
    json: '',
  },
  {
    name: 'ambiguous',
    label: '晚分叉多解',
    puzzle: {
      height: 4,
      width: 4,
      // 共 10 个解；行优先前两解为
      // 0001011000101101 与 0001011001001011，前 9 位相同，idx 9（(2,1)）首次分叉。
      rowCounts: [1, 2, 1, 3],
      colCounts: [1, 2, 2, 2],
      known: [],
      blocks: [[1, 1, 1]],
    },
    json: '',
  },
  {
    name: 'impossible',
    label: '传播后矛盾',
    puzzle: {
      // 与唯一解夹具仅差区块 (2,2) 的奇偶翻转；单行/列基数均自洽，
      // 矛盾要到第 4 层分叉后的传播中才出现（maxDepth=4）。
      height: 4,
      width: 4,
      rowCounts: [1, 2, 1, 3],
      colCounts: [1, 2, 2, 2],
      known: [],
      blocks: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
        [2, 1, 1],
        [2, 2, 1],
      ],
    },
    json: '',
  },
];

for (const ex of EXAMPLES) ex.json = JSON.stringify(ex.puzzle, null, 2);
