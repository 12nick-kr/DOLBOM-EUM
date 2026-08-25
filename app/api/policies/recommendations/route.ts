import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ data: [{ title: '노인맞춤돌봄서비스', eligibility: '65세 이상 등 대상 조건은 담당자 확인 필요', region: '충남', application_method: '읍면동 주민센터 또는 수행기관 문의', source_url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13520000045', verified_at: '2026-08-25', is_demo: true }], is_demo: true }); }
