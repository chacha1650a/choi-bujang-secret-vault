# XDR 보너스 경보

이 폴더는 보너스 여섯 개의 연습 경보입니다. 경보는 수업용으로 만든 Wazuh 모양이며, 실제 로그가 아닙니다. 정답은 이 저장소에 없습니다.

## 경보 묶음

`xdr/fixtures/<moduleKey>.json` 을 읽습니다. `moduleKey` 는 아래 여섯 개입니다.

| moduleKey | 보는 것 |
|---|---|
| `brute-force` | 짧은 시간에 몰린 로그인 실패 |
| `web-injection` | 웹 요청에 섞인 주입 형태 |
| `known-cve` | 이미 공개된 취약점을 노린 요청 형태 |
| `persistence` | 다시 켜도 남도록 심긴 서비스·예약 작업 |
| `privilege` | 평범한 계정의 갑작스러운 권한 상승 |
| `exfiltration` | 처음 보는 곳으로 빠지는 큰 전송 |

한 파일에는 명확한 공격, 애매한 시도, 정상 이벤트가 함께 들어 있습니다. 주소는 문서용 대역만 쓰고, 계정은 `user01` 같은 가상 이름입니다. `known-cve` 의 원격 조회 구문은 문서용 표기입니다. 그 문자열을 다른 시스템에 넣거나 변형하지 않습니다.

## 학생이 만드는 파일

항목마다 `xdr/<moduleKey>/decide.mjs` 를 만듭니다. `decide(alert)` 를 내보냅니다. 비동기 함수여도 됩니다. 반환은 아래 세 값입니다.

- `action`: `block`, `alert`, `record` 중 하나
- `confidence`: 0 이상 1 이하 숫자
- `reason`: 짧은 이유

명확한 공격은 `block`, 애매한 시도는 `alert`, 정상 이벤트는 `record` 입니다. 경보 원본은 고치지 않습니다.

## 실행

저장소 루트에서 항목 키 하나를 넣습니다.

```
node scripts/xdr-run.mjs brute-force
```

`npm run xdr:run -- brute-force` 도 같은 명령입니다. 실행기는 해당 경보마다 `decide` 를 부르고, 결과를 `xdr/<moduleKey>/result.json` 에 씁니다. 형식은 `aleph.xdr.result.v1` 이고, `decisions` 에는 경보 id·행동·확신도·이유가, `counts` 에는 `block`·`alert`·`record` 건수가 있습니다.

반환 형식이 틀린 경보는 `record` 로 남고, 오류 한 줄이 출력됩니다. 실행기 자체는 네트워크를 쓰지 않습니다. 판정자는 격리된 환경에서 같은 명령을 다시 실행해 결과를 봅니다. 이미 커밋된 `result.json` 만으로 판정이 끝나지 않습니다.

## 심판 격리 환경에서 지킬 것

심판은 인터넷 없이 `decide.mjs` 한 파일을 불러와 경보마다 바로 답을 받습니다. 이 파일이 돌지 못하면 건수를 셀 수 없어 `XDR_DECIDE_NOT_RUNNING` 으로 끝납니다.

- `decide.mjs` 에는 `import` 문을 두지 않습니다. 필요한 패턴은 `patterns.json` 에서 파일 맨 위 상수로 옮겨 적습니다.
- 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고, 그 파일 안에서 혼자 계산해 답합니다. 경보 하나에 2초 안에 답합니다.
- `confidence`(확신도)는 경보가 패턴과 얼마나 뚜렷하게 맞는지를 `decide` 가 스스로 0~1 로 매긴 값입니다.
- `xdr/alerts.log` 기록과 판정기 연결은 `respond.mjs` 같은 다른 파일에서 합니다. `decide.mjs` 는 판단 결과만 돌려줍니다.

인터넷을 끈 상태에서 `npm run xdr:run -- <moduleKey>` 를 돌려도 같은 결과가 나오면 심판에서도 같은 결과가 나옵니다.

## 학생이 만든 여섯 모듈 (xdr-01~06)

모듈마다 같은 다섯 파일을 둡니다. 판정기(src/decider.mjs)의 기존 규칙은 고치지 않고, XDR 은 판정기 앞에 확인 단계 하나를 더하는 부품입니다.

| 파일 | 하는 일 |
|---|---|
| `read-alerts.mjs` | 제작 1. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑아 출력(비밀값처럼 보이는 값은 가림). 건수와 줄 수를 함께 보여 줌 |
| `patterns.json` | 제작 2. 공격의 알려진 형태. 패턴마다 이름·찾는 조건·근거(MITRE ATT&CK·CVE·Wazuh) 한 줄과 조건식 |
| `decide.mjs` | 제작 3. `npm run xdr:sync` 로 patterns.json 을 맨 위 상수로 옮겨 적은 판단 모듈. import 없음 |
| `respond.mjs` | 제작 4. block 만 출발 주소 거부 규칙(`xdr/deny-rules.json`, 만료 시각·근거 경보 번호)으로 넣고, block·alert 를 `xdr/alerts.log` 에 한 줄씩 쌓음 |
| `result.json` | 제작 5. `npm run xdr:run -- <moduleKey>` 결과 |

확신도: 뚜렷한 공격 형태(strong)와 맞고 Wazuh 수준이 10 이상이면 0.88~0.98(block), 공격 조각·한 번뿐인 시도(medium)나 Wazuh 가 그 기법으로 분류한 사건(weak)은 0.5~0.8(alert), 맞는 패턴이 없거나 수준이 낮으면 0.3 이하(record)입니다. 뚜렷한 형태라도 수준이 낮으면 막지 않고 알림으로 둡니다.

거부 규칙은 바깥 출발 주소 하나만 막고, 같은 묶음에서 정상으로 판단된 주소와 계정은 막지 않습니다. 판정기 쪽에서는 `src/xdr-gate.mjs` 의 `withXdrGate(decide, rules)` 가 출발 주소를 아는 쪽(ALEPH SDP 엔진·자료실 서버)이 넘긴 `sourceIp` 로 만료되지 않은 규칙만 확인하고, 아니면 원래 판정기의 답을 그대로 돌려줍니다.

다시 돌리는 순서: `npm run xdr:sync` → `npm run xdr:run -- <moduleKey>` → `node xdr/<moduleKey>/respond.mjs` → `npm run test:xdr`.
