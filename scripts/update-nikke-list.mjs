// CI 자동화: blablalink(비로그인)에서 NIKKE 캐릭터 마스터를 발견·fetch →
// 하드코딩 NIKKE_DATA_LIST 에 없는 신규 SSR 을 정식명으로 append + 버전 bump.
//
// 설계 원칙:
//  - URL/경로 가정 0 — host(sg-tools-cdn)+.json 후보 중 "콘텐츠가 NIKKE 마스터"인 것을 식별.
//    (CDN URL 은 콘텐츠 해시라 버전마다 바뀌므로 절대 하드코딩하지 않는다.)
//  - fail-loud — 마스터를 못 찾으면 비정상 종료(파일 무수정 → workflow 가 commit 안 함).
//  - 별명 보존 — 기존 NIKKE_DATA_LIST 항목은 절대 수정/삭제하지 않고 신규만 끝에 append.
//  - 오프라인 테스트 — NRA_MASTER_FILE 환경변수가 있으면 브라우저 대신 그 로컬 JSON 사용.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_JS = path.join(__dirname, "..", "nikke-raid-autosync.user.js");
const PAGE_URL = "https://www.blablalink.com/shiftyspad/union-raid?lang=ko";
const DISCOVER_TIMEOUT_MS = 45000;
const POLL_MS = 1500;

function isNikkeMaster(j) {
  return (
    Array.isArray(j) &&
    j[0] &&
    typeof j[0].id === "number" &&
    String(j[0].id).length === 6 &&
    j[0].name_localkey &&
    typeof j[0].name_localkey.name === "string" &&
    j.some((x) => x && x.original_rare === "SSR")
  );
}

async function discoverMasterViaBrowser() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    const deadline = Date.now() + DISCOVER_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const master = await page.evaluate(async () => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.includes("sg-tools-cdn.blablalink.com") && u.split("?")[0].endsWith(".json"));
        for (const u of urls) {
          try {
            const j = await (await fetch(u)).json();
            if (
              Array.isArray(j) &&
              j[0] &&
              typeof j[0].id === "number" &&
              String(j[0].id).length === 6 &&
              j[0].name_localkey &&
              typeof j[0].name_localkey.name === "string" &&
              j.some((x) => x && x.original_rare === "SSR")
            ) {
              return j;
            }
          } catch (e) {
            /* ignore */
          }
        }
        return null;
      });
      if (master) return master;
      await page.waitForTimeout(POLL_MS);
    }
    return null;
  } finally {
    await browser.close();
  }
}

// feature(X.Y.Z) → X.Y.Z.1 ; data-build(X.Y.Z.N) → X.Y.Z.(N+1)
function bumpVersion(v) {
  const p = v.split(".");
  if (p.length === 3) return v + ".1";
  if (p.length === 4) {
    p[3] = String((parseInt(p[3], 10) || 0) + 1);
    return p.join(".");
  }
  throw new Error("예상치 못한 @version 형식: " + v);
}

async function main() {
  const src0 = fs.readFileSync(USER_JS, "utf8");

  // 1) 마스터 확보 (로컬 파일 override 또는 브라우저 발견)
  let master;
  const masterFile = process.env.NRA_MASTER_FILE;
  if (masterFile) {
    console.log("[dry-run] NRA_MASTER_FILE 사용:", masterFile);
    master = JSON.parse(fs.readFileSync(masterFile, "utf8"));
  } else {
    master = await discoverMasterViaBrowser();
  }
  if (!isNikkeMaster(master)) {
    console.error("FATAL: NIKKE 캐릭터 마스터를 찾지 못했거나 형식 불일치 — 변경 없이 종료(commit 안 함).");
    process.exit(1);
  }

  // 2) 하드코딩 NIKKE_DATA_LIST 파싱
  const m = src0.match(/NIKKE_DATA_LIST\s*=\s*`([\s\S]*?)`;/);
  if (!m) {
    console.error("FATAL: NIKKE_DATA_LIST 블록을 찾지 못함.");
    process.exit(1);
  }
  const hard = JSON.parse(m[1]);
  const knownKeys = new Set(hard.map((it) => Math.floor(it.id / 100)));

  // 3) diff — 마스터 SSR 중 key 미등록만 (key 중복 제거)
  const seen = new Set();
  const news = [];
  for (const it of master) {
    if (!it || it.original_rare !== "SSR") continue;
    if (typeof it.id !== "number" || !it.name_localkey || typeof it.name_localkey.name !== "string") continue;
    const key = Math.floor(it.id / 100);
    if (knownKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    news.push({ id: it.id, name: it.name_localkey.name });
  }

  if (news.length === 0) {
    console.log("최신 — 신규 SSR 없음. NIKKE_DATA_LIST 변경하지 않음.");
    process.exit(0);
  }

  // 4) append — 닫는 `\n]` 직전에 삽입 (기존 항목 무수정)
  const appendText = news
    .map((n) => `,\n  ${JSON.stringify({ id: n.id, name_localkey: { name: n.name } })}`)
    .join("");
  let src1 = src0.replace(/(NIKKE_DATA_LIST\s*=\s*`[\s\S]*?)(\n\]`;)/, (_all, body, tail) => body + appendText + tail);
  if (src1 === src0) {
    console.error("FATAL: NIKKE_DATA_LIST append 위치(닫는 `]`)를 찾지 못함.");
    process.exit(1);
  }

  // 5) 버전 bump (@version 헤더 + NRA_VERSION 상수 동시)
  const vm = src1.match(/@version\s+(\S+)/);
  if (!vm) {
    console.error("FATAL: @version 미발견.");
    process.exit(1);
  }
  const newVer = bumpVersion(vm[1]);
  src1 = src1.replace(/(@version\s+)(\S+)/, `$1${newVer}`);
  src1 = src1.replace(/(const NRA_VERSION = ")[^"]+(")/, `$1${newVer}$2`);

  // 6) 검증 — append 후 NIKKE_DATA_LIST 가 여전히 valid JSON 인지 (깨지면 throw → commit 안 함)
  const m2 = src1.match(/NIKKE_DATA_LIST\s*=\s*`([\s\S]*?)`;/);
  JSON.parse(m2[1]);

  fs.writeFileSync(USER_JS, src1);
  console.log(`신규 SSR ${news.length}건 추가 → v${newVer}`);
  for (const n of news) console.log("  +", JSON.stringify({ id: n.id, name_localkey: { name: n.name } }));
}

main().catch((e) => {
  console.error("FATAL:", (e && e.stack) || e);
  process.exit(1);
});
