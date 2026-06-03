// ==UserScript==
// @name        니케 유레 자동 동기화 (싱크로 레벨 + 레이드 결과)
// @namespace   nikke-raid-autosync
// @version     2.5.0
// @description Blablalink ShiftyPad에서 유니온 멤버 싱크로 레벨 + 레이드 결과를 추출하여 nikke-raid-autosync 도구(SPA)로 전송. mango.hke 30초 입력법 v1.12 fork.
// @author      ssissun (mango.hke v1.12 fork)
// @match       *://*.blablalink.com/*
// @run-at      document-start
// @grant       unsafeWindow
// @inject-into page
// @license     MIT
// @homepageURL https://github.com/ssissun/nikke-raid-autosync-userscript
// @supportURL  https://arca.live/b/nikketgv/161405505
// @updateURL   https://update.greasyfork.org/scripts/579278/%EB%8B%88%EC%BC%80%20%EC%9C%A0%EB%A0%88%20%EC%9E%90%EB%8F%99%20%EB%8F%99%EA%B8%B0%ED%99%94%20%28%EC%8B%B1%ED%81%AC%EB%A1%9C%20%EB%A0%88%EB%B2%A8%20%2B%20%EB%A0%88%EC%9D%B4%EB%93%9C%20%EA%B2%B0%EA%B3%BC%29.meta.js
// @downloadURL https://update.greasyfork.org/scripts/579278/%EB%8B%88%EC%BC%80%20%EC%9C%A0%EB%A0%88%20%EC%9E%90%EB%8F%99%20%EB%8F%99%EA%B8%B0%ED%99%94%20%28%EC%8B%B1%ED%81%AC%EB%A1%9C%20%EB%A0%88%EB%B2%A8%20%2B%20%EB%A0%88%EC%9D%B4%EB%93%9C%20%EA%B2%B0%EA%B3%BC%29.user.js
// ==/UserScript==

