import { describe, expect, it } from 'vitest';
import { parseInput } from './parse';

const errorsOf = (text: string): string[] => {
  const r = parseInput(text);
  if (r.ok) throw new Error('预期校验失败，但通过了');
  return r.errors;
};

const ok = (text: string) => {
  const r = parseInput(text);
  if (!r.ok) throw new Error(`预期通过，但报错：${r.errors.join('; ')}`);
  return r.puzzle;
};

describe('合法输入', () => {
  it('最小 1×1（无区块）', () => {
    const p = ok(JSON.stringify({
      height: 1, width: 1, rowCounts: [0], colCounts: [1], known: [[0, 0, 0]], blocks: [],
    }));
    expect(p.blocks).toEqual([]);
  });

  it('1 行/1 列的边界计数', () => {
    ok(JSON.stringify({
      height: 1, width: 18, rowCounts: [18], colCounts: Array(18).fill(1), known: [], blocks: [],
    }));
    ok(JSON.stringify({
      height: 18, width: 1, rowCounts: Array(18).fill(1), colCounts: [18], known: [], blocks: [],
    }));
  });
});

describe('缺项一次列全', () => {
  it('空对象报出全部六个字段问题（height/width/两组计数/known/blocks）', () => {
    const errs = errorsOf('{}');
    expect(errs).toHaveLength(6);
    expect(errs.join('\n')).toContain('height');
    expect(errs.join('\n')).toContain('width');
    expect(errs.join('\n')).toContain('rowCounts');
    expect(errs.join('\n')).toContain('colCounts');
    expect(errs.join('\n')).toContain('known');
    expect(errs.join('\n')).toContain('blocks');
  });

  it('非法 JSON', () => {
    expect(errorsOf('{not json')[0]).toContain('JSON 无法解析');
  });

  it('顶层为数组', () => {
    expect(errorsOf('[]')[0]).toContain('顶层');
  });
});

describe('高宽与计数越界', () => {
  it('高宽超界与为 0 同时报告', () => {
    const errs = errorsOf(JSON.stringify({
      height: 0, width: 19, rowCounts: [], colCounts: [], known: [], blocks: [],
    }));
    expect(errs.some((e) => e.includes('height'))).toBe(true);
    expect(errs.some((e) => e.includes('width'))).toBe(true);
  });

  it('计数长度不符、超过另一维、负数一次列全', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 3,
      rowCounts: [4, -1, 1],
      colCounts: [2],
      known: [], blocks: [],
    }));
    const joined = errs.join('\n');
    expect(joined).toContain('rowCounts 长度必须为 height=2');
    expect(joined).toMatch(/rowCounts\[0\].*0\.\.3/);
    expect(joined).toContain('rowCounts[1]');
    expect(joined).toContain('colCounts 长度必须为 width=3');
  });

  it('行/列熔断总量不等不是输入错误（交由求解器判 impossible）', () => {
    const p = ok(JSON.stringify({
      height: 2, width: 2, rowCounts: [2, 2], colCounts: [1, 1], known: [], blocks: [],
    }));
    expect(p.rowCounts).toEqual([2, 2]);
  });
});

describe('已知位', () => {
  it('坐标重复且取值冲突：重复与冲突分别报出', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [1, 1], colCounts: [1, 1],
      known: [[0, 0, 0], [0, 0, 1]],
      blocks: [],
    }));
    expect(errs.some((e) => e.includes('重复坐标 (0,0)'))).toBe(true);
    expect(errs.some((e) => e.includes('冲突') && e.includes('0 ≠ 1'))).toBe(true);
  });

  it('坐标重复但取值一致：只报重复不报冲突', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [1, 1], colCounts: [1, 1],
      known: [[1, 1, 1], [1, 1, 1]],
      blocks: [],
    }));
    expect(errs.some((e) => e.includes('重复坐标 (1,1)'))).toBe(true);
    expect(errs.some((e) => e.includes('冲突'))).toBe(false);
  });

  it('越界坐标与非法 v 各自报出', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [0, 0], colCounts: [0, 0],
      known: [[2, 0, 1], [0, 5, 2]],
      blocks: [],
    }));
    const joined = errs.join('\n');
    expect(joined).toContain('r 越界');
    expect(joined).toContain('c 越界');
    expect(joined).toContain('v 必须是 0 或 1');
  });

  it('三元组形状错误', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [0, 0], colCounts: [0, 0],
      known: [[0, 0]],
      blocks: [],
    }));
    expect(errs[0]).toContain('known[0] 必须是 [r,c,v]');
  });
});

