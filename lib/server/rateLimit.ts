/**
 * 서버리스 인스턴스 메모리 기반 최소 남용 방지 장치. 인스턴스 간 카운터가 공유되지 않아
 * 완전한 방어는 아니지만, 외부 rate-limit 서비스 없이도 동일 인스턴스에서의 무차별 대입·
 * 반복 남용을 즉시 완화한다.
 */
type RuntimeWithBuckets = typeof globalThis & { __dolbomRateBuckets?: Map<string, number[]> };
const runtime = globalThis as RuntimeWithBuckets;
const buckets = runtime.__dolbomRateBuckets ?? new Map<string, number[]>();
runtime.__dolbomRateBuckets = buckets;

/** `key`에 대해 최근 `windowMs` 안에 `limit`회 이상 호출됐으면 true. 호출될 때마다 시도 1회로 기록한다. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const attempts = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  attempts.push(now);
  buckets.set(key, attempts);
  return attempts.length > limit;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
