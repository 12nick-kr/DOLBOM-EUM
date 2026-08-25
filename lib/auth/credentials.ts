import { z } from 'zod';
import { roleSchema } from '@/lib/domain/types';

const loginIdDigits = /^0100000\d{4}$/;
export const internalAuthDomain = 'id.dolbomeum.invalid';

/** 전화번호처럼 보이지만 연락처가 아닌 데모 로그인 아이디를 숫자 문자열로 정규화한다. */
export function normalizeLoginId(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatLoginId(value: string): string {
  const digits = normalizeLoginId(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** Supabase Email/Password 인증에만 쓰는 비공개 식별자다. 실제 이메일로 발송하지 않는다. */
export function loginIdToInternalEmail(value: string): string {
  return `${normalizeLoginId(value)}@${internalAuthDomain}`;
}

export const loginIdSchema = z.string().transform(normalizeLoginId).pipe(
  z.string().regex(loginIdDigits, '아이디는 010-0000-0001 형식으로 입력해 주세요.'),
);

/** @deprecated Phone 인증 제거 전 호환용. 새 코드는 loginId API를 사용한다. */
export function normalizeVirtualPhone(value: string): string {
  return normalizeLoginId(value);
}

/** @deprecated Phone 인증 제거 전 호환용. 새 코드는 formatLoginId를 사용한다. */
export function formatVirtualPhone(value: string): string {
  return formatLoginId(value);
}

export function virtualPhoneToE164(value: string): string {
  const digits = normalizeVirtualPhone(value);
  return `+82${digits.slice(1)}`;
}

export const virtualPhoneSchema = z.string().transform(normalizeVirtualPhone).pipe(
  z.string().regex(loginIdDigits, '가상 전화번호는 010-0000-0001 형식으로 입력해 주세요.'),
);

export const demoPinSchema = z.string().regex(/^\d{6}$/, '비밀번호는 숫자 6자리여야 해요.');

export const signupSchema = z.object({
  displayName: z.string().trim().min(2, '이름을 2자 이상 입력해 주세요.').max(30),
  phone: virtualPhoneSchema,
  pin: demoPinSchema,
  pinConfirm: demoPinSchema,
  role: roleSchema,
}).refine((value) => value.pin === value.pinConfirm, { path: ['pinConfirm'], message: '비밀번호가 서로 달라요.' });

export const loginSchema = z.object({
  phone: virtualPhoneSchema,
  pin: demoPinSchema,
});

export type DemoSignupInput = z.infer<typeof signupSchema>;
