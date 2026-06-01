# nikke-raid-autosync-userscript

NIKKE 유니온 레이드 결산 시트의 신규 회차 추가를 자동화하는 Tampermonkey 유저스크립트입니다. (P-NRA-001 / E-NRA-001)

mango.hke 님의 [30초 입력법 v1.12](https://greasyfork.org/en/scripts/565386) 를 fork하여, `blablalink.com` ShiftyPad에서 **레이드 결과 + 유니온 멤버 싱크로 레벨**을 동시에 추출하고 동반 도구(SPA)로 전송합니다. oddoido 님의 NIKKE 유레 결산 시트 템플릿에 대한 third-party 보조 도구이며, 시트 템플릿 자체는 변경하지 않습니다.

---

## 1. 무엇을 하나요

- `blablalink.com`의 4개 API 응답을 인터셉트합니다: `GetUnionRaidData`(레이드 결과), `GetGuildMembers`(멤버 싱크로), `GetMyGuildInfo`, `GetSavedRoleInfo`.
- 두 핵심 데이터가 모두 캡처되면 `window.opener.postMessage`로 동반 도구(`https://ssissun.github.io`)에 전송합니다.
- 도구가 연결되지 않은 경우 v1.12 호환 CSV 다운로드로 fallback합니다.
- 시트에 빠진 과거 회차는 `season_id`를 바꿔 직접 fetch하여 한 번에 백필합니다. 각 회차의 출전 니케 최고 레벨(회차 당시 싱크로)과 전체 참가자 레벨(탈퇴자 기록용)을 함께 추출합니다.
- 우상단 floating panel에 캡처 진행 상황(0/4 ~ 4/4)과 진단 메시지(로그인 필요 / 데이터 없음 / 오류)를 표시합니다.

> 본인 NIKKE 계정으로 본인이 볼 수 있는 데이터만 추출합니다. 타 유니온·타 사용자 데이터에 접근하지 않습니다.

## 2. Tampermonkey 설치

1. 브라우저(Chrome / Edge / Firefox)에 [Tampermonkey](https://www.tampermonkey.net/) 확장을 설치합니다.
2. Chrome/Edge는 확장 관리에서 **개발자 모드**를 켜야 유저스크립트가 정상 동작합니다.

## 3. 스크립트 설치

### 방법 A — Greasyfork 1-click (권장)

[Greasyfork 스크립트 페이지](https://greasyfork.org/scripts/579278)의 **Install this script** 버튼을 누르면 Tampermonkey 설치 다이얼로그가 표시됩니다.

> Greasyfork URL: <https://greasyfork.org/scripts/579278>

### 방법 B — raw URL 수동 설치

Tampermonkey 대시보드 → **Utilities** → **Import from URL** 에 아래 raw 파일 URL을 입력합니다:

```
https://raw.githubusercontent.com/ssissun/nikke-raid-autosync-userscript/main/nikke-raid-autosync.user.js
```

## 4. 변경 사항 (v1.12 → v2.x)

| 영역 | v1.12 (mango.hke) | v2.0.0 (본 도구) |
|------|-------------------|------------------|
| 인터셉트 대상 | `GetUnionRaidData` 1개 | 4개 (+ `GetGuildMembers` / `GetMyGuildInfo` / `GetSavedRoleInfo`) |
| 멤버 싱크로 | 미지원 | `GetGuildMembers` → 멤버별 싱크로 레벨 추출 |
| 데이터 전달 | CSV 다운로드 | `postMessage` 도구 전송 + CSV fallback |
| UI | 단일 추출 버튼 | floating panel (진행 표시 + 진단 메시지) |
| 진단 | 없음 | need-login / no-data / error 도구 통보 |

v1.12의 핵심 모듈(`NIKKE_DATA_LIST` 159 캐릭터 매핑, `processRaidData`, CSV 직렬화)은 회귀 위험 0을 위해 그대로 보존했습니다.

### v2.1 ~ v2.4 추가

- **다회차 백필** — `season_id`를 직접 바꿔 과거 회차를 fetch. SPA의 `?from`/`?need` 핸드셰이크로 시트에 빠진 회차만 선별 수집하며, 빈 시트는 가용 회차 전체를 백필합니다.
- **회차 당시 싱크로 레벨** — 각 회차 `participate_data`의 squad 최고 니케 레벨을 회차별로 산출합니다.
- **탈퇴자 레벨 기록 지원** (v2.4.3) — 전체 참가자의 회차별 레벨(`levelsByNickname`)을 함께 전송하여, SPA가 `탈퇴자 레벨 기록` 탭에 떠난 멤버의 레벨을 보존할 수 있게 합니다.

---

`@updateURL` / `@downloadURL`은 Greasyfork([579278](https://greasyfork.org/scripts/579278)) 발급 URL을 사용합니다.

## 라이선스 / 출처

[MIT](./LICENSE). 이 프로젝트는 mango.hke 님의 [30초 입력법 v1.12](https://greasyfork.org/scripts/565386)를 **원저자 허락 하에** fork한 derivative입니다. v1.12 기반 모듈(`NIKKE_DATA_LIST`, `processRaidData`, CSV 직렬화)의 저작권은 원저자(mango.hke)에게 있으며, 그 외 부분은 ssissun 저작입니다. 전체는 MIT로 배포됩니다.
