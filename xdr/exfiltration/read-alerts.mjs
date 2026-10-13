// XDR 보너스 xdr-06 「자료 빼돌리기」 제작 1: 경보 읽기 모듈(확인용, 학생 작성). decide.mjs 는 이 파일을 불러오지 않습니다.
// xdr/fixtures/exfiltration.json 의 Wazuh 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑습니다. 원본 경보는 고치지 않습니다.
// 비밀값처럼 보이는 값(토큰·키·개인키·메일 주소·비밀번호=값)은 [가림] 으로 바꿔 출력합니다.
// 사용법: node xdr/exfiltration/read-alerts.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODULE_KEY = 'exfiltration';
const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE = join(here, '..', 'fixtures', `${MODULE_KEY}.json`);

const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)|\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\b(sb_secret|sb_publishable|sk|ghp|github_pat|xox[abp])[-_][A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/giu;
export const maskSecrets = (text) => String(text ?? '').replace(SECRET, '[가림]');

// 경보 하나에서 다섯 값만 뽑습니다.
export function pickAlert(alert) {
  const level = Number(alert?.rule?.level);
  return {
    time: maskSecrets(alert?.timestamp ?? '-'),
    srcip: maskSecrets(alert?.data?.srcip ?? '-'),
    user: maskSecrets(alert?.data?.srcuser ?? '-'),
    level: Number.isFinite(level) ? level : null,
    description: maskSecrets(alert?.rule?.description ?? '-'),
  };
}

export async function readAlerts(file = FIXTURE) {
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== MODULE_KEY || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 아닙니다.');
  }
  return { total: fixture.alerts.length, rows: fixture.alerts.map(pickAlert) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const { total, rows } = await readAlerts();
  for (const row of rows) console.log([row.time, row.srcip, row.user, `수준 ${row.level ?? '-'}`, row.description].join(' | '));
  console.log(`경보 ${total}건 · 뽑은 줄 ${rows.length}줄${total === rows.length ? '' : ' (건수가 다릅니다)'}`);
}
