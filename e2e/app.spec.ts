import { expect, test } from '@playwright/test';

const UNIQUE_BITS = '0010100101000111';
const AMBIG_1 = '0001011000101101';
const AMBIG_2 = '0001011001001011';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('深层唯一解', () => {
  test('最终状态 unique，矩阵与位串稳定且约束核验通过', async ({ page }) => {
    await page.getByTestId('example-unique').click();

    await expect(page.getByTestId('status')).toHaveText(/unique/);
    await expect(page.getByTestId('matrix-panel')).toBeVisible();
    await expect(page.getByTestId('sol-bits')).toContainText(UNIQUE_BITS);
    await expect(page.getByTestId('sol-bits')).toContainText('约束核验：通过');

    // 16 个单元且取值等于唯一解。
    const cells = page.locator('[data-cell]');
    await expect(cells).toHaveCount(16);
    for (let i = 0; i < 16; i++) {
      await expect(cells.nth(i)).toHaveAttribute('data-v', UNIQUE_BITS[i]);
    }
    // 行/列余量全部为 0（绿色余量文本）。
    await expect(page.locator('.margin-remain')).toHaveCount(8);
    // 无多解见证、无解切换页签。
    await expect(page.getByTestId('witness')).toHaveCount(0);
    await expect(page.getByTestId('sol-tab-0')).toHaveCount(0);
  });
});

test.describe('晚分叉多解', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('example-ambiguous').click();
  });

  test('状态 ambiguous，仅展示字典序最小两解', async ({ page }) => {
    await expect(page.getByTestId('status')).toHaveText(/ambiguous/);
    await expect(page.getByTestId('sol-bits')).toContainText(AMBIG_1);

    await page.getByTestId('sol-tab-1').click();
    await expect(page.getByTestId('sol-bits')).toContainText(AMBIG_2);
    expect(AMBIG_1 < AMBIG_2).toBe(true);
    // 只有两个页签，绝不展示第三解。
    await expect(page.getByTestId('sol-tab-2')).toHaveCount(0);
  });

  test('见证与首差位置稳定：共同前缀 9 位，idx 9 高亮', async ({ page }) => {
    const witness = page.getByTestId('witness');
    await expect(witness).toBeVisible();
    const text = (await witness.textContent()) ?? '';
    expect(text).toBe(`${AMBIG_1.slice(0, 9)}0${'?'.repeat(6)}`);

    const diffMark = page.getByTestId('witness-diff');
    await expect(diffMark).toHaveText('0');

    // 矩阵中首差格 (r=2,c=1) 标红，且两解在该格分别为 0 / 1。
    const diffCell = page.locator('[data-cell="9"]');
    await expect(diffCell).toHaveClass(/cell-diff/);
    await expect(diffCell).toHaveAttribute('data-r', '2');
    await expect(diffCell).toHaveAttribute('data-c', '1');
    await expect(diffCell).toHaveAttribute('data-v', '0');

    await page.getByTestId('sol-tab-1').click();
    await expect(page.locator('[data-cell="9"]')).toHaveAttribute('data-v', '1');
    await expect(page.locator('[data-cell="9"]')).toHaveClass(/cell-diff/);
  });

  test('点击约束联动其单元，再点单元联动约束', async ({ page }) => {
    // 唯一区块 (1,1) 覆盖 (1,1),(1,2),(2,1),(2,2) = idx 5,6,9,10。
    const blockItem = page.locator('[data-key="block-0"]');
    await blockItem.click();
    await expect(blockItem).toHaveClass(/active/);
    for (const idx of [5, 6, 9, 10]) {
      await expect(page.locator(`[data-cell="${idx}"]`)).toHaveClass(/cell-highlight/);
    }
    await expect(page.locator('[data-cell="0"]')).not.toHaveClass(/cell-highlight/);

    // 点击行约束：整行高亮。
    await page.locator('[data-key="row-3"]').click();
    for (let c = 0; c < 4; c++) {
      await expect(page.locator(`[data-cell="${12 + c}"]`)).toHaveClass(/cell-highlight/);
    }

    // 直接点击区块内单元 idx 9，应反选区块约束。
    await page.locator('[data-cell="9"]').click();
    await expect(page.locator('[data-key="block-0"]')).toHaveClass(/active/);
    await expect(page.locator('[data-cell="9"]')).toHaveClass(/cell-selected/);
  });
});

