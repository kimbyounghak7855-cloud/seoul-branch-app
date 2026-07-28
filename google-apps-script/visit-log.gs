// ============================================================
// visit-log.gs — 앱의 "방문 기록"(입장/퇴장/메모) + "지점(병원) 목록" 전체를
// 방문기록 전용 구글시트에 자동 반영 (탭 2개: "방문기록", "지점목록")
//
// "개원예정(메디잡)" 영업 스프레드시트와는 별개로, 이 앱의 모든 데이터를 한 곳에
// 모아보기 위해 새로 만든 구글시트(아래 SHEET_ID)에 씁니다.
// 시트 주소: https://docs.google.com/spreadsheets/d/1xTUjqjSJn_bxgLtEZwHcLq-KCGE4yukjrbdGiG8cEME/edit
//
// 이 파일은 Google Apps Script에 그대로 붙여넣는 용도입니다.
// 시트를 소유(또는 편집권한을 가진) 계정으로 배포해야 하며, 배포한 계정의
// 권한으로 시트에 값을 씁니다.
//
// [배포 방법]
// 1) 위 방문기록 시트를 열고 "확장 프로그램 > Apps Script" 클릭 (해당 시트에
//    바로 연결된 스크립트로 만들어지므로 별도 프로젝트를 새로 만들 필요가 없습니다)
// 2) 기본 코드(Code.gs)를 모두 지우고 이 파일의 내용 전체를 붙여넣기
// 3) 우측 상단 "배포" > "새 배포" 클릭
// 4) 유형 선택에서 톱니바퀴 아이콘 > "웹 앱" 선택
// 5) "실행할 함수": doPost (이 파일의 doPost) / "실행 계정": 나(본인 계정) /
//    "액세스 권한이 있는 사용자": 전체 로 설정 후 배포
// 6) 처음 배포 시 권한 승인 화면이 뜨면 본인 계정으로 승인
// 7) 발급된 웹앱 URL(예: https://script.google.com/macros/s/yyy/exec)을
//    복사해서 앱의 js/config.js 의 DATA_SHEET_PROXY_URL 에 붙여넣으면 됩니다.
// 8) "방문기록"/"지점목록" 탭은 최초 반영 시 스크립트가 자동으로 만듭니다
//    (헤더 행 포함, 직접 만들 필요 없음).
//
// [주의]
// - 이 스크립트는 "개원예정(메디잡)" 영업 스프레드시트에 쓰는 update-remarks.gs와는
//   완전히 별개의(다른 시트에 바인딩된) 프로젝트이므로 함께 두어도 충돌하지 않습니다.
// - 코드를 수정한 뒤에는 "새 배포"가 아니라 기존 배포를 "편집"해서 새 버전으로
//   배포해야 웹앱 URL이 바뀌지 않습니다.
// ============================================================

var SHEET_ID = "1xTUjqjSJn_bxgLtEZwHcLq-KCGE4yukjrbdGiG8cEME";

var VISIT_SHEET_NAME = "방문기록";
var VISIT_COL_ID = 1; // A열: 방문ID
var VISIT_COL_BRANCH_NAME = 2; // B열
var VISIT_COL_CHECK_IN = 3; // C열
var VISIT_COL_CHECK_OUT = 4; // D열
var VISIT_COL_NOTE = 5; // E열
var VISIT_COL_CREATED_BY = 6; // F열
var VISIT_COL_UPDATED_AT = 7; // G열
var VISIT_HEADER = ["방문ID", "병원명", "입장일시", "퇴장일시", "메모", "작성자", "최종수정일시"];

var BRANCH_SHEET_NAME = "지점목록";
var BRANCH_COL_ID = 1; // A열: 지점ID
var BRANCH_COL_NAME = 2; // B열
var BRANCH_COL_ADDRESS = 3; // C열
var BRANCH_COL_STATUS = 4; // D열
var BRANCH_COL_PRIORITY = 5; // E열
var BRANCH_COL_OPEN_DATE = 6; // F열
var BRANCH_COL_CONTRACT_START = 7; // G열
var BRANCH_COL_ASSIGNEE = 8; // H열
var BRANCH_COL_REQUIREMENTS = 9; // I열
var BRANCH_COL_LAT = 10; // J열
var BRANCH_COL_LNG = 11; // K열
var BRANCH_COL_UPDATED_AT = 12; // L열
var BRANCH_HEADER = [
  "지점ID", "병원명", "주소", "상태", "우선순위", "개업예정일",
  "계약시작일", "담당자", "요구사항/메모", "위도", "경도", "최종수정일시",
];

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var entity = String(payload.entity || "visit").trim();
    if (entity === "branch") return handleBranch(payload);
    return handleVisit(payload);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function handleVisit(payload) {
  var action = String(payload.action || "").trim();
  var visitId = String(payload.visitId || "").trim();
  if (!action || !visitId) {
    return jsonResponse({ ok: false, error: "action/visitId가 필요합니다." });
  }

  var sheet = getOrCreateSheet(VISIT_SHEET_NAME, VISIT_HEADER);

  if (action === "checkin") {
    sheet.appendRow([
      visitId,
      payload.branchName || "",
      payload.checkIn || "",
      "",
      payload.note || "",
      payload.createdBy || "",
      new Date(),
    ]);
    return jsonResponse({ ok: true });
  }

  var rowIndex = findRowById(sheet, VISIT_COL_ID, visitId);
  if (action === "delete") {
    if (rowIndex > 0) sheet.deleteRow(rowIndex);
    return jsonResponse({ ok: true });
  }
  if (rowIndex <= 0) {
    return jsonResponse({ ok: false, error: "일치하는 방문 기록을 찾지 못했습니다 (visitId 확인 필요)." });
  }
  if (action === "checkout") {
    sheet.getRange(rowIndex, VISIT_COL_CHECK_OUT).setValue(payload.checkOut || "");
  } else if (action === "note") {
    sheet.getRange(rowIndex, VISIT_COL_NOTE).setValue(payload.note != null ? payload.note : "");
  } else {
    return jsonResponse({ ok: false, error: "알 수 없는 action입니다: " + action });
  }
  sheet.getRange(rowIndex, VISIT_COL_UPDATED_AT).setValue(new Date());
  return jsonResponse({ ok: true });
}

function handleBranch(payload) {
  var action = String(payload.action || "").trim();
  var branchId = String(payload.branchId || "").trim();
  if (!action || !branchId) {
    return jsonResponse({ ok: false, error: "action/branchId가 필요합니다." });
  }

  var sheet = getOrCreateSheet(BRANCH_SHEET_NAME, BRANCH_HEADER);
  var rowIndex = findRowById(sheet, BRANCH_COL_ID, branchId);

  if (action === "delete") {
    if (rowIndex > 0) sheet.deleteRow(rowIndex);
    return jsonResponse({ ok: true });
  }
  if (action !== "upsert") {
    return jsonResponse({ ok: false, error: "알 수 없는 action입니다: " + action });
  }

  var row = [
    branchId,
    payload.name || "",
    payload.address || "",
    payload.status || "",
    payload.priority || "",
    payload.openDate || "",
    payload.contractStartDate || "",
    payload.assignee || "",
    payload.requirements || "",
    payload.lat != null ? payload.lat : "",
    payload.lng != null ? payload.lng : "",
    new Date(),
  ];
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return jsonResponse({ ok: true });
}

function getOrCreateSheet(name, header) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

function findRowById(sheet, idColumn, id) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    // i=0은 헤더 행이므로 건너뜀
    if (String(values[i][idColumn - 1] || "").trim() === id) {
      return i + 1; // 시트 행 번호(1-based)
    }
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
