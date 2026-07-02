// ============================================================
// place-search.js — 네이버 지역검색(Local Search) Open API 연동
//
// 네이버 지도 SDK의 geocoder(Service.geocode)는 "주소"만 검색할 수 있고
// "한국의료환경" 같은 상호명(업체명) 검색은 지원하지 않습니다.
// 상호명 검색을 위해서는 별도의 네이버 "지역검색" Open API가 필요한데,
// 이 API는 브라우저에서 직접 호출할 수 없습니다(CORS 차단 + Client Secret
// 노출 문제). 그래서 서버 역할을 하는 CORS 프록시(예: Cloudflare Worker)를
// 거쳐서 호출합니다.
//
// 설정 방법(README.md 참고):
//   1) developers.naver.com 에서 "검색" API를 사용하는 애플리케이션을
//      직접 등록하고 Client ID/Secret을 발급받습니다.
//   2) 무료 서버리스(Cloudflare Worker 등)에 프록시를 배포하고, 그
//      서비스의 환경변수에 Client ID/Secret을 등록합니다.
//      (cloudflare-worker/local-search-proxy.js 참고)
//   3) config.js의 PLACE_SEARCH_PROXY_URL에 배포된 프록시 주소를 넣습니다.
//
// PLACE_SEARCH_PROXY_URL이 비어 있으면 이 모듈은 항상 빈 배열을 반환하고,
// 호출 측(map.js의 resolveLocation)은 기존 주소 지오코딩으로 자연스럽게
// 동작합니다. 즉, 프록시를 아직 설정하지 않아도 기존 기능은 그대로
// 작동합니다.
// ============================================================

function stripTags(html) {
  return (html || "").replace(/<[^>]*>/g, "");
}

async function searchPlace(query) {
  const proxyUrl = window.APP_CONFIG && window.APP_CONFIG.PLACE_SEARCH_PROXY_URL;
  if (!proxyUrl) return [];

  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  let res;
  try {
    res = await fetch(`${proxyUrl}?query=${encodeURIComponent(trimmed)}`);
  } catch (e) {
    console.warn("지역검색 프록시 호출 실패:", e);
    return [];
  }
  if (!res.ok) return [];

  let data;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  if (!data || !Array.isArray(data.items) || !data.items.length) return [];

  return data.items.map((item) => ({
    name: stripTags(item.title),
    address: item.roadAddress || item.address || "",
    category: item.category || "",
  }));
}

window.PlaceSearch = { searchPlace };
