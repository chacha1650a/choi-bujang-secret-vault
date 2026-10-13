import { createHash } from 'node:crypto';
import { UUID, createGuard, forbid, resourceId, send } from './notes-api.mjs';

// 10단계: 침해 전에 검증한 메모 사본에서 지정한 한 건만 되살립니다.
// 사본(note_snapshots)은 메모가 처음 만들어질 때 DB 트리거가 남기고, 서버도 고치지 않습니다.
// 내용 해시는 DB와 같은 규칙(제목, 구분 문자 U+001F, 본문을 UTF-8로 이어 붙인 SHA-256)으로 계산합니다.
export const contentHash = (title, body) => createHash('sha256').update(`${title}\u001f${body}`, 'utf8').digest('hex');

export function createRestoreApi({ verifyLogin, supabase }) {
  const guarded = createGuard(verifyLogin);

  async function audit(who, action, id, detail) {
    // 감사 기록은 덧붙이기만 합니다. 토큰·본문은 넣지 않고 가명 사용자 ID와 해시만 남깁니다.
    const { error } = await supabase.from('audit_log').insert({
      actor: who.userId, action, resource: resourceId('note', id), detail,
    });
    if (error) throw error;
  }

  async function restore(request, response) {
    await guarded(request, response, ['POST'], async (who) => {
      const id = String(request.query?.noteId ?? '').toLowerCase();
      if (!UUID.test(id)) {
        send(response, 404, { error: 'NOT_FOUND' });
        return;
      }
      response.setHeader('X-Resource-Id', resourceId('note', id));

      // 1) 사본을 다시 읽어 검증합니다. 사본이 없거나 해시가 맞지 않으면 복원하지 않고 멈춥니다.
      const snap = await supabase.from('note_snapshots')
        .select('note_id, owner_id, title, body, content_sha256').eq('note_id', id).maybeSingle();
      if (snap.error) throw snap.error;
      if (!snap.data) {
        send(response, 404, { error: 'NO_SNAPSHOT', message: '검증한 사본이 없어 복원하지 않았습니다.' });
        return;
      }
      if (snap.data.owner_id !== who.userId) {
        forbid(response, 'not_owner', '내 메모만 복원할 수 있습니다.');
        return;
      }
      if (contentHash(snap.data.title, snap.data.body) !== snap.data.content_sha256) {
        await audit(who, 'restore_failed', id, { reason: 'snapshot_hash_mismatch' });
        send(response, 409, { error: 'SNAPSHOT_INVALID', message: '사본 검증에 실패해 복원하지 않았습니다.' });
        return;
      }

      // 2) 지금 메모를 확인합니다. 다른 사람 소유로 바뀌어 있으면 덮어쓰지 않습니다.
      const current = await supabase.from('notes').select('id, owner_id, title, body')
        .eq('id', id).maybeSingle();
      if (current.error) throw current.error;
      if (current.data && current.data.owner_id !== who.userId) {
        forbid(response, 'not_owner', '내 메모만 복원할 수 있습니다.');
        return;
      }
      const before = !current.data ? 'deleted'
        : contentHash(current.data.title, current.data.body) === snap.data.content_sha256 ? 'unchanged' : 'modified';

      // 3) 이 한 건만 사본 내용으로 되돌립니다. 다른 메모는 건드리지 않습니다.
      const values = { title: snap.data.title, body: snap.data.body };
      const written = current.data
        ? await supabase.from('notes').update(values).eq('id', id).eq('owner_id', who.userId)
          .select('id, owner_id, title, body').maybeSingle()
        : await supabase.from('notes').insert({ id, owner_id: who.userId, ...values })
          .select('id, owner_id, title, body').maybeSingle();
      if (written.error) throw written.error;

      // 4) 복원한 한 건의 ID·소유자·내용 해시를 사본과 대조합니다.
      const after = written.data;
      const matches = {
        id: after?.id === snap.data.note_id,
        owner: after?.owner_id === snap.data.owner_id,
        contentSha256: Boolean(after) && contentHash(after.title, after.body) === snap.data.content_sha256,
      };
      const ok = matches.id && matches.owner && matches.contentSha256;
      await audit(who, ok ? 'restore_note' : 'restore_failed', id,
        { before, contentSha256: snap.data.content_sha256, matches });
      if (!ok) {
        send(response, 500, { error: 'RESTORE_MISMATCH', matches });
        return;
      }
      send(response, 200, { id, restored: true, before, contentSha256: snap.data.content_sha256, matches });
    });
  }

  return { restore };
}
