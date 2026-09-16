interface MatrixProps {
  height: number;
  width: number;
  bits: string;
  rowCounts: number[];
  colCounts: number[];
  firstDifference?: number | null;
  highlightCells?: ReadonlySet<number>;
  selectedCell?: number | null;
  onCellClick?: (index: number) => void;
}

const CELL = 28;
const PAD_L = 40;
const PAD_T = 34;

/**
 * SVG 熔丝矩阵：深色格 = 1（熔断），浅色格 = 0（完好）。
 * 左侧/上侧余量 = 该行/列尚需熔断数（当前解下为 0，绿色）。
 */
export default function Matrix({
  height,
  width,
  bits,
  rowCounts,
  colCounts,
  firstDifference = null,
  highlightCells,
  selectedCell = null,
  onCellClick,
}: MatrixProps) {
  const vbW = PAD_L + width * CELL + 8;
  const vbH = PAD_T + height * CELL + 8;

  const rowOnes = new Array<number>(height).fill(0);
  const colOnes = new Array<number>(width).fill(0);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (bits.charCodeAt(r * width + c) === 49) {
        rowOnes[r]++;
        colOnes[c]++;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      style={{ maxWidth: vbW, minWidth: 320 }}
      role="img"
      aria-label="熔丝矩阵"
    >
      {/* 列头：需求 / 剩余 */}
      {colCounts.map((cnt, c) => {
        const remain = cnt - colOnes[c];
        return (
          <g key={`col-${c}`}>
            <text x={PAD_L + c * CELL + CELL / 2} y={11} className="margin-text">
              {cnt}
            </text>
            <text
              x={PAD_L + c * CELL + CELL / 2}
              y={25}
              className={`margin-text ${remain === 0 ? 'margin-remain' : ''}`}
            >
              {remain}
            </text>
          </g>
        );
      })}

      {/* 行头 */}
      {rowCounts.map((cnt, r) => {
        const remain = cnt - rowOnes[r];
        return (
          <g key={`row-${r}`}>
            <text x={12} y={PAD_T + r * CELL + CELL / 2 - 6} className="margin-text">
              {cnt}
            </text>
            <text
              x={12}
              y={PAD_T + r * CELL + CELL / 2 + 7}
              className={`margin-text ${remain === 0 ? 'margin-remain' : ''}`}
            >
              {remain}
            </text>
          </g>
        );
      })}

      {/* 单元 */}
      {Array.from({ length: height }, (_, r) =>
        Array.from({ length: width }, (_, c) => {
          const idx = r * width + c;
          const v = bits[idx] === '1';
          const isDiff = firstDifference === idx;
          const isHi = highlightCells?.has(idx);
          const isSel = selectedCell === idx;
          const cls = [
            isHi ? 'cell-highlight' : '',
            isSel ? 'cell-selected' : '',
            isDiff ? 'cell-diff' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g
              key={idx}
              className={cls}
              data-cell={idx}
              data-r={r}
              data-c={c}
              data-v={v ? 1 : 0}
              onClick={() => onCellClick?.(idx)}
            >
              <rect
                className={`cell-rect ${v ? 'cell-one' : 'cell-zero'}`}
                x={PAD_L + c * CELL + 1}
                y={PAD_T + r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={3}
              />
              <text
                className={`cell-text ${v ? 'cell-text-one' : 'cell-text-zero'}`}
                x={PAD_L + c * CELL + CELL / 2}
                y={PAD_T + r * CELL + CELL / 2 + 1}
              >
                {v ? '1' : '0'}
              </text>
              {isDiff && (
                <text
                  className="diff-marker"
                  x={PAD_L + c * CELL + CELL / 2}
                  y={PAD_T + r * CELL - 2}
                >
                  ▲
                </text>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