(function () {
  'use strict';

  const NRA_VERSION = "2.5.0"; // 도구(SPA)로 전송하는 payload 에 실어 버전 감지에 사용

  // =========================================================================
  // SPA trigger gate — `?nra=1` query param 없으면 즉시 종료
  // 사용자가 blablalink 직접 접속 시 동작하지 않도록 차단 (의도하지 않은 floater/capture 방지).
  // SPA(https://ssissun.github.io/nikke-raid-autosync-spa/)의 [신규 회차 데이터 가져오기]
  // 버튼이 ?nra=1 을 붙여 새 탭 open 하므로, 그 경로로만 활성화된다.
  // =========================================================================
  let NRA_FROM_ROUND = null; // SPA 가 전달한 tail 백필 시작 회차 (?from=39). 없으면(빈 시트) 가용 회차 전체 백필.
  let NRA_NEED_ROUNDS = []; // SPA 가 전달한 interior gap 회차 (?need=35,37). gap-aware 백필.
  try {
    const sp = new URLSearchParams(location.search);
    if (!sp.has("nra")) {
      return; // 일반 blablalink 사용 시 차단
    }
    const f = parseInt(sp.get("from"), 10);
    if (!Number.isNaN(f) && f > 0) NRA_FROM_ROUND = f;
    const need = sp.get("need");
    if (need) {
      NRA_NEED_ROUNDS = need
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
    }
  } catch (e) {
    return; // location.search 접근 실패 시 안전 차단
  }

  // =========================================================================
  // [v1.12 core] mango.hke Greasyfork 565386 — 회귀 위험 0
  // nikkeDictionary / findNikkeName / findNikkeBreak / processRaidData 는 원본 그대로 보존.
  // NIKKE_DATA_LIST: v1.12 원본 별명 항목은 보존, 신규 SSR 만 CI(.github/workflows/update-nikke-list.yml)가
  // CDN 마스터에서 정식명으로 자동 append 한다 (별명 항목은 수정하지 않음).
  // =========================================================================

  // 데이터 입력
  const NIKKE_DATA_LIST = `[
  {"id":324001,"name_localkey":{"name":"루마니"}},
  {"id":203201,"name_localkey":{"name":"미란다"}},
  {"id":328201,"name_localkey":{"name":"사쿠라"}},
  {"id":331201,"name_localkey":{"name":"소다"}},
  {"id":320101,"name_localkey":{"name":"얀"}},
  {"id":209001,"name_localkey":{"name":"엠마(구)"}},
  {"id":209301,"name_localkey":{"name":"엠마"}},
  {"id":331101,"name_localkey":{"name":"코코아"}},
  {"id":204301,"name_localkey":{"name":"동디"}},
  {"id":451401,"name_localkey":{"name":"그브"}},
  {"id":338001,"name_localkey":{"name":"네로"}},
  {"id":426101,"name_localkey":{"name":"니힐"}},
  {"id":355001,"name_localkey":{"name":"베이"}},
  {"id":207301,"name_localkey":{"name":"브리드"}},
  {"id":202201,"name_localkey":{"name":"시그널"}},
  {"id":258301,"name_localkey":{"name":"교르카나"}},
  {"id":116001,"name_localkey":{"name":"유니"}},
  {"id":209201,"name_localkey":{"name":"은화(구)"}},
  {"id":209501,"name_localkey":{"name":"은화"}},
  {"id":581001,"name_localkey":{"name":"2B"}},
  {"id":110101,"name_localkey":{"name":"드레이크"}},
  {"id":207501,"name_localkey":{"name":"디젤"}},
  {"id":201601,"name_localkey":{"name":"라피"}},
  {"id":426001,"name_localkey":{"name":"모더"}},
  {"id":116201,"name_localkey":{"name":"미하라"}},
  {"id":209401,"name_localkey":{"name":"베스티"}},
  {"id":583001,"name_localkey":{"name":"아스카"}},
  {"id":583101,"name_localkey":{"name":"레이"}},
  {"id":319101,"name_localkey":{"name":"앨"}},
  {"id":317101,"name_localkey":{"name":"율하"}},
  {"id":111001,"name_localkey":{"name":"크로우"}},
  {"id":136101,"name_localkey":{"name":"킬로"}},
  {"id":150101,"name_localkey":{"name":"트로니"}},
  {"id":581101,"name_localkey":{"name":"A2"}},
  {"id":422101,"name_localkey":{"name":"라푼젤"}},
  {"id":422601,"name_localkey":{"name":"푼젤(퓨어)"}},
  {"id":258201,"name_localkey":{"name":"레이블"}},
  {"id":108201,"name_localkey":{"name":"리타"}},
  {"id":306201,"name_localkey":{"name":"클미카"}},
  {"id":111101,"name_localkey":{"name":"자칼"}},
  {"id":145101,"name_localkey":{"name":"티아"}},
  {"id":314201,"name_localkey":{"name":"프림"}},
  {"id":321201,"name_localkey":{"name":"노벨"}},
  {"id":320001,"name_localkey":{"name":"루피"}},
  {"id":232101,"name_localkey":{"name":"말차"}},
  {"id":360001,"name_localkey":{"name":"민트"}},
  {"id":108001,"name_localkey":{"name":"센티"}},
  {"id":586101,"name_localkey":{"name":"타키나"}},
  {"id":433101,"name_localkey":{"name":"차임"}},
  {"id":433001,"name_localkey":{"name":"크라운"}},
  {"id":235301,"name_localkey":{"name":"수헬름"}},
  {"id":586001,"name_localkey":{"name":"치사토"}},
  {"id":110001,"name_localkey":{"name":"라플"}},
  {"id":585101,"name_localkey":{"name":"레이븐"}},
  {"id":110201,"name_localkey":{"name":"맥"}},
  {"id":314301,"name_localkey":{"name":"바밀크"}},
  {"id":331401,"name_localkey":{"name":"바소다"}},
  {"id":207101,"name_localkey":{"name":"솔린(구)"}},
  {"id":314001,"name_localkey":{"name":"슈가"}},
  {"id":422001,"name_localkey":{"name":"스화"}},
  {"id":422401,"name_localkey":{"name":"농스화"}},
  {"id":331501,"name_localkey":{"name":"바이드"}},
  {"id":115001,"name_localkey":{"name":"율리아"}},
  {"id":585001,"name_localkey":{"name":"이브"}},
  {"id":447001,"name_localkey":{"name":"레후"}},
  {"id":451301,"name_localkey":{"name":"세이렌"}},
  {"id":343101,"name_localkey":{"name":"볼륨"}},
  {"id":253201,"name_localkey":{"name":"소라"}},
  {"id":113101,"name_localkey":{"name":"페퍼"}},
  {"id":140001,"name_localkey":{"name":"길티"}},
  {"id":422301,"name_localkey":{"name":"나유타"}},
  {"id":423201,"name_localkey":{"name":"노아"}},
  {"id":320201,"name_localkey":{"name":"도라"}},
  {"id":207201,"name_localkey":{"name":"디젤(구)"}},
  {"id":328301,"name_localkey":{"name":"수산나"}},
  {"id":159001,"name_localkey":{"name":"모리"}},
  {"id":331601,"name_localkey":{"name":"벨벳"}},
  {"id":327001,"name_localkey":{"name":"블랑"}},
  {"id":117201,"name_localkey":{"name":"애드미"}},
  {"id":112101,"name_localkey":{"name":"클앤"}},
  {"id":331001,"name_localkey":{"name":"에이드"}},
  {"id":327101,"name_localkey":{"name":"누아르"}},
  {"id":426201,"name_localkey":{"name":"리버"}},
  {"id":129001,"name_localkey":{"name":"마나"}},
  {"id":328401,"name_localkey":{"name":"수쿠라"}},
  {"id":583501,"name_localkey":{"name":"풍스카"}},
  {"id":583401,"name_localkey":{"name":"풍레이"}},
  {"id":324101,"name_localkey":{"name":"에피넬"}},
  {"id":203301,"name_localkey":{"name":"키리"}},
  {"id":422501,"name_localkey":{"name":"흑련"}},
  {"id":211301,"name_localkey":{"name":"EH"}},
  {"id":204001,"name_localkey":{"name":"D"}},
  {"id":343001,"name_localkey":{"name":"노이즈"}},
  {"id":228001,"name_localkey":{"name":"로산나"}},
  {"id":327201,"name_localkey":{"name":"루주"}},
  {"id":320301,"name_localkey":{"name":"클루피"}},
  {"id":328101,"name_localkey":{"name":"목단"}},
  {"id":301701,"name_localkey":{"name":"아니스"}},
  {"id":321001,"name_localkey":{"name":"엑시아"}},
  {"id":239001,"name_localkey":{"name":"츠바이"}},
  {"id":112001,"name_localkey":{"name":"N102"}},
  {"id":145001,"name_localkey":{"name":"나가"}},
  {"id":235001,"name_localkey":{"name":"마스트(구)"}},
  {"id":583201,"name_localkey":{"name":"마리"}},
  {"id":338101,"name_localkey":{"name":"비스킷"}},
  {"id":140101,"name_localkey":{"name":"신"}},
  {"id":258101,"name_localkey":{"name":"아르카나"}},
  {"id":150001,"name_localkey":{"name":"일레그"}},
  {"id":140201,"name_localkey":{"name":"퀀시(구)"}},
  {"id":355101,"name_localkey":{"name":"클레이"}},
  {"id":141201,"name_localkey":{"name":"트리나"}},
  {"id":141101,"name_localkey":{"name":"플로라"}},
  {"id":218001,"name_localkey":{"name":"길로틴"}},
  {"id":101801,"name_localkey":{"name":"네온"}},
  {"id":218101,"name_localkey":{"name":"메이든"}},
  {"id":218301,"name_localkey":{"name":"클이든"}},
  {"id":451101,"name_localkey":{"name":"신데"}},
  {"id":301501,"name_localkey":{"name":"수니스"}},
  {"id":139101,"name_localkey":{"name":"아인"}},
  {"id":584001,"name_localkey":{"name":"웡"}},
  {"id":423101,"name_localkey":{"name":"이사벨"}},
  {"id":584101,"name_localkey":{"name":"질"}},
  {"id":231301,"name_localkey":{"name":"메프바"}},
  {"id":423001,"name_localkey":{"name":"하란"}},
  {"id":422201,"name_localkey":{"name":"홍련"}},
  {"id":204101,"name_localkey":{"name":"K"}},
  {"id":423301,"name_localkey":{"name":"도로시"}},
  {"id":339201,"name_localkey":{"name":"라이"}},
  {"id":319001,"name_localkey":{"name":"루드밀라"}},
  {"id":313001,"name_localkey":{"name":"메어리"}},
  {"id":313201,"name_localkey":{"name":"수어리"}},
  {"id":314101,"name_localkey":{"name":"밀크"}},
  {"id":207401,"name_localkey":{"name":"솔린"}},
  {"id":319501,"name_localkey":{"name":"바앨"}},
  {"id":119201,"name_localkey":{"name":"토브"}},
  {"id":502301,"name_localkey":{"name":"닌델"}},
  {"id":338201,"name_localkey":{"name":"레오나"}},
  {"id":582001,"name_localkey":{"name":"렘"}},
  {"id":235401,"name_localkey":{"name":"메스트"}},
  {"id":311201,"name_localkey":{"name":"바이퍼"}},
  {"id":162001,"name_localkey":{"name":"백학"}},
  {"id":343201,"name_localkey":{"name":"아리아"}},
  {"id":235501,"name_localkey":{"name":"메앵커"}},
  {"id":352101,"name_localkey":{"name":"바삭이"}},
  {"id":203001,"name_localkey":{"name":"폴리"}},
  {"id":324201,"name_localkey":{"name":"폴크방"}},
  {"id":218201,"name_localkey":{"name":"클로틴"}},
  {"id":201401,"name_localkey":{"name":"수네온"}},
  {"id":423401,"name_localkey":{"name":"수로시"}},
  {"id":319401,"name_localkey":{"name":"클루드"}},
  {"id":209101,"name_localkey":{"name":"베스티(구)"}},
  {"id":352001,"name_localkey":{"name":"브래디"}},
  {"id":207001,"name_localkey":{"name":"브리드(구)"}},
  {"id":447101,"name_localkey":{"name":"수화"}},
  {"id":150201,"name_localkey":{"name":"수레그"}},
  {"id":140301,"name_localkey":{"name":"퀀시"}},
  {"id":258001,"name_localkey":{"name":"팬텀"}},
  {"id":217001,"name_localkey":{"name":"프바"}},
  {"id":235201,"name_localkey":{"name":"헬름"}},
  {"id":244101,"name_localkey":{"name":"아비스타"}},
  {"id":580001,"name_localkey":{"name":"마키마"}},
  {"id":580101,"name_localkey":{"name":"파워"}},
  {"id":582101,"name_localkey":{"name":"에밀리아"}},
  {"id":360101,"name_localkey":{"name":"프리카"}}
]`;

  // JSON 객체 변환
  const nikkeDictionary = (() => {
    const dictionary = {};
    JSON.parse(NIKKE_DATA_LIST || "[]").forEach(item => {
      dictionary[Math.floor(item.id / 100)] = item.name_localkey.name;
    });
    return dictionary;
  })();

  const findNikkeName = (id) => nikkeDictionary[Math.floor(id / 100)] || `Unknown(${id})`;
  const findNikkeBreak = (id) => (id % 100) - 1;

  // csv용 배열로
  function processRaidData(data, raidNum) {
    const hardRecords = data.data.participate_data
      .filter(r => r.difficulty === 2)
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

    const headers = ["회차", "닉네임", "보스명", "단계",
      "1번 자리", "1번 돌파", "2번 자리", "2번 돌파",
      "3번 자리", "3번 돌파", "4번 자리", "4번 돌파",
      "5번 자리", "5번 돌파", "딜량", "막타 여부"];
    const raidLabel = raidNum ? `${raidNum}차` : "";

    const rows = hardRecords.map(record => {
      const { nickname, squad = [], level, total_damage, is_final_hit, name_localvalues } = record;
      const sortedSquad = [...squad].sort((a, b) => a.slot - b.slot);
      const unitCols = Array.from({ length: 5 }, (_, i) => {
        const unit = sortedSquad.find(u => u.slot === i + 1);
        if (!unit) return ["", ""];
        return [findNikkeName(unit.tid), findNikkeBreak(unit.tid)];
      }).flat();

      return [
        raidLabel, nickname,
        (name_localvalues?.ko || "Unknown").replace(/\[.*?\]/g, '').trim(),
        level, ...unitCols,
        total_damage, is_final_hit ? "O" : ""
      ];
    });

    return [headers, ...rows];
  }

  // =========================================================================
  // CDN 마스터 fallback dictionary — sg-tools-cdn 캐릭터 마스터 JSON 자동 학습.
  // 1순위: NIKKE_DATA_LIST (hardcoded, v1.12 byte-identical core).
  // 2순위: cdnFallbackDict (페이지 로드 시 자동 갱신, localStorage 캐싱).
  // 게임 신규 니케 출시 시 NIKKE_DATA_LIST 수동 갱신 없이도 매칭됨.
  // =========================================================================
  // v2: SSR 필터 도입. v1 캐시(R/SR 등 모든 등급 포함)는 마이그레이션 차원에서 무효화.
  const CDN_FALLBACK_STORAGE_KEY = "nra-cdn-fallback-dict-v2";
  try { localStorage.removeItem("nra-cdn-fallback-dict-v1"); } catch (e) { /* ignore */ }

  // { key: name } where key = Math.floor(tid / 100). 형식: nikkeDictionary 와 동일.
  const cdnFallbackDict = (() => {
    try {
      const raw = localStorage.getItem(CDN_FALLBACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignore */ }
    return {};
  })();

  // sg-tools-cdn URL 의 .json 응답인지 판정.
  function matchCdnMasterUrl(url) {
    if (!url) return false;
    const s = url.toString();
    return s.includes("sg-tools-cdn.blablalink.com") && s.endsWith(".json");
  }

  // 응답이 NIKKE 캐릭터 마스터 JSON 인지 판정.
  // 패턴: 배열 + 첫 entry 가 {id: 6자리 number, name_localkey: {name: 한글 string}}.
  function isNikkeMasterJson(json) {
    if (!Array.isArray(json) || json.length === 0) return false;
    const first = json[0];
    if (!first || typeof first.id !== "number") return false;
    if (String(first.id).length !== 6) return false;
    if (!first.name_localkey || typeof first.name_localkey.name !== "string") return false;
    return first.name_localkey.name.length > 0;
  }

  // 마스터 JSON 흡수 → cdnFallbackDict 갱신 + localStorage 저장.
  // 반환: NIKKE_DATA_LIST 에 없는 신규 니케 목록 ({id, key, name}[]).
  // SSR 만 포함 — NIKKE_DATA_LIST 가 수집형 5성(SSR) 전용이므로 R/SR 일반 NPC 제외.
  function ingestNikkeMaster(json) {
    const newNikkes = [];
    let updated = 0;
    for (const item of json) {
      if (!item || typeof item.id !== "number") continue;
      if (!item.name_localkey || typeof item.name_localkey.name !== "string") continue;
      if (item.original_rare !== "SSR") continue; // SSR 필터
      const key = Math.floor(item.id / 100);
      const name = item.name_localkey.name;
      if (cdnFallbackDict[key] !== name) {
        cdnFallbackDict[key] = name;
        updated++;
      }
      if (!nikkeDictionary[key]) {
        newNikkes.push({ id: item.id, key, name });
      }
    }
    if (updated > 0) {
      try { localStorage.setItem(CDN_FALLBACK_STORAGE_KEY, JSON.stringify(cdnFallbackDict)); } catch (e) { /* ignore */ }
    }
    return newNikkes;
  }

  // (신규 니케 사용자 알림 제거 — CI 가 NIKKE_DATA_LIST 를 자동 갱신하므로 런타임 보고 불필요)

  // processRaidData byte-identical core 결과 후처리.
  // unit name 컬럼(4·6·8·10·12)의 `Unknown(XXXXXX)` 패턴을 cdnFallbackDict 로 대체.
  // SOT(API_SPEC) 헤더 순서: "회차, 닉네임, 보스명, 단계, 1번 자리, 1번 돌파, 2번 자리, 2번 돌파, ..."
  function processRaidDataWithFallback(data, raidNum) {
    const result = processRaidData(data, raidNum); // v1.12 byte-identical 호출
    const unitNameColIdxs = [4, 6, 8, 10, 12];
    for (let i = 1; i < result.length; i++) {
      const row = result[i];
      if (!row) continue;
      for (const colIdx of unitNameColIdxs) {
        const cellValue = row[colIdx];
        if (typeof cellValue !== "string") continue;
        const m = cellValue.match(/^Unknown\((\d+)\)$/);
        if (!m) continue;
        const id = parseInt(m[1], 10);
        const key = Math.floor(id / 100);
        if (cdnFallbackDict[key]) {
          row[colIdx] = cdnFallbackDict[key];
        }
      }
    }
    return result;
  }

  // (reportFromCache 제거 — 신규 니케 캐시 보고 알림 폐지로 불필요)

  // =========================================================================
  // [F-NRA-001-03] 상수 + helper
  // =========================================================================

  // 도구 SPA origin (strict, "*" 금지 — PR-04 XSS 통로 차단)
  const TOOL_ORIGIN = "https://ssissun.github.io";

  // Tampermonkey V3 (Manifest V3 + 사용자 스크립트 허용 모드)에서는 `window`가 sandbox일 수 있어
  // window.opener가 main world opener와 분리됨. unsafeWindow는 항상 page main world를 가리킴.
  // `@grant unsafeWindow` + `@inject-into page` 조합으로 명시적으로 main world 접근.
  const PAGE_WINDOW = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

  // 4 endpoint URL 키워드 (F-02 인터셉트 대상)
  const ENDPOINT_KEYWORDS = ["GetUnionRaidData", "GetGuildMembers", "GetMyGuildInfo", "GetSavedRoleInfo"];

  // KST ISO 8601 (+09:00) — harness-config-standards §2.5
  function kstISO() {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 19) + "+09:00";
  }

  // 회차 번호 추출 (v1.12 getRaidNum 보존)
  function getRaidNum() {
    const body = document.body ? document.body.innerText : "";
    const match = body.match(/\[S(\d+)\]/);
    return match ? match[1] : null;
  }

  // =========================================================================
  // [F-NRA-001-02] captures + 변환 + schema validator
  // =========================================================================

  const captures = { raid: null, members: null, guildId: null, areaId: null, raidReq: null };

  // 도구 송신 조건과 분모 일치 — raid + members 만 필수 (guildId/areaId 는 옵셔널 메타).
  // floater 표시: "캡처 N/2".
  function capturedCount() {
    return (captures.raid ? 1 : 0) + (captures.members ? 1 : 0);
  }

  // =========================================================================
  // [v2.4.0] season_id ↔ 회차 변환 + 다회차 백필 + 레이드 당시 싱크로 레벨
  // season_id 형식: 1000040 = 40차 (base 1000000).
  // =========================================================================
  const SEASON_BASE = 1000000;
  const MAX_BACKFILL = 30; // 안전 cap — 무한 fetch 방지

  function seasonToRound(seasonId) {
    const n = Number(seasonId);
    if (!Number.isFinite(n)) return null;
    const r = n - SEASON_BASE;
    return r > 0 ? r : null;
  }
  function roundToSeason(round) {
    return String(SEASON_BASE + round);
  }

  // 레이드 당시 싱크로 레벨 (A2) — squad 니케 lv = 그 회차 싱크로 레벨(사용자 확정).
  // participate_data 를 nickname 으로 group → 멤버별 모든 타수의 max(squad[].lv).
  // nickname → member_id (현재 members) 매핑하여 { member_id: maxLv } 반환.
  function computeRoundSyncroLevels(raidJson, members) {
    const result = {};
    const pd = raidJson && raidJson.data && Array.isArray(raidJson.data.participate_data)
      ? raidJson.data.participate_data : [];
    // nickname → max squad lv
    const byNick = {};
    for (const rec of pd) {
      const nick = rec && rec.nickname;
      if (!nick) continue;
      const squad = Array.isArray(rec.squad) ? rec.squad : [];
      let mx = byNick[nick] || 0;
      for (const u of squad) {
        const lv = u && typeof u.lv === "number" ? u.lv : 0;
        if (lv > mx) mx = lv;
      }
      byNick[nick] = mx;
    }
    // nickname → member_id (현재 멤버 기준). 미참여/탈퇴 멤버는 byId 에서 자연 제외.
    const nickToId = {};
    for (const m of (members || [])) {
      if (m && m.nickname) nickToId[m.nickname] = m.member_id;
    }
    for (const nick of Object.keys(byNick)) {
      const id = nickToId[nick];
      if (id && byNick[nick] > 0) result[id] = byNick[nick];
    }
    // byId: 현재 멤버(member_id) 기준. byNick: 전체 참가자(닉네임) 기준 — 탈퇴자 기록용.
    return { byId: result, byNick };
  }

  // season_id 만 바꿔 과거 회차 데이터 직접 fetch (헤더 하드코딩 + cookie).
  // 반환: raidJson (pdCount>0) | null (빈 회차 / 실패).
  async function fetchRoundRaid(round, reqBase) {
    const url = "https://api.blablalink.com/api/game/proxy/Game/GetUnionRaidDataOfGuildSeason";
    const headers = {
      "content-type": "application/json",
      "x-channel-type": "2",
      "x-language": "ko",
      "x-common-params": JSON.stringify({
        game_id: "16", area_id: "global", source: "pc_web", intl_game_id: "29080",
        language: "ko", env: "prod", data_statistics_scene: "outer",
        data_statistics_page_id: location.href,
        data_statistics_client_type: "pc_web", data_statistics_lang: "ko"
      })
    };
    try {
      const res = await originalFetch(url, {
        method: "POST", headers, credentials: "include",
        body: JSON.stringify({
          area_id: reqBase.area_id, guild_id: reqBase.guild_id, season_id: roundToSeason(round)
        })
      });
      const j = await res.json();
      const pd = j && j.data && j.data.participate_data;
      return (j && j.code === 0 && Array.isArray(pd) && pd.length > 0) ? j : null;
    } catch (e) {
      console.log("[NRA] fetchRoundRaid 실패 round=" + round + ":", e && e.message);
      return null;
    }
  }

  // 단일 회차 fetch + 가공. 이미 가진 currentRound 의 raidJson 재사용 가능.
  async function buildRound(r, reqBase, members, currentRound) {
    const raidJson = (r === currentRound && captures.raid)
      ? captures.raid
      : await fetchRoundRaid(r, reqBase);
    if (!raidJson) return null; // 블라 미제공/빈 회차
    const rows = processRaidDataWithFallback(raidJson, String(r)).slice(1); // header 제거
    const { byId, byNick } = computeRoundSyncroLevels(raidJson, members);
    return { raidNum: String(r), raid: rows, memberSyncroLevels: byId, levelsByNickname: byNick };
  }

  // gap-aware 다회차 백필.
  //  - tail: current 부터 내림차순, 첫 빈 응답 또는 fromRound 미만에서 중단 (연속 최신분).
  //  - need: SPA 가 지정한 interior gap 회차 — 각각 직접 fetch, 빈 회차는 skip (블라 한도).
  // 반환: rounds[] (오름차순, raidNum 중복 제거). 총 fetch 는 MAX_BACKFILL 로 제한.
  async function backfillRounds(currentRound, fromRound, needRounds, reqBase, members) {
    const byNum = new Map(); // raidNum(string) → round
    let fetchCount = 0;

    // 1) tail (연속 최신분)
    //   from 제공(시트에 회차 존재): from~current 만 수집.
    //   from 없음(빈 시트): 가용 한도(MAX_BACKFILL)까지 전체 백필 — 첫 빈 응답에서 중단.
    const tailFloor = Math.max(currentRound - MAX_BACKFILL + 1, 1);
    const lowerBound = fromRound && fromRound > 0 ? Math.max(fromRound, tailFloor) : tailFloor;
    for (let r = currentRound; r >= lowerBound; r--) {
      if (fetchCount >= MAX_BACKFILL) break;
      const round = await buildRound(r, reqBase, members, currentRound);
      if (r !== currentRound) fetchCount++;
      if (!round) break; // 첫 빈 응답에서 tail 중단
      byNum.set(round.raidNum, round);
      updatePanel({ statusText: "회차 데이터 수집 중... (" + byNum.size + "개)" });
      sendProgress({ statusText: "회차 데이터 수집 중... (" + byNum.size + "개)" });
    }

    // 2) need (interior gap) — 각각 직접 fetch, 빈 회차 skip
    for (const r of needRounds) {
      if (fetchCount >= MAX_BACKFILL) break;
      if (byNum.has(String(r))) continue; // tail 에서 이미 수집
      const round = await buildRound(r, reqBase, members, currentRound);
      fetchCount++;
      if (!round) continue; // 블라 미제공 회차 → skip
      byNum.set(round.raidNum, round);
      updatePanel({ statusText: "회차 데이터 수집 중... (" + byNum.size + "개)" });
      sendProgress({ statusText: "회차 데이터 수집 중... (" + byNum.size + "개)" });
    }

    return [...byNum.values()].sort((a, b) => Number(a.raidNum) - Number(b.raidNum));
  }

  // GetGuildMembers items[] → Member[] (code != 0 또는 items 부재 시 null)
  function processGuildMembers(data) {
    if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) {
      return null;
    }
    return data.data.items.map(m => ({
      member_id: m.member_id,
      nickname: m.nickname,
      synchro_level: m.synchro_level,
      commander_level: m.level,
      icon_id: m.icon_id
    }));
  }

  // 응답 schema 1단 검증 (synchro_level number + member_id string)
  function validateMembersSchema(data) {
    if (!data || data.code !== 0 || !data.data || !Array.isArray(data.data.items)) {
      return { ok: false, reason: "invalid_response" };
    }
    const items = data.data.items;
    if (items.length === 0) {
      return { ok: false, reason: "empty_items" };
    }
    for (const m of items) {
      if (typeof m.synchro_level !== "number") {
        return { ok: false, reason: "missing_synchro_level" };
      }
      if (typeof m.member_id !== "string") {
        return { ok: false, reason: "missing_member_id" };
      }
    }
    return { ok: true };
  }

  // =========================================================================
  // [F-NRA-001-04] 진단 메시지 (need-login / no-data / error) + idempotent
  // =========================================================================

  const sentDiagnostics = new Set();

  // payload.type 키로 dedup 후 도구로 송신
  function sendDiagnostic(payload) {
    if (sentDiagnostics.has(payload.type)) return false;
    sentDiagnostics.add(payload.type);
    try {
      if (PAGE_WINDOW.opener && !PAGE_WINDOW.opener.closed) {
        PAGE_WINDOW.opener.postMessage(payload, TOOL_ORIGIN);
      }
    } catch (e) { /* swallow — 페이지 흐름 비파괴 */ }
    updatePanel({ diagnostic: payload.type, statusText: diagnosticText(payload.type) });
    console.log("[NRA] diagnostic sent:", payload.type);
    return true;
  }

  // 응답별 진단 분류 (모든 endpoint 응답 직후 호출)
  function inspectResponse(json, endpoint) {
    if (!json || typeof json !== "object") return;
    if (json.code !== 0) {
      sendDiagnostic(buildPayload("error", { error: { code: json.code, msg: json.msg || "non_zero_code" } }));
      return;
    }
    if (endpoint === "GetGuildMembers") {
      const items = json.data && json.data.items;
      if (Array.isArray(items) && items.length === 0) {
        sendDiagnostic(buildPayload("no-data", { reason: "guild_members_empty" }));
        return;
      }
      const v = validateMembersSchema(json);
      if (!v.ok && v.reason === "missing_synchro_level") {
        sendDiagnostic(buildPayload("error", { error: { code: -1, msg: "schema_changed_missing_synchro_level" } }));
      }
    }
  }

  // =========================================================================
  // [F-NRA-001-03] payload builder (4 type) + checkAndSend
  // =========================================================================

  // TD-05 discriminated union: nikke-raid-data / need-login / no-data / error
  function buildPayload(type, extras = {}) {
    const base = { type, capturedAt: kstISO(), scriptVersion: NRA_VERSION };
    if (type === "nikke-raid-data") {
      const raidNum = getRaidNum();
      return Object.assign(base, {
        raidNum: raidNum,
        // SOT(API_SPEC §2) raid = ProcessedRaidRow[] (headerless). processRaidData는
        // [headers, ...rows]를 반환하므로 header(index 0)를 제거하고 데이터 row만 전송한다.
        // (CSV fallback은 exportToCSV가 별도로 header를 재생성한다.)
        raid: captures.raid ? processRaidDataWithFallback(captures.raid, raidNum).slice(1) : null,
        members: processGuildMembers(captures.members),
        meta: { guildId: captures.guildId, areaId: captures.areaId }
      }, extras);
    }
    if (type === "error") {
      return Object.assign(base, { error: extras.error || { code: -1, msg: "unknown" } });
    }
    // need-login / no-data 및 기타: extras (reason 등) 병합
    return Object.assign(base, extras);
  }

  // 다회차 payload 구성 (신규 type). rounds 오름차순.
  function buildMultiPayload(rounds, members) {
    return {
      type: "nikke-raid-multi",
      capturedAt: kstISO(),
      scriptVersion: NRA_VERSION,
      availableRaidNums: rounds.map(r => r.raidNum),
      rounds: rounds,
      members: members,
      meta: { guildId: captures.guildId, areaId: captures.areaId }
    };
  }

  // payload 송신 (opener postMessage → 실패 시 CSV fallback).
  function dispatchPayload(payload, csvFallbackPayload) {
    console.log("[NRA] PAGE_WINDOW.opener:", typeof PAGE_WINDOW.opener,
                "closed:", PAGE_WINDOW.opener?.closed, "TOOL_ORIGIN:", TOOL_ORIGIN);
    try {
      if (PAGE_WINDOW.opener && !PAGE_WINDOW.opener.closed) {
        PAGE_WINDOW.opener.postMessage(payload, TOOL_ORIGIN);
        console.log("[NRA] postMessage sent, size:", JSON.stringify(payload).length);
        updatePanel({ statusText: "도구로 전송 완료", diagnostic: "success" });
        return;
      }
    } catch (e) {
      console.log("[NRA] postMessage failed, fallback CSV:", e && e.message);
    }
    console.log("[NRA] no opener, fallback CSV");
    fallbackCSV(csvFallbackPayload || payload);
  }

  // 수집 진행 송신 (opener postMessage) — 패널 갱신과 동반 호출하여 캡처/회차 진행을 SPA 화면에 미러링.
  // opener 미가용/송신 실패는 무해(무시). 캡처/전송 코어는 무변경.
  function sendProgress(state) {
    try {
      if (PAGE_WINDOW.opener && !PAGE_WINDOW.opener.closed) {
        PAGE_WINDOW.opener.postMessage({
          type: "nra-progress",
          captured: state.captured != null ? state.captured : capturedCount(),
          total: 2,
          statusText: state.statusText != null ? state.statusText : "",
          scriptVersion: NRA_VERSION,
        }, TOOL_ORIGIN);
      }
    } catch (e) { /* 진행 송신 실패는 무해 */ }
  }

  // raid + members 모두 캡처되면 다회차 백필 후 도구로 송신.
  let nraSent = false;
  function checkAndSend() {
    if (nraSent) return;
    if (!captures.raid || !captures.members) return;
    nraSent = true;
    clearTimeout(captureTimeout);

    const members = processGuildMembers(captures.members);
    const currentRound = captures.raidReq ? seasonToRound(captures.raidReq.season_id) : null;

    // season_id 확보 실패 → 레거시 single fallback (회차 추측은 SPA 측 guessNextRaidNum)
    if (currentRound === null || !captures.raidReq) {
      console.log("[NRA] season_id 미확보 — 레거시 single payload fallback");
      dispatchPayload(buildPayload("nikke-raid-data"));
      return;
    }

    // 다회차 백필 (tail: 현재~from + need: interior gap, 빈 회차 skip)
    updatePanel({ statusText: "회차 데이터 수집 중..." });
    sendProgress({ statusText: "회차 데이터 수집 중..." });
    backfillRounds(currentRound, NRA_FROM_ROUND, NRA_NEED_ROUNDS, captures.raidReq, members)
      .then(rounds => {
        rounds = rounds || [];
        // 현재 회차는 항상 포함 — SPA 의 최신 회차 식별·미참여 판정 기준이 된다.
        // backfill 이 from>current 로 tail 을 비우거나 need 에 현재 회차가 빠져도 passive capture 로 보장.
        if (!rounds.some(r => r.raidNum === String(currentRound))) {
          const cur = computeRoundSyncroLevels(captures.raid, members);
          rounds.push({
            raidNum: String(currentRound),
            raid: processRaidDataWithFallback(captures.raid, String(currentRound)).slice(1),
            memberSyncroLevels: cur.byId,
            levelsByNickname: cur.byNick
          });
          rounds.sort((a, b) => Number(a.raidNum) - Number(b.raidNum));
        }
        console.log("[NRA] 다회차 수집 완료:", rounds.map(r => r.raidNum).join(", "));
        const sentStatus = "회차 " + rounds.length + "개 전송 (" + rounds.map(r => r.raidNum + "차").join("·") + ")";
        updatePanel({ statusText: sentStatus });
        sendProgress({ statusText: sentStatus });
        dispatchPayload(buildMultiPayload(rounds, members), buildPayload("nikke-raid-data"));
      })
      .catch(e => {
        console.log("[NRA] 다회차 백필 오류, single fallback:", e && e.message);
        dispatchPayload(buildPayload("nikke-raid-data"));
      });
  }

  // =========================================================================
  // [F-NRA-001-05] floating panel UI + state + CSV fallback
  // =========================================================================

  const PALETTE = {
    paper: "#F4EDE2",
    ink: "#1F1A14",
    meta: "#6B5E4E",
    rust: "#C9532D",
    olive: "#5C6A2F",
    clay: "#8A6A1F",
    errorBg: "#F3D9CE",
    errorInk: "#8A2D0E"
  };

  const DIAGNOSTIC_STYLE = {
    success: { fg: PALETTE.olive, bg: "transparent", label: "전송 완료" },
    "need-login": { fg: "#FFFFFF", bg: PALETTE.rust, label: "blablalink 로그인 필요" },
    "no-data": { fg: "#FFFFFF", bg: PALETTE.clay, label: "데이터 없음" },
    error: { fg: PALETTE.errorInk, bg: PALETTE.errorBg, label: "오류 — 도구 확인" }
  };

  function diagnosticText(type) {
    const s = DIAGNOSTIC_STYLE[type];
    return s ? s.label : "진행 중";
  }

  let panelReady = false;

  function ensureFloatingPanel() {
    if (!document.body) {
      // document-start 시점 — body 준비 후 재시도
      document.addEventListener("DOMContentLoaded", ensureFloatingPanel, { once: true });
      return null;
    }
    let panel = document.getElementById("nra-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "nra-panel";
    Object.assign(panel.style, {
      position: "fixed", top: "20px", right: "20px", zIndex: "999999",
      padding: "12px 16px", minWidth: "240px", maxWidth: "320px",
      background: PALETTE.paper, color: PALETTE.ink,
      border: "1.5px solid " + PALETTE.rust, borderRadius: "12px",
      fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "13px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.12)", lineHeight: "1.5"
    });
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '  <span style="font-family:ui-monospace,monospace;font-size:11px;color:' + PALETTE.rust + ';letter-spacing:0.06em">NIKKE RAID AUTOSYNC v2</span>' +
      '  <button id="nra-close" aria-label="닫기" style="background:none;border:0;color:' + PALETTE.meta + ';font-size:16px;cursor:pointer;line-height:1;padding:0 2px">×</button>' +
      '</div>' +
      '<div id="nra-status" style="margin-bottom:6px">데이터 캡처 중...</div>' +
      '<div id="nra-progress" style="font-size:11px;color:' + PALETTE.meta + '">캡처 0/2</div>' +
      '<div id="nra-action" style="margin-top:8px;display:none"></div>';
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector("#nra-close");
    if (closeBtn) closeBtn.addEventListener("click", () => panel.remove());
    document.addEventListener("keydown", onEscClose);

    panelReady = true;
    return panel;
  }

  function onEscClose(e) {
    if (e.key === "Escape") {
      const panel = document.getElementById("nra-panel");
      if (panel) panel.remove();
    }
  }

  // state: { statusText, captured (0-4), showAction, diagnostic }
  function updatePanel(state) {
    const panel = ensureFloatingPanel();
    if (!panel) return; // body 미준비 — DOMContentLoaded 후 재호출
    if (state.statusText != null) {
      const el = panel.querySelector("#nra-status");
      if (el) el.textContent = state.statusText;
    }
    if (state.captured != null) {
      const el = panel.querySelector("#nra-progress");
      if (el) el.textContent = "캡처 " + state.captured + "/2";
    }
    if (state.diagnostic != null) {
      const style = DIAGNOSTIC_STYLE[state.diagnostic];
      const statusEl = panel.querySelector("#nra-status");
      if (style && statusEl) {
        statusEl.style.color = style.fg;
        statusEl.style.background = style.bg;
        statusEl.style.padding = style.bg === "transparent" ? "0" : "2px 6px";
        statusEl.style.borderRadius = "4px";
      }
    }
    if (state.showAction) {
      const action = panel.querySelector("#nra-action");
      if (action) action.style.display = "block";
    }
  }

  // v1.12 호환 CSV 직렬화 (BOM + join(",") + join("\n")) — 회귀 위험 0
  function exportToCSV(payload) {
    // payload.raid는 headerless(SOT). CSV는 v1.12 header row가 필요하므로
    // raw capture에서 [headers, ...rows] 전체 테이블을 재생성한다.
    if (!captures.raid) {
      console.log("[NRA] exportToCSV: no raid capture");
      return;
    }
    const raidNum = payload && payload.raidNum;
    const rowsArray = processRaidDataWithFallback(captures.raid, raidNum); // [headers, ...rows]
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = raidNum ? `니케_유레_S${raidNum}_${dateStr}.csv` : `니케_유레_${dateStr}.csv`;

    const BOM = String.fromCharCode(0xFEFF); // v1.12 호환: CSV 선두 BOM (Excel 한글 인코딩)
    const csvRawText = BOM + rowsArray.map(row => row.join(",")).join("\n");
    const csvBlob = new Blob([csvRawText], { type: "text/csv;charset=utf-8;" });
    const tempLink = document.createElement("a");
    const blobUrl = URL.createObjectURL(csvBlob);
    tempLink.href = blobUrl;
    tempLink.download = fileName;
    tempLink.click();
    URL.revokeObjectURL(blobUrl);
  }

  // 도구 미연결 시 fallback — CSV 다운로드 버튼 노출
  function fallbackCSV(payload) {
    const panel = ensureFloatingPanel();
    updatePanel({ statusText: "도구 미연결 — CSV 다운로드 준비됨", showAction: true });
    if (!panel) return;
    const action = panel.querySelector("#nra-action");
    if (!action) return;
    action.innerHTML = "";
    const btn = document.createElement("button");
    btn.textContent = "CSV 다운로드";
    Object.assign(btn.style, {
      padding: "6px 12px", background: PALETTE.rust, color: "#FFF",
      border: "0", borderRadius: "6px", cursor: "pointer", fontSize: "12px"
    });
    btn.addEventListener("click", () => exportToCSV(payload));
    action.appendChild(btn);
  }

  // =========================================================================
  // [F-NRA-001-02] fetch / XHR 4-키워드 인터셉트 (response.clone 비파괴)
  // =========================================================================

  function matchEndpoint(url) {
    if (!url) return null;
    const s = url.toString();
    for (const kw of ENDPOINT_KEYWORDS) {
      if (s.includes(kw)) return kw;
    }
    return null;
  }

  // 요청 body(문자열)에서 {area_id, guild_id, season_id} 파싱 → captures.raidReq.
  // 다회차 백필 시 area_id/guild_id 재사용 + season_id 로 현재 회차 결정.
  function captureRaidReqBody(rawBody) {
    try {
      const b = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
      if (b && (b.season_id != null) && (b.guild_id != null)) {
        captures.raidReq = { area_id: b.area_id, guild_id: b.guild_id, season_id: String(b.season_id) };
      }
    } catch (e) { /* ignore */ }
  }

  // 캡처된 응답 1건 처리 (fetch / XHR 공용) — DRY: inspectResponse 단일 wiring
  function handleCapture(endpoint, json, reqBody) {
    try {
      if (endpoint === "GetUnionRaidData") {
        captures.raid = json;
        if (reqBody != null) captureRaidReqBody(reqBody);
      } else if (endpoint === "GetGuildMembers") {
        captures.members = json;
      } else if (endpoint === "GetMyGuildInfo") {
        captures.guildId = (json && json.data && json.data.guild_id) ?? null;
      } else if (endpoint === "GetSavedRoleInfo") {
        // ?? (not ||): area_id === 0 은 유효한 값이므로 null로 강등하지 않는다
        captures.areaId = (json && json.data && (json.data.area_id != null ? json.data.area_id : json.data.nikke_area_id)) ?? null;
      }
      console.log("[NRA] captured:", endpoint);
      inspectResponse(json, endpoint);
      updatePanel({ captured: capturedCount() });
      sendProgress({ captured: capturedCount() });
      checkAndSend();
    } catch (e) { /* swallow — 페이지 흐름 비파괴 */ }
  }

  // fetch wrapper — PAGE_WINDOW(=unsafeWindow) 의 fetch 를 직접 후킹.
  // anti-debugger 또는 page script 가 우리 후에 fetch 를 reset 하려고 시도해도
  // Object.defineProperty getter/setter 로 silently ignore 하여 wrapper 보존.
  const originalFetch = PAGE_WINDOW.fetch.bind(PAGE_WINDOW);
  const ourFetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const url = args[0];
      const endpoint = matchEndpoint(url);
      if (endpoint) {
        const json = await response.clone().json();
        const reqBody = args[1] && args[1].body != null ? args[1].body : null;
        handleCapture(endpoint, json, reqBody);
      } else if (matchCdnMasterUrl(url)) {
        // sg-tools-cdn JSON — 캐릭터 마스터 패턴이면 fallback dict 갱신
        const json = await response.clone().json();
        if (isNikkeMasterJson(json)) {
          ingestNikkeMaster(json); // cdnFallbackDict 갱신 (런타임 fallback). 사용자 알림 없음.
        }
      }
    } catch (e) { /* ignore parsing errors */ }
    return response;
  };
  try {
    Object.defineProperty(PAGE_WINDOW, "fetch", {
      configurable: true,
      enumerable: true,
      get() { return ourFetch; },
      set() { /* 페이지의 fetch reset 시도 silently ignore — wrapper 보존 */ },
    });
  } catch (e) {
    // defineProperty 실패 환경 — 일반 할당 fallback (페이지 reset 에 취약하지만 동작은 함)
    PAGE_WINDOW.fetch = ourFetch;
  }

  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (...args) {
    this._nraUrl = args[1];
    return open.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const reqBody = args && args.length > 0 ? args[0] : null;
    this.addEventListener("load", function () {
      try {
        const endpoint = matchEndpoint(this._nraUrl);
        if (endpoint) {
          const json = JSON.parse(this.responseText);
          handleCapture(endpoint, json, reqBody);
        } else if (matchCdnMasterUrl(this._nraUrl)) {
          const json = JSON.parse(this.responseText);
          if (isNikkeMasterJson(json)) {
            ingestNikkeMaster(json); // cdnFallbackDict 갱신 (런타임 fallback). 사용자 알림 없음.
          }
        }
      } catch (e) { /* ignore parsing errors */ }
    });
    return send.apply(this, args);
  };

  // =========================================================================
  // [F-NRA-001-04] 10s 타임아웃 + login redirect 감지
  // =========================================================================

  function isLoginPage() {
    return /\/login|\/signin/i.test(location.pathname);
  }

  // 즉시 + pathname 변경 시 need-login 감지
  function checkLogin() {
    if (isLoginPage()) {
      sendDiagnostic(buildPayload("need-login", { reason: "login_redirect" }));
    }
  }

  const captureTimeout = setTimeout(() => {
    if (!captures.raid || !captures.members) {
      if (!captures.raid && !captures.members) {
        sendDiagnostic(buildPayload("no-data", { reason: "capture_timeout" }));
      } else {
        sendDiagnostic(buildPayload("error", { error: { code: -2, msg: "partial_capture_timeout" } }));
      }
    }
  }, 10000);

  // SPA pathname 변경 추적 (popstate + history pushState 패치)
  window.addEventListener("popstate", checkLogin);
  const _pushState = history.pushState;
  history.pushState = function (...a) {
    const r = _pushState.apply(this, a);
    checkLogin();
    return r;
  };

  // =========================================================================
  // [Public API] 콘솔/도구 검증용 export (@grant none → page window)
  // =========================================================================

  const NRA_USERSCRIPT = {
    VERSION: NRA_VERSION,
    NIKKE_DATA_LIST,
    nikkeDictionary,
    findNikkeName,
    findNikkeBreak,
    processRaidData,
    processGuildMembers,
    validateMembersSchema,
    buildPayload,
    buildMultiPayload,
    getRaidNum,
    seasonToRound,
    roundToSeason,
    computeRoundSyncroLevels,
    fetchRoundRaid,
    backfillRounds,
    kstISO,
    captures,
    onCapture: handleCapture,
    checkAndSend,
    exportToCSV
  };
  if (typeof window !== "undefined") {
    window.NRA_USERSCRIPT = NRA_USERSCRIPT;
  }

  // 초기화
  ensureFloatingPanel();
  checkLogin();
  console.log("[NRA] v" + NRA_VERSION + " loaded");
})();
