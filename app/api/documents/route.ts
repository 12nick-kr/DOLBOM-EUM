import { NextRequest, NextResponse } from 'next/server';
import { validateDocument, secureObjectPath } from '@/lib/domain/documents';
import { id } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 본인만 문서를 올릴 수 있어요.' }, { status: 403 });
  const data = await request.formData(); const file = data.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 필요해요.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer()); const validated = validateDocument({ type: file.type, size: file.size, bytes });
  if (!validated.valid) return NextResponse.json({ error: validated.error }, { status: 400 });
  const documentId = id('doc'); const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png';
  return NextResponse.json({ id: documentId, object_path: secureObjectPath(actor.id, documentId, ext), review_status: 'uploaded', is_demo: true, notice: '합성 데모 문서만 허용되며 원본은 외부 AI로 전송하지 않아요.' }, { status: 201 });
}
