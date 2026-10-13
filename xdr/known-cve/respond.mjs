// XDR 보너스 xdr-03 「알려진 취약점」 제작 4: 알림과 차단 연결(학생 작성).
// - 경보마다 decide.mjs 의 판단을 받고, block(차단 후보)만 내 ZTNA 판정기의 거부 규칙(xdr/deny-rules.json)으로 넣습니다.
//   규칙은 바깥 출발 주소 하나만 막고 만료 시각·근거 경보 번호를 붙입니다. 정상(record)으로 나온 주소와 계정은 막지 않습니다.
//   판정기는 src/xdr-gate.mjs 의 withXdrGate(decide) 로 이 규칙을 확인 단계 하나로 더 봅니다. 판정기의 기존 규칙은 고치지 않습니다.
// - block·alert 알림은 이 파일에서 xdr/alerts.log 에 한 줄씩 쌓습니다. decide.mjs 는 판단 결과만 돌려주고 파일을 쓰지 않습니다.
// 사용법: node xdr/known-cve/respond.mjs [--ttl=60] [--now=2026-10-13T00:00:00Z]
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDenyRules, mergeDenyRules } from '../../src/xdr-gate.mjs';
import { decide } from './decide.mjs';
import { maskSecrets } from './read-alerts.mjs';

export const MODULE_KEY = 'known-cve';
const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, '..', '..');

// 로그 한 줄에는 줄바꿈과 구분자(|)를 넣지 않습니다.
const field = (value) => maskSecrets(value ?? '-').replace(/[\r\n|]+/gu, ' ').replace(/\s+/gu, ' ').trim() || '-';
export function logLine(item, now) {
  return [now.toISOString(), MODULE_KEY, item.decision.action, field(item.alertId), field(item.srcip), field(item.user),
    `확신도 ${item.decision.confidence}`, field(item.decision.reason)].join(' | ');
}

export async function respond({ root = defaultRoot, now = new Date(), ttlMinutes, write = true } = {}) {
  const fixture = JSON.parse(await readFile(join(root, 'xdr', 'fixtures', `${MODULE_KEY}.json`), 'utf8'));
  const items = [];
  for (const alert of fixture.alerts) {
    const decision = await decide(alert);
    items.push({ alertId: alert?.id, srcip: alert?.data?.srcip, user: alert?.data?.srcuser, decision });
  }
  const rules = buildDenyRules(MODULE_KEY, items, { now, ttlMinutes });
  const lines = items.filter((item) => item.decision.action !== 'record').map((item) => logLine(item, now));
  if (write) {
    const rulesPath = join(root, 'xdr', 'deny-rules.json');
    const existing = await readFile(rulesPath, 'utf8').then(JSON.parse).catch(() => null);
    await writeFile(rulesPath, JSON.stringify(mergeDenyRules(existing, MODULE_KEY, rules), null, 2) + '\n', 'utf8');
    if (lines.length) await appendFile(join(root, 'xdr', 'alerts.log'), lines.join('\n') + '\n', 'utf8');
  }
  return { items, rules, lines };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const now = arg('now') ? new Date(arg('now')) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('--now 는 ISO 시각이어야 합니다.');
  const { items, rules, lines } = await respond({ now, ttlMinutes: arg('ttl') });
  const count = (action) => items.filter((item) => item.decision.action === action).length;
  console.log(`${MODULE_KEY}: block ${count('block')} · alert ${count('alert')} · record ${count('record')} · 거부 규칙 ${rules.length}개(만료 ${rules[0]?.expiresAt ?? '-'}) · alerts.log ${lines.length}줄 추가`);
}
