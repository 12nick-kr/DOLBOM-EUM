import { expect, test, type Page } from '@playwright/test';

async function openRole(page: Page, role: 'senior' | 'family' | 'worker') {
  const port = process.env.PLAYWRIGHT_PORT || '3100';
  await page.context().addCookies([{ name: 'demo-role', value: role, url: `http://127.0.0.1:${port}`, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(`/${role}`);
}

test('senior can initiate a hospital escort request with accessible controls', async ({ page }) => {
  await openRole(page, 'senior');
  await expect(page.getByText('챌린지 데모 — 실제 접수 아님')).toBeVisible();
  await expect(page.getByRole('button', { name: '말하기 시작' })).toBeVisible();
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByRole('heading', { name: '입력한 내용이 맞나요?' })).toBeVisible();
  await page.getByRole('button', { name: '이 내용 분석하기' }).click();
  await expect(page.getByText('병원 동행 요청이에요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('텍스트 입력 원문')).toBeVisible();
  await expect(page.getByText('AI 요약')).toBeVisible();
  await page.getByRole('button', { name: '보내주세요' }).click();
  await expect(page.getByText('내 요청 보기')).toBeVisible();
});

test('emergency button requires one confirmation before dialing', async ({ page }) => {
  await openRole(page, 'senior');
  await page.getByRole('button', { name: '긴급 도움' }).click();
  await expect(page.getByRole('link', { name: /119/ })).toHaveCount(0);
  await page.getByRole('button', { name: /119 전화하기/ }).click();
  await expect(page.getByRole('link', { name: /119/ })).toHaveAttribute('href', 'tel:119');
  await expect(page.getByText(/신고 완료/)).toHaveCount(0);
});

test('emergency dock does not cover the final request action on a compact senior screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openRole(page, 'senior');
  await page.getByRole('button', { name: '보내기' }).click();
  await page.getByRole('button', { name: '이 내용 분석하기' }).click();
  const sendButton = page.getByRole('button', { name: '보내주세요' });
  await expect(sendButton).toBeVisible({ timeout: 20_000 });
  await sendButton.scrollIntoViewIfNeeded();
  const actionBox = await sendButton.boundingBox();
  const footerBox = await page.locator('.senior-footer').boundingBox();
  expect(actionBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(footerBox!.y);
});

test('family and worker see emergency data from the server', async ({ page }) => {
  await openRole(page, 'family');
  await page.getByText('가슴이 조이고 숨쉬기가 힘들어요.').click();
  await expect(page.getByText('위기 알림 상세')).toBeVisible();
  await page.context().clearCookies();
  await openRole(page, 'worker');
  await expect(page.getByText(/김순자 어르신 · 가슴이 조이고 숨쉬기가 힘들어요/)).toBeVisible();
});

test('one confirmed senior input becomes the same family and worker card, then status returns to the senior', async ({ browser }) => {
  const seniorContext = await browser.newContext();
  const familyContext = await browser.newContext();
  const workerContext = await browser.newContext();
  const senior = await seniorContext.newPage();
  const family = await familyContext.newPage();
  const worker = await workerContext.newPage();
  const summary = '충남대학교병원 병원 동행 도움이 필요해요.';

  await Promise.all([openRole(senior, 'senior'), openRole(family, 'family'), openRole(worker, 'worker')]);
  await worker.getByRole('button', { name: /요청 업무함/ }).click();
  await senior.getByLabel('도움 요청 입력').fill('내일 충남대학교병원에 같이 가 주세요.');
  await senior.getByRole('button', { name: '보내기' }).click();
  await senior.getByRole('button', { name: '이 내용 분석하기' }).click();
  await expect(senior.getByText('병원 동행 요청이에요')).toBeVisible({ timeout: 20_000 });
  await senior.getByRole('button', { name: '보내주세요' }).click();

  await expect(worker.getByText(summary)).toBeVisible({ timeout: 7000 });
  await expect(family.getByText(summary).first()).toBeVisible({ timeout: 7000 });
  const workerCard = worker.locator('.care-request-card').filter({ hasText: summary });
  await workerCard.getByRole('button', { name: '상세 보기' }).click();
  await worker.getByRole('button', { name: '담당 맡기' }).click();
  await senior.getByRole('button', { name: '내 요청 보기' }).click();
  await expect(senior.getByText('담당자가 확인 중이에요')).toBeVisible({ timeout: 7000 });

  await worker.getByRole('button', { name: '요청 삭제' }).click();
  const deleteDialog = worker.getByRole('dialog', { name: '이 요청을 삭제할까요?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: '삭제' }).click();
  await expect(worker.locator('.care-request-card').filter({ hasText: summary })).toHaveCount(0);
  await expect(family.locator('.care-request-card').filter({ hasText: summary })).toHaveCount(0, { timeout: 4000 });
  await expect(senior.locator('.care-request-card').filter({ hasText: summary })).toHaveCount(0, { timeout: 4000 });

  await Promise.all([seniorContext.close(), familyContext.close(), workerContext.close()]);
});
