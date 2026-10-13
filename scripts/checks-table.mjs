import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 12단계: npm run bundle이 실제 배포에 보낸 요청의 결과(artifacts/submission.json)를 한 표로 출력합니다.
// 결과를 고치거나 채우지 않고 그대로 옮기며, 보내지 못한 점검은 미실행으로 남습니다.
const root = resolve(import.meta.dirname, '..');
const bundle = JSON.parse(readFileSync(join(root, 'artifacts', 'submission.json'), 'utf8'));
const label = { blocked: '막음(기대대로)', breached: '뚫림', not_run: '미실행' };
const cell = (value) => String(value).replaceAll('|', '\\|');

const lines = [
  `점검 시각 ${bundle.checkedAt ?? '-'} · 커밋 ${String(bundle.commit).slice(0, 12)} · 단계 ${bundle.step}`,
  '',
  '| 단계 | 점검 | 기대 | 실제 응답 · 요청 ID | 결과 |',
  '|---|---|---|---|---|',
  ...bundle.attackAttempts.map((a) => `| ${a.stage} | ${cell(a.attackId)} | ${cell(a.expected)} | ${cell(a.observed)} | ${label[a.result] ?? a.result} |`),
  '',
  `막음 ${bundle.attackAttempts.filter((a) => a.result === 'blocked').length} · 뚫림 ${bundle.attackAttempts.filter((a) => a.result === 'breached').length} · 미실행 ${bundle.attackAttempts.filter((a) => a.result === 'not_run').length}`,
];
process.stdout.write(`${lines.join('\n')}\n`);