describe('区块', () => {
  it('2×2 区块右下角必须落盘：r=H-1 / c=W-1 越界', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [0, 0], colCounts: [0, 0], known: [],
      blocks: [[1, 0, 0], [0, 1, 1]],
    }));
    expect(errs.some((e) => e.includes('blocks[0]') && e.includes('r 必须在 0..0'))).toBe(true);
    expect(errs.some((e) => e.includes('blocks[1]') && e.includes('c 必须在 0..0'))).toBe(true);
  });

  it('重复区块坐标报出（p 不同也不产生额外条目）', () => {
    const errs = errorsOf(JSON.stringify({
      height: 3, width: 3,
      rowCounts: [1, 1, 1], colCounts: [1, 1, 1], known: [],
      blocks: [[0, 0, 0], [0, 0, 1]],
    }));
    expect(errs.some((e) => e.includes('重复区块坐标 (0,0)'))).toBe(true);
  });

  it('越界的重复区块：越界与重复同时报出', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [0, 0], colCounts: [0, 0], known: [],
      blocks: [[5, 5, 0], [5, 5, 1]],
    }));
    expect(errs.some((e) => e.includes('blocks[1]') && e.includes('重复区块坐标 (5,5)'))).toBe(true);
    expect(errs.filter((e) => e.includes('r 必须在')).length).toBe(2);
  });

  it('p 非 0/1 报出', () => {
    const errs = errorsOf(JSON.stringify({
      height: 2, width: 2,
      rowCounts: [0, 0], colCounts: [0, 0], known: [],
      blocks: [[0, 0, 3]],
    }));
    expect(errs.some((e) => e.includes('p 为四位异或'))).toBe(true);
  });
});

describe('混合非法输入：所有独立错误一次列全', () => {
  it('维度合法时：长度不符、计数越界、重复、冲突、区块越界同时报出', () => {
    const text = JSON.stringify({
      height: 2,
      width: 2,
      rowCounts: [9],
      colCounts: [1, 2, 3],
      known: [
        [0, 0, 1],
        [0, 0, 0], // 重复 + 冲突
        [9, 9, 1], // 双越界
      ],
      blocks: [
        [0, 0, 0],
        [0, 0, 1], // 重复区块
        [3, 3, 0], // 区块越界
      ],
    });
    const errs = errorsOf(text);
    const joined = errs.join('\n');
    expect(joined).toContain('rowCounts 长度');
    expect(joined).toMatch(/rowCounts\[0\].*0\.\.2/);
    expect(joined).toContain('colCounts 长度');
    expect(joined).toContain('重复坐标 (0,0)');
    expect(joined).toContain('冲突');
    expect(errs.filter((e) => e.includes('r 越界')).length).toBeGreaterThan(0);
    expect(errs.filter((e) => e.includes('c 越界')).length).toBeGreaterThan(0);
    expect(joined).toContain('重复区块坐标 (0,0)');
    expect(errs.filter((e) => e.includes('区块越界')).length).toBeGreaterThan(0);
    // 错误信息顺序稳定：连续两次解析结果完全一致。
    expect(errorsOf(text)).toEqual(errorsOf(text));
  });

  it('维度缺项时：缺项与不依赖维度的结构错误仍同时报出', () => {
    const text = JSON.stringify({
      height: 2,
      // width 缺失
      rowCounts: [],
      colCounts: [],
      known: [[0, 0]], // 形状/取值错误不依赖维度
      blocks: [[0, 0, 5]], // p 错误不依赖维度
    });
    const errs = errorsOf(text);
    const joined = errs.join('\n');
    expect(joined).toContain('width 缺项');
    expect(joined).toContain('rowCounts 长度');
    expect(joined).toContain('known[0] 必须是 [r,c,v]');
    expect(joined).toContain('p 为四位异或');
    expect(errorsOf(text)).toEqual(errorsOf(text));
  });
});
