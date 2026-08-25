import { expect, test, type Page } from '@playwright/test';
import { randomInt } from 'node:crypto';

type Role = 'senior' | 'family' | 'worker';
const nextLoginId = () => `010-0000-${String(randomInt(1, 10_000)).padStart(4, '0')}`;

async function signup(page: Page, role: Role, displayName: string) {
  const loginId = nextLoginId();
  const response = await page.request.post('/api/auth/signup', { data: { displayName, loginId, pin: '123456', pinConfirm: '123456', role } });
  expect(response.status(), await response.text()).toBe(201);
  await page.goto(`/${role}`);
  return loginId;
}

async function lookupAccount(worker: Page, loginId: string) {
  const response = await worker.request.get(`/api/care-management/accounts?loginId=${encodeURIComponent(loginId)}`);
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json() as { profile: { id: string; role: Role } | null };
  expect(body.profile).not.toBeNull();
  return body.profile!;
}

async function connectCareChain(worker: Page, seniorLoginId: string, familyLoginId: string) {
  const senior = await lookupAccount(worker, seniorLoginId);
  const family = await lookupAccount(worker, familyLoginId);
  const workerLink = await worker.request.post('/api/care-management/relationships', { data: { relationshipType: 'worker', seniorId: senior.id } });
  expect(workerLink.status(), await workerLink.text()).toBe(201);
  const familyLink = await worker.request.post('/api/care-management/relationships', { data: { relationshipType: 'family', seniorId: senior.id, memberId: family.id } });
  expect(familyLink.status(), await familyLink.text()).toBe(201);
}

test('first visit shows login and signup creates a role-scoped account without SMS', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: '회원가입' }).click();
  await page.getByRole('button', { name: /부양가족/ }).click();
  await page.getByLabel('이름').fill('데모 가족');
  await page.getByLabel('전화번호형 아이디').fill(nextLoginId());
  await page.getByLabel('로그인 비밀번호 숫자 6자리').fill('123456');
  await page.getByLabel('비밀번호 확인').fill('123456');
  await page.getByRole('button', { name: '계정 만들기' }).click();
  await expect(page).toHaveURL(/\/family$/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
});

test('senior can analyze and send one request card', async ({ page }) => {
  await signup(page, 'senior', '요청 어르신');
  await page.getByLabel('도움 요청 입력').fill('내일 충남대학교병원에 같이 가 주세요.');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('병원 동행 요청이에요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('텍스트 입력 원문')).toBeVisible();
  await expect(page.getByText('AI 요약')).toBeVisible();
  await page.getByRole('button', { name: '보내주세요' }).click();
  await expect(page.getByText('내 요청 보기')).toBeVisible();
});

test('emergency dock keeps the request action visible on a compact senior screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await signup(page, 'senior', '작은화면 어르신');
  await page.getByLabel('도움 요청 입력').fill('내일 병원에 같이 가 주세요.');
  await page.getByRole('button', { name: '보내기' }).click();
  const sendButton = page.getByRole('button', { name: '보내주세요' });
  await expect(sendButton).toBeVisible({ timeout: 20_000 });
  await sendButton.scrollIntoViewIfNeeded();
  const actionBox = await sendButton.boundingBox();
  const footerBox = await page.locator('.senior-footer').boundingBox();
  expect(actionBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(footerBox!.y);
});

test('linked family and worker receive one senior card and worker deletion removes it everywhere', async ({ browser }) => {
  const seniorContext = await browser.newContext(); const familyContext = await browser.newContext(); const workerContext = await browser.newContext();
  const senior = await seniorContext.newPage(); const family = await familyContext.newPage(); const worker = await workerContext.newPage();
  const seniorLoginId = await signup(senior, 'senior', '연결 어르신');
  const familyLoginId = await signup(family, 'family', '연결 가족');
  await signup(worker, 'worker', '연결 복지사');
  await connectCareChain(worker, seniorLoginId, familyLoginId);
  await Promise.all([family.reload(), worker.reload()]);
  await worker.getByRole('button', { name: /요청 업무함/ }).click();
  await senior.getByLabel('도움 요청 입력').fill('내일 충남대학교병원에 같이 가 주세요.');
  await senior.getByRole('button', { name: '보내기' }).click();
  await expect(senior.getByText('병원 동행 요청이에요')).toBeVisible({ timeout: 20_000 });
  await senior.getByRole('button', { name: '보내주세요' }).click();
  const summary = '충남대학교병원 병원 동행 도움이 필요해요.';
  await expect(worker.getByText(summary)).toBeVisible({ timeout: 10_000 });
  await expect(family.getByText(summary).first()).toBeVisible({ timeout: 10_000 });
  const workerCard = worker.locator('.care-request-card').filter({ hasText: summary });
  await workerCard.getByRole('button', { name: '상세 보기' }).click();
  await worker.getByRole('button', { name: '담당 맡기' }).click();
  await worker.getByRole('button', { name: '요청 삭제' }).click();
  await worker.getByRole('dialog', { name: '이 요청을 삭제할까요?' }).getByRole('button', { name: '삭제' }).click();
  await expect(worker.locator('.care-request-card').filter({ hasText: summary })).toHaveCount(0);
  await expect(family.locator('.care-request-card').filter({ hasText: summary })).toHaveCount(0, { timeout: 10_000 });
  await Promise.all([seniorContext.close(), familyContext.close(), workerContext.close()]);
});

test('assigned worker can hard-delete a linked senior emergency while family remains read-only', async ({ browser }) => {
  const seniorContext = await browser.newContext(); const familyContext = await browser.newContext(); const workerContext = await browser.newContext();
  const senior = await seniorContext.newPage(); const family = await familyContext.newPage(); const worker = await workerContext.newPage();
  const seniorLoginId = await signup(senior, 'senior', '긴급 어르신');
  const familyLoginId = await signup(family, 'family', '긴급 가족');
  await signup(worker, 'worker', '긴급 복지사');
  await connectCareChain(worker, seniorLoginId, familyLoginId);
  const created = await senior.request.post('/api/emergencies', { data: { utterance: '지금 숨쉬기가 힘들어요.', location: '대전', confirmed: true } });
  expect(created.status(), await created.text()).toBe(201);
  await Promise.all([family.reload(), worker.reload()]);
  await expect(family.getByText('지금 숨쉬기가 힘들어요.')).toBeVisible({ timeout: 10_000 });
  await expect(family.getByRole('button', { name: /긴급 알림 삭제/ })).toHaveCount(0);
  const alert = worker.getByRole('button', { name: /지금 숨쉬기가 힘들어요/ });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await alert.click();
  await worker.getByRole('button', { name: '긴급 알림 해제 및 삭제' }).click();
  await worker.getByRole('dialog', { name: '긴급 알림을 해제하고 삭제할까요?' }).getByRole('button', { name: '해제 및 삭제' }).click();
  await expect(worker.getByText('지금 숨쉬기가 힘들어요.')).toHaveCount(0);
  await expect(family.getByText('지금 숨쉬기가 힘들어요.')).toHaveCount(0, { timeout: 10_000 });
  await Promise.all([seniorContext.close(), familyContext.close(), workerContext.close()]);
});