test.describe('传播后矛盾', () => {
  test('状态 impossible 且矩阵隐藏', async ({ page }) => {
    await page.getByTestId('example-impossible').click();
    await expect(page.getByTestId('status')).toHaveText(/impossible/);
    await expect(page.getByTestId('matrix-panel')).toHaveCount(0);
    await expect(page.locator('[data-cell]')).toHaveCount(0);
    await expect(page.getByTestId('impossible-note')).toBeVisible();
  });
});

test.describe('混合非法输入', () => {
  test('一次列全错误并清除旧证据', async ({ page }) => {
    // 先制造合法证据。
    await page.getByTestId('example-unique').click();
    await expect(page.getByTestId('status')).toBeVisible();

    const illegal = JSON.stringify({
      height: 2,
      width: 2,
      rowCounts: [9],
      colCounts: [1, 2, 3],
      known: [
        [0, 0, 1],
        [0, 0, 0],
        [9, 9, 1],
      ],
      blocks: [
        [0, 0, 0],
        [0, 0, 1],
        [3, 3, 0],
      ],
    });
    await page.getByTestId('json-input').fill(illegal);
    await page.getByTestId('run-btn').click();

    const errors = page.getByTestId('error-item');
    expect(await errors.count()).toBeGreaterThanOrEqual(8);
    const body = (await page.getByTestId('errors').textContent()) ?? '';
    expect(body).toContain('rowCounts');
    expect(body).toContain('colCounts');
    expect(body).toContain('重复坐标');
    expect(body).toContain('冲突');
    expect(body).toContain('越界');
    expect(body).toContain('重复区块坐标');

    // 旧证据与矩阵均被清除。
    await expect(page.getByTestId('result')).toHaveCount(0);
    await expect(page.getByTestId('matrix-panel')).toHaveCount(0);

    // 修正为合法输入后错误消失、证据恢复。
    await page.getByTestId('example-ambiguous').click();
    await expect(page.getByTestId('errors')).toHaveCount(0);
    await expect(page.getByTestId('status')).toHaveText(/ambiguous/);
  });
});

test.describe('稳定性', () => {
  test('最终状态、见证与首差在重复复核间完全一致', async ({ page }) => {
    await page.getByTestId('example-ambiguous').click();
    const snap1 = {
      status: await page.getByTestId('status').textContent(),
      bits: await page.getByTestId('sol-bits').textContent(),
      witness: await page.getByTestId('witness').textContent(),
      diffClass: await page.locator('[data-cell="9"]').getAttribute('class'),
    };
    // 切到第二解再重新复核。
    await page.getByTestId('sol-tab-1').click();
    await page.getByTestId('run-btn').click();
    const snap2 = {
      status: await page.getByTestId('status').textContent(),
      bits: await page.getByTestId('sol-bits').textContent(),
      witness: await page.getByTestId('witness').textContent(),
      diffClass: await page.locator('[data-cell="9"]').getAttribute('class'),
    };
    expect(snap2).toEqual(snap1);

    // 整页重载后依然一致。
    await page.reload();
    // 重载回到默认（unique 示例初始证据），重新点 ambiguous。
    await page.getByTestId('example-ambiguous').click();
    const snap3 = {
      status: await page.getByTestId('status').textContent(),
      bits: await page.getByTestId('sol-bits').textContent(),
      witness: await page.getByTestId('witness').textContent(),
      diffClass: await page.locator('[data-cell="9"]').getAttribute('class'),
    };
    expect(snap3).toEqual(snap1);
  });
});
