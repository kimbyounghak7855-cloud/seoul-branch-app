// ============================================================
// 앱 설정 파일 — 여기에 Firebase 키를 채워넣으면 데모 모드가 해제됩니다.
// 설정 방법은 README.md 참고
//
// 지도는 네이버 지도 API(Naver Cloud Platform Maps)를 사용합니다.
// Client ID는 index.html의 <script src="...maps.js?ncpKeyId=..."> 에 있으며
// 대표 계정(무료 이용량) 기준으로 발급되어 있습니다.
// 동선 최적화는 무료 오픈소스 OSRM을 사용합니다.
// ============================================================

window.APP_CONFIG = {
  // Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱에서 복사
  FIREBASE_CONFIG: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },

  // 서울 시청 기준 기본 지도 중심
  DEFAULT_CENTER: { lat: 37.5665, lng: 126.978 },
  DEFAULT_ZOOM: 12,

  // 개업예정일 알림 기준 (며칠 이내면 "다가오는 일정"에 표시할지)
  UPCOMING_DAYS_THRESHOLD: 14,

  // 상호명(업체명) 검색용 CORS 프록시 주소 (Cloudflare Worker 등).
  // 비워두면 상호명 검색 기능이 꺼지고 기존 주소 검색만 동작합니다.
  // 설정 방법은 README.md와 cloudflare-worker/local-search-proxy.js 참고.
  // 예: "https://seoul-branch-place-search.본인계정.workers.dev"
  PLACE_SEARCH_PROXY_URL: "",

  // 지점 "요구사항/메모"를 구글시트 "비고"(M열)에 자동 반영할 Apps Script 웹앱 주소.
  // 비워두면 이 기능은 꺼지고(로컬 저장만 동작) 시트에는 반영되지 않습니다.
  // 설정 방법은 README.md와 google-apps-script/update-remarks.gs 참고.
  // 예: "https://script.google.com/macros/s/xxx/exec"
  SHEET_WRITE_PROXY_URL: "",
};

// 키가 비어있거나 플레이스홀더면 데모(로컬 저장) 모드로 동작합니다.
window.APP_CONFIG.IS_DEMO_MODE =
  !window.APP_CONFIG.FIREBASE_CONFIG.apiKey ||
  !window.APP_CONFIG.FIREBASE_CONFIG.projectId;

// 지도(네이버) Client ID는 index.html에 직접 포함되어 있어 항상 사용 가능합니다.
window.APP_CONFIG.HAS_MAPS_KEY = true;
