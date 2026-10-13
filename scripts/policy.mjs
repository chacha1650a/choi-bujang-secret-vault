import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { currentPolicy, diffPolicy, policyHash, restoreRoutes, verifySnapshot } from '../src/policy-snapshot.mjs';

export { currentPolicy, diffPolicy, policyHash, restoreRoutes, verifySnapshot };

// 10단계: 침해 전에 검증한 안전 정책 사본(policy/verified-policy.json)과 지금 시험 정책을 비교하고 되돌립니다.
// 시험 정책 = aleph.config.json의 allowedRoutes(경로·구역 표) + src/decider.mjs의 RULE_IDS(규칙 이름).
// 실제 운영 정책(ALEPH SDP 엔진·Supabase)은 건드리지 않습니다. 비밀값은 읽지도 쓰지도 않습니다.

const root = resolve(import.meta.dirname, '..');
const SNAPSHOT = join(root, 'policy', 'verified-policy.json');
const AUDIT = join(root, 'policy', 'audit.jsonl');
const CONFIG = join(root, 'aleph.config.json');

async function loadCurrent() {
  const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
  const { RULE_IDS } = await import(pathToFileURL(join(root, 'src', 'decider.mjs')).href);
  return { config, ruleIds: RULE_IDS };
}

function printDiff(diff) {
  process.stdout.write(`복원할 정책 버전: ${diff.policyRevision}\n`);
  if (diff.clean) { process.stdout.write('차이 없음: 지금 시험 정책이 검증한 사본과 같습니다.\n'); return; }
  for (const r of diff.routes) {
    const label = { add: '되살릴 경로', remove: '지울 경로', zone: '구역 바꿀 경로' }[r.change];
    process.stdout.write(`- ${label}: ${r.service} ${r.method} ${r.pathPattern} (구역 ${r.zone}${r.from ? `, 지금 ${r.from}` : ''})\n`);
  }
  if (diff.rules.missing.length) process.stdout.write(`- 빠진 규칙: ${diff.rules.missing.join(', ')}\n`);
  if (diff.rules.extra.length) process.stdout.write(`- 사본에 없는 규칙: ${diff.rules.extra.join(', ')}\n`);
}

async function main(command, args) {
  const { config, ruleIds } = await loadCurrent();
  if (command === 'snapshot') {
    const revision = Number(args[0] ?? 1);
    // 검토를 마친 정책 변경만 새 버전으로 남깁니다. 같거나 낮은 버전으로는 덮어쓰지 않습니다.
    if (existsSync(SNAPSHOT)) {
      const old = verifySnapshot(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
      if (!Number.isInteger(revision) || revision <= old.policyRevision) {
        throw new Error(`검증한 정책 사본(버전 ${old.policyRevision})이 이미 있습니다. 더 높은 버전으로만 새로 남깁니다.`);
      }
      appendFileSync(AUDIT, `${JSON.stringify({ at: new Date().toISOString(), action: 'policy_snapshot',
        from: old.policyRevision, to: revision })}
`);
    }
    const policy = currentPolicy(config, ruleIds, revision);
    writeFileSync(SNAPSHOT, `${JSON.stringify({ ...policy, sha256: policyHash(policy) }, null, 2)}\n`);
    process.stdout.write(`정책 사본을 만들었습니다: 버전 ${policy.policyRevision}\n`);
    return;
  }
  if (!existsSync(SNAPSHOT)) throw new Error('검증한 정책 사본이 없어 중단합니다.');
  const snapshot = verifySnapshot(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
  const diff = diffPolicy(snapshot, currentPolicy(config, ruleIds, snapshot.policyRevision));
  printDiff(diff);
  if (command === 'diff') return;
  if (command !== 'restore') throw new Error('명령은 snapshot, diff, restore 중 하나입니다.');
  if (diff.clean) return;
  if (diff.rules.missing.length || diff.rules.extra.length) {
    throw new Error('판정기 규칙 이름이 사본과 달라 자동 복원을 멈춥니다. git으로 src/decider.mjs를 되돌린 뒤 다시 실행하세요.');
  }
  if (!args.includes('--apply')) {
    process.stdout.write('위 항목만 바뀝니다. 적용하려면 npm run policy:restore -- --apply 를 실행하세요.\n');
    return;
  }
  writeFileSync(CONFIG, `${JSON.stringify(restoreRoutes(config, snapshot), null, 2)}\n`);
  // 감사 기록은 덧붙이기만 합니다.
  appendFileSync(AUDIT, `${JSON.stringify({ at: new Date().toISOString(), action: 'policy_restore',
    policyRevision: snapshot.policyRevision, sha256: snapshot.sha256, changes: diff.routes.length })}\n`);
  process.stdout.write(`시험 정책 경로 표를 버전 ${snapshot.policyRevision}로 되돌렸습니다. 감사 기록에 한 줄 더했습니다.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv[2], process.argv.slice(3));
  } catch (error) {
    process.stderr.write(`정책 도구 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
