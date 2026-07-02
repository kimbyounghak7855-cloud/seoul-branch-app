// ============================================================
// update-remarks.gs — 앱의 "요구사항/메모"를 구글시트 "비고"(M열)에 자동 반영
//
// 이 파일은 Google Apps Script에 그대로 붙여넣는 용도입니다.
// 시트를 소유(또는 편집권한을 가진) 계정으로 배포해야 하며, 배포한 계정의
// 권한으로 시트에 값을 씁니다.
//
// [배포 방법]
// 1) https://script.google.com 에서 새 프로젝트 생성 (또는 시트에서
//    확장 프로그램 > Apps Script)
// 2) 기본 코드를 모두 지우고 이 파일의 내용 전체를 붙여넣기
// 3) 우측 상단 "배포" > "새 배포" 클릭
// 4) 유형 선택에서 톱니바퀴 아이콘 > "웹 앱" 선택
// 5) "실행 계정": 나(본인 계정) / "액세스 권한이 있는 사용자": 전체 로 설정 후 배포
// 6) 처음 배포 시 권한 승인 화면이 뜨면 본인 계정으로 승인
// 7) 발급된 웹앱 URL(예: https://script.google.com/macros/s/xxx/exec)을
//    복사해서 앱의 js/config.js 의 SHEET_WRITE_PROXY_URL 에 붙여넣으면 됩니다.
//
// [주의]
// - 시트 구조(B 순번, C 상호, M 비고)가 바뀌면 아래 COL_* 상수도 함께 수정하세요.
// - 코드를 수정한 뒤에는 "새 배포"가 아니라 기존 배포를 "편집"해서 새 버전으로
//   배포해야 웹앱 URL이 바뀌지 않습니다.
// ============================================================

var SHEET_ID = "1hoRNH8ZF2H7lT1eHco7EbwyDtRkBmaQapXstzDlzilQ";
var GID = 735063110; // "개원예정(메디잡)" 탭

var COL_SEQ = 2; // B열 (순번)
var COL_NAME = 3; // C열 (상호)
var COL_NOTE = 13; // M열 (비고)

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var seq = String(payload.seq || "").trim();
    var name = String(payload.name || "").trim();
    var note = payload.note != null ? String(payload.note) : "";

    if (!seq || !name) {
      return jsonResponse({ ok: false, error: "seq/name이 필요합니다." });
    }

    var sheet = findSheetByGid();
    if (!sheet) {
      return jsonResponse({ ok: false, error: "시트 탭(gid)을 찾을 수 없습니다." });
    }

    var values = sheet.getDataRange().getValues();
    for (var i = 0; i < values.length; i++) {
      var rowSeq = String(values[i][COL_SEQ - 1] || "").trim();
      var rowName = String(values[i][COL_NAME - 1] || "").trim();
      if (rowSeq === seq && rowName === name) {
        sheet.getRange(i + 1, COL_NOTE).setValue(note);
        return jsonResponse({ ok: true });
      }
    }
    return jsonResponse({ ok: false, error: "일치하는 행을 찾지 못했습니다 (seq/name 확인 필요)." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function findSheetByGid() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === GID) return sheets[i];
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
