import type { ValidationResult } from './types';

const isInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v);

/**
 * 校验用户粘贴的 JSON。所有可独立判定的错误一次性列全；
 * 缺项 / 计数越界 / 重复坐标 / 已知位冲突 / 区块越界各自给出稳定信息。
 */
export function parseInput(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON 无法解析：${(e as Error).message}`] };
  }

  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['顶层必须是 JSON 对象，例如 {"height":…,"width":…}'] };
  }
  const o = raw as Record<string, unknown>;

  const dims = { height: false, width: false };
  for (const key of ['height', 'width'] as const) {
    if (!isInt(o[key])) errors.push(`${key} 缺项或不是整数`);
    else if (o[key] < 1 || o[key] > 18) errors.push(`${key} 必须在 1 到 18 之间（当前 ${o[key]}）`);
    else dims[key] = true;
  }
  const H = dims.height ? (o.height as number) : 0;
  const W = dims.width ? (o.width as number) : 0;

  const rowCounts = validateCounts('rowCounts', o.rowCounts, H, W, 'height', 'width', errors);
  const colCounts = validateCounts('colCounts', o.colCounts, W, H, 'width', 'height', errors);

  const known = validateKnown(o.known, H, W, dims, errors);
  const blocks = validateBlocks(o.blocks, H, W, dims, errors);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    puzzle: {
      height: H,
      width: W,
      rowCounts: rowCounts as number[],
      colCounts: colCounts as number[],
      known: known as Array<[number, number, number]>,
      blocks: blocks as Array<[number, number, number]>,
    },
  };
}

function validateCounts(
  name: string,
  value: unknown,
  expectLen: number,
  bound: number,
  lenDim: string,
  boundDim: string,
  errors: string[],
): number[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${name} 缺项或不是数组`);
    return null;
  }
  if (expectLen > 0 && value.length !== expectLen) {
    errors.push(`${name} 长度必须为 ${lenDim}=${expectLen}（当前 ${value.length}）`);
  }
  const out: number[] = [];
  value.forEach((entry, i) => {
    if (!isInt(entry) || entry < 0 || (bound > 0 && entry > bound)) {
      const range = bound > 0 ? `0..${bound}` : '非负整数';
      errors.push(`${name}[${i}] 必须是不超过另一维（${boundDim}）的${range}整数（当前 ${String(entry)}）`);
    }
    out.push(isInt(entry) ? entry : NaN);
  });
  return out;
}

function validateKnown(
  value: unknown,
  H: number,
  W: number,
  dims: { height: boolean; width: boolean },
  errors: string[],
): Array<[number, number, number]> | null {
  if (value === undefined || !Array.isArray(value)) {
    errors.push('known 缺项或不是数组');
    return null;
  }

  const seen = new Map<number, number>();
  const out: Array<[number, number, number]> = [];

  value.forEach((entry, i) => {
    const shape =
      Array.isArray(entry) && entry.length === 3 &&
      entry.every((x) => typeof x === 'number');
    if (!shape) {
      errors.push(`known[${i}] 必须是 [r,c,v] 三元组（当前 ${JSON.stringify(entry)}）`);
      return;
    }
    const [r, c, v] = entry as [number, number, number];
    const rBad = !Number.isInteger(r) || (dims.height && (r < 0 || r >= H));
    const cBad = !Number.isInteger(c) || (dims.width && (c < 0 || c >= W));
    const vBad = !Number.isInteger(v) || (v !== 0 && v !== 1);
    if (rBad) errors.push(`known[${i}] 的 r 越界或非整数（当前 ${r}，允许 0..${dims.height ? H - 1 : '?'}）`);
    if (cBad) errors.push(`known[${i}] 的 c 越界或非整数（当前 ${c}，允许 0..${dims.width ? W - 1 : '?'}）`);
    if (vBad) errors.push(`known[${i}] 的 v 必须是 0 或 1（当前 ${v}）`);

    // 坐标为整数即可进行重复判定（即使越界，重复仍是独立错误）。
    if (Number.isInteger(r) && Number.isInteger(c)) {
      const key = r * (W || 1) + c;
      const prev = seen.get(key);
      if (prev !== undefined) {
        errors.push(`known[${i}] 重复坐标 (${r},${c})`);
        if (!vBad && prev !== v) {
          errors.push(`known[${i}] 与已知位冲突 (${r},${c})：${prev} ≠ ${v}`);
        }
      } else {
        // 越界条目不进入谜题，但仍登记，以便后续重复一并报错。
        if (!vBad) seen.set(key, v);
        if (!rBad && !cBad && !vBad) out.push([r, c, v]);
      }
    }
  });
  return out;
}

function validateBlocks(
  value: unknown,
  H: number,
  W: number,
  dims: { height: boolean; width: boolean },
  errors: string[],
): Array<[number, number, number]> | null {
  if (value === undefined || !Array.isArray(value)) {
    errors.push('blocks 缺项或不是数组');
    return null;
  }

  const seen = new Set<number>();
  const out: Array<[number, number, number]> = [];

  value.forEach((entry, i) => {
    const shape =
      Array.isArray(entry) && entry.length === 3 &&
      entry.every((x) => typeof x === 'number');
    if (!shape) {
      errors.push(`blocks[${i}] 必须是 [r,c,p] 三元组（当前 ${JSON.stringify(entry)}）`);
      return;
    }
    const [r, c, p] = entry as [number, number, number];
    // 2×2 区块必须完整落在盘内：r ∈ 0..H-2，c ∈ 0..W-2
    const rBad = !Number.isInteger(r) || (dims.height && (r < 0 || r > H - 2));
    const cBad = !Number.isInteger(c) || (dims.width && (c < 0 || c > W - 2));
    const pBad = !Number.isInteger(p) || (p !== 0 && p !== 1);
    if (rBad) errors.push(`blocks[${i}] 区块越界：r 必须在 0..${dims.height ? H - 2 : '?'}（当前 ${r}）`);
    if (cBad) errors.push(`blocks[${i}] 区块越界：c 必须在 0..${dims.width ? W - 2 : '?'}（当前 ${c}）`);
    if (pBad) errors.push(`blocks[${i}] 的 p 为四位异或结果，必须是 0 或 1（当前 ${p}）`);

    if (Number.isInteger(r) && Number.isInteger(c)) {
      const key = r * (W || 1) + c;
      if (seen.has(key)) {
        errors.push(`blocks[${i}] 重复区块坐标 (${r},${c})`);
      } else {
        seen.add(key);
        if (!rBad && !cBad && !pBad) out.push([r, c, p]);
      }
    }
  });
  return out;
}
