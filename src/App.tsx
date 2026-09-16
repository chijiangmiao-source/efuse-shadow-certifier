import { useMemo, useState } from 'react';
import Matrix from './components/Matrix';
import { EXAMPLES } from './lib/examples';
import { parseInput } from './lib/parse';
import { solve } from './lib/solver';
import type { PuzzleInput, SolveResult } from './lib/types';
import { rcOf, verifySolution } from './lib/verify';

interface Evidence {
  input: string;
  puzzle: PuzzleInput;
  result: SolveResult;
}

interface Selection {
  key: string;
  cells: number[];
  anchor?: number;
}

const DEFAULT_INPUT = EXAMPLES[0].json;

const STATUS_TEXT: Record<string, string> = {
  unique: 'unique · 唯一解',
  ambiguous: 'ambiguous · 多解',
  impossible: 'impossible · 零解',
};

function initialEvidence(): Evidence | null {
  const parsed = parseInput(EXAMPLES[0].json);
  return parsed.ok
    ? { input: EXAMPLES[0].json, puzzle: parsed.puzzle, result: solve(parsed.puzzle) }
    : null;
}

export default function App() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [evidence, setEvidence] = useState<Evidence | null>(initialEvidence);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [tab, setTab] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const run = () => {
    const parsed = parseInput(input);
    if (!parsed.ok) {
      // 非法输入：一次性列全错误，并清除旧证据。
      setErrors(parsed.errors);
      setEvidence(null);
      setSelection(null);
      setTab(0);
      return;
    }
    const result = solve(parsed.puzzle);
    setEvidence({ input, puzzle: parsed.puzzle, result });
    setErrors(null);
    setSelection(null);
    setTab(0);
  };

  const loadExample = (json: string) => {
    setInput(json);
    const parsed = parseInput(json);
    if (parsed.ok) {
      setEvidence({ input: json, puzzle: parsed.puzzle, result: solve(parsed.puzzle) });
      setErrors(null);
    }
    setSelection(null);
    setTab(0);
  };

  const status = evidence?.result.status ?? null;
  const showMatrix = evidence !== null && status !== 'impossible';
  const bits = evidence && tab < evidence.result.solutions.length
    ? evidence.result.solutions[tab]
    : null;
  const firstDiff = evidence?.result.firstDifference ?? null;

  const constraints = useMemo(() => buildConstraints(evidence, bits), [evidence, bits]);

  const onCellClick = (idx: number) => {
    if (!evidence) return;
    const item = pickConstraintForCell(evidence.puzzle, idx);
    if (item) {
      setSelection({ ...item, anchor: idx });
    }
  };

  return (
    <div className="app">
      <h1>晶圆熔丝阵列复核器</h1>
      <p className="subtitle">
        粘贴 JSON（高宽 1..18、行/列熔断计数、已知 0/1 位、2×2 区块四位异或 p），
        传播回溯求解，行优先位串按 0&lt;1 排序，至多保留字典序最小的两个解。
      </p>

      <div className="panel">
        <h2>输入 JSON</h2>
        <textarea
          data-testid="json-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
        <div className="toolbar">
          <button className="primary" data-testid="run-btn" onClick={run}>
            复核
          </button>
          <span className="example-label">示例：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => loadExample(ex.json)}
              data-testid={`example-${ex.name}`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {errors && (
        <div className="panel errors" data-testid="errors">
          <h2>输入非法（{errors.length} 项错误，已清除上一次证据）</h2>
          <ul className="error-list">
            {errors.map((msg, i) => (
              <li key={i} data-testid="error-item">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence && status && (
        <div className="panel" data-testid="result">
          <div className="result-head">
            <span className={`status-badge status-${status}`} data-testid="status">
              {STATUS_TEXT[status]}
            </span>
            <span className="meta">
              {evidence.puzzle.height}×{evidence.puzzle.width} · 搜索节点 {evidence.result.nodes}
              {typeof evidence.result.maxDepth === 'number' ? ` · 最大深度 ${evidence.result.maxDepth}` : ''}
            </span>
          </div>

          {status === 'impossible' && (
            <p data-testid="impossible-note">
              impossible：基数 / 已知位 / 区块异或相互矛盾，矩阵不展示。
            </p>
          )}

          {status === 'ambiguous' && evidence.result.witness !== null && (
            <div>
              <h2>多解见证</h2>
              <div className="witness" data-testid="witness">
                {evidence.result.witness.split('').map((ch, i) =>
                  i === evidence.result.firstDifference ? (
                    <span key={i} className="diff-char" data-testid="witness-diff">
                      {ch}
                    </span>
                  ) : (
                    <span key={i}>{ch}</span>
                  ),
                )}
              </div>
              <p className="hint">
                首个差异格：行优先下标 {evidence.result.firstDifference}
                {firstDiff !== null && (
                  <>
                    {' '}
                    即 (r,c) = ({rcOf(firstDiff, evidence.puzzle.width)[0]},
                    {rcOf(firstDiff, evidence.puzzle.width)[1]})；
                    见证位串 = 两解共同前缀 + 分叉位置 0，'?' 为未定。
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {showMatrix && evidence && bits && (
        <div className="two-col">
          <div className="panel" data-testid="matrix-panel">
            {status === 'ambiguous' && (
              <div className="solution-tabs">
                {evidence.result.solutions.map((_, i) => (
                  <button
                    key={i}
                    className={tab === i ? 'active' : ''}
                    data-testid={`sol-tab-${i}`}
                    onClick={() => setTab(i)}
                  >
                    字典序第 {i + 1} 小解
                  </button>
                ))}
              </div>
            )}
            <div className="viz-wrap">
              <Matrix
                height={evidence.puzzle.height}
                width={evidence.puzzle.width}
                bits={bits}
                rowCounts={evidence.puzzle.rowCounts}
                colCounts={evidence.puzzle.colCounts}
                firstDifference={status === 'ambiguous' ? firstDiff : null}
                highlightCells={new Set(selection?.cells ?? [])}
                selectedCell={selection?.anchor ?? null}
                onCellClick={onCellClick}
              />
            </div>
            <div className="legend">
              <span>
                <i className="swatch" style={{ background: '#1f2937' }} /> 1 熔断
              </span>
              <span>
                <i className="swatch" style={{ background: '#f9fafb' }} /> 0 完好
              </span>
              <span>
                <i className="swatch" style={{ borderColor: '#2563eb' }} /> 约束联动
              </span>
              <span>
                <i className="swatch" style={{ borderColor: '#dc2626' }} /> 首个差异
              </span>
            </div>
            <p className="hint" data-testid="sol-bits">
              行优先位串：{bits}
              {` · 约束核验：${verifySolution(evidence.puzzle, bits) ? '通过' : '失败'}`}
            </p>
          </div>

          <div className="panel" data-testid="constraints-panel">
            <h2>约束（点击联动单元）</h2>
            <ul className="constraint-list">
              {constraints.map((item) => (
                <li
                  key={item.key}
                  data-testid="constraint-item"
                  data-key={item.key}
                  className={selection?.key === item.key ? 'active' : ''}
                  onClick={() => setSelection({ key: item.key, cells: item.cells })}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConstraintItem {
  key: string;
  label: string;
  cells: number[];
}

function buildConstraints(evidence: Evidence | null, bits: string | null): ConstraintItem[] {
  if (!evidence) return [];
  const { puzzle } = evidence;
  const cur = bits ?? result0(evidence);
  const W = puzzle.width;
  const items: ConstraintItem[] = [];

  puzzle.rowCounts.forEach((cnt, r) => {
    const cells = [];
    for (let c = 0; c < W; c++) cells.push(r * W + c);
    items.push({ key: `row-${r}`, label: `行 r=${r}：熔断数 ${cnt}`, cells });
  });
  puzzle.colCounts.forEach((cnt, c) => {
    const cells = [];
    for (let r = 0; r < puzzle.height; r++) cells.push(r * W + c);
    items.push({ key: `col-${c}`, label: `列 c=${c}：熔断数 ${cnt}`, cells });
  });
  puzzle.known.forEach(([r, c, v], i) => {
    items.push({
      key: `known-${i}`,
      label: `已知位 (${r},${c}) = ${v}（当前 ${cur[r * W + c] ?? '-'}）`,
      cells: [r * W + c],
    });
  });
  puzzle.blocks.forEach(([r, c, p], i) => {
    const a = r * W + c;
    const parity = cur
      ? [a, a + W, a + 1, a + W + 1].reduce((xor, idx) => xor ^ (cur[idx] === '1' ? 1 : 0), 0)
      : '-';
    items.push({
      key: `block-${i}`,
      label: `区块 (${r},${c})：四位异或 = ${p}（当前 ${parity}）`,
      cells: [a, a + 1, a + W, a + W + 1],
    });
  });
  return items;
}

function result0(evidence: Evidence): string {
  return evidence.result.solutions[0] ?? '';
}

function pickConstraintForCell(puzzle: PuzzleInput, idx: number): Selection | null {
  const W = puzzle.width;
  const [r, c] = rcOf(idx, W);
  const bi = puzzle.blocks.findIndex(([br, bc]) => {
    // idx 属于以 (br,bc) 为左上角的 2×2 区块。
    return br <= r && br + 1 >= r && bc <= c && bc + 1 >= c;
  });
  if (bi >= 0) {
    const [br, bc] = puzzle.blocks[bi];
    const a = br * W + bc;
    return {
      key: `block-${bi}`,
      cells: [a, a + 1, a + W, a + W + 1],
    };
  }
  const ki = puzzle.known.findIndex(([kr, kc]) => kr === r && kc === c);
  if (ki >= 0) {
    const [kr, kc] = puzzle.known[ki];
    return { key: `known-${ki}`, cells: [kr * W + kc] };
  }
  return {
    key: `row-${r}`,
    cells: Array.from({ length: W }, (_, cc) => r * W + cc),
  };
}
