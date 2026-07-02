// ============================================================
// sheets-import.js — 구글 스프레드시트("개원예정(메디잡)" 탭) 연동
// API 키/OAuth 없이 gviz(tq) 쿼리 + JSONP 방식으로 읽기 전용 동기화.
// 시트는 "링크가 있는 모든 사용자에게 보기 권한"으로 공유되어 있어야 합니다.
// ============================================================

const SHEET_ID = "1hoRNH8ZF2H7lT1eHco7EbwyDtRkBmaQapXstzDlzilQ";
const GID = "735063110"; // 개원예정(메디잡) 탭
// 열 매핑: B 순번, C 상호, D 지점(서울/경기 등), E 지역(간이 분류), F 지역(시/군/구) 또는 전체주소,
//        G 연락처, H 확인일자, I 유입경로, J 개원 예정 월, K 담당영업사원, L 진행현황, M 비고
// 시트의 정보를 누락 없이 가져오기 위해 E열(지역)까지 포함합니다.
const QUERY = "select B,C,D,E,F,G,H,I,J,K,L,M where D = '서울'";

let jsonpCounter = 0;

function buildUrl(callbackName) {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({
    gid: GID,
    tqx: `out:json;responseHandler:${callbackName}`,
    tq: QUERY,
  });
  return `${base}?${params.toString()}`;
}

function fetchSheetJsonp(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const cbName = `__sba_sheet_cb_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement("script");
    let done = false;
    let timer = null;

    const cleanup = () => {
      delete window[cbName];
      script.remove();
      if (timer) clearTimeout(timer);
    };

    window[cbName] = (data) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("구글 시트 로드 실패 (네트워크 또는 시트 공유 설정을 확인하세요)"));
    };

    script.src = buildUrl(cbName);
    document.head.appendChild(script);

    timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("구글 시트 응답 시간 초과"));
    }, timeoutMs);
  });
}

function cellValue(cell) {
  if (!cell) return "";
  if (cell.f != null) return String(cell.f).trim();
  if (cell.v == null) return "";
  return String(cell.v).trim();
}

// 진행현황(L열) -> 영업중 / 계약완료 / 타업체계약 3단계로 정규화
function normalizeStatus(raw) {
  const v = (raw || "").trim();
  if (v === "계약완료") return "계약완료";
  if (v === "타업체계약") return "타업체계약";
  return "영업중"; // 빈 값 등은 기본적으로 진행중인 영업 대상으로 간주
}

function rowsFromTable(table) {
  const rows = (table && table.rows) || [];
  return rows
    .map((row) => {
      const c = row.c || [];
      return {
        seq: cellValue(c[0]), // B 순번
        name: cellValue(c[1]), // C 상호
        branchRegion: cellValue(c[2]), // D 지점
        region: cellValue(c[3]), // E 지역(간이 분류, 예: "서울 강남")
        address: cellValue(c[4]), // F 지역(시/군/구) 또는 전체주소
        contact: cellValue(c[5]), // G 연락처
        confirmedDate: cellValue(c[6]), // H 확인일자
        inboundChannel: cellValue(c[7]), // I 유입경로
        expectedOpenMonth: cellValue(c[8]), // J 개원 예정 월
        salesRep: cellValue(c[9]), // K 담당영업사원
        status: normalizeStatus(cellValue(c[10])), // L 진행현황
        note: cellValue(c[11]), // M 비고
      };
    })
    .filter((r) => r.name); // 상호 없는 빈 행 제거
}

async function fetchSeoulHospitalsFromSheet() {
  const data = await fetchSheetJsonp();
  if (!data || data.status === "error") {
    const msg = (data && data.errors && data.errors[0] && data.errors[0].detailed_message) || "알 수 없는 오류";
    throw new Error("구글 시트 쿼리 오류: " + msg);
  }
  return rowsFromTable(data.table);
}

// 동일 행 재가져오기 방지를 위한 고유 키 (순번+상호 조합)
function sheetRowKey(row) {
  return `sheet:${row.seq || "0"}:${row.name}`;
}

function parseSheetKey(key) {
  const m = /^sheet:([^:]*):([\s\S]*)$/.exec(key || "");
  if (!m) return null;
  return { seq: m[1], name: m[2] };
}

// 지점 "요구사항/메모"를 구글시트 "비고"(M열)에 반영합니다.
// google-apps-script/update-remarks.gs 를 배포해 SHEET_WRITE_PROXY_URL을 설정한
// 경우에만 동작하며, 미설정 시 조용히 아무 일도 하지 않습니다(로컬 저장만 유지).
async function pushNoteToSheet(sheetKey, note) {
  const proxyUrl = window.APP_CONFIG && window.APP_CONFIG.SHEET_WRITE_PROXY_URL;
  if (!proxyUrl) return;
  const parsed = parseSheetKey(sheetKey);
  if (!parsed) return;

  const res = await fetch(proxyUrl, {
    method: "POST",
    // Apps Script는 doOptions가 없어 프리플라이트를 처리하지 못하므로,
    // text/plain으로 보내 브라우저가 preflight 없이 "단순 요청"으로 취급하게 합니다.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ seq: parsed.seq, name: parsed.name, note: note || "" }),
  });
  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error((data && data.error) || "구글시트 비고 업데이트 실패");
  }
}

window.SheetsImport = {
  fetchSeoulHospitalsFromSheet,
  sheetRowKey,
  normalizeStatus,
  pushNoteToSheet,
};
