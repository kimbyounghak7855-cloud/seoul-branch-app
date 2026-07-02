// ============================================================
// map.js — 네이버 지도(Naver Maps API v3) 지도, 마커, 지오코딩, 동선 표시
// index.html에 로드된 Naver Maps JS SDK(Client ID 포함)를 사용합니다.
// 지오코딩은 SDK에 포함된 geocoder 서브모듈(naver.maps.Service.geocode)을
// 사용하므로, Client Secret을 프론트엔드 코드에 노출하지 않습니다.
// ============================================================

const STATUS_COLORS = {
  발굴: "#9ca3af",
  접촉중: "#3b82f6",
  협의중: "#f59e0b",
  계약완료: "#22c55e",
  보류: "#ef4444",
  // 구글 시트("개원예정(메디잡)") 연동 병원의 진행현황
  영업중: "#06b6d4",
  타업체계약: "#7c3aed",
};

let map = null;
let markers = {}; // id -> naver.maps.Marker
let routeLayer = null;
let pinDropCallback = null;

function markerIconHtml(status) {
  const color = STATUS_COLORS[status] || "#6b7280";
  return `<div style="width:25px;height:33px;line-height:0;">
    <svg width="25" height="33" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#1f2937" stroke-width="1"/>
    </svg>
  </div>`;
}

function markerIcon(status) {
  return {
    content: markerIconHtml(status),
    size: new naver.maps.Size(25, 33),
    anchor: new naver.maps.Point(12, 32),
  };
}

function initMap() {
  // 네이버 지도 인증 실패(Web 서비스 URL 미등록 등) 시 SDK가 naver.maps를
  // 정상적으로 채우지 못해 이 시점에 naver.maps가 비어있을 수 있습니다.
  // 이 경우 그냥 진행하면 예외가 발생해 이후 모든 코드(로그인 화면 등)가
  // 같이 멈추므로, 여기서 막고 지도 영역에만 안내 메시지를 표시합니다.
  if (!window.naver || !naver.maps || !naver.maps.Map) {
    const fallback = document.getElementById("map-fallback");
    if (fallback) {
      fallback.hidden = false;
      if (!fallback.textContent.includes("인증")) {
        fallback.innerHTML =
          "<p>지도를 불러올 수 없습니다 (네이버 지도 인증 실패).<br/>아래 목록 보기로 지점을 확인하세요.</p>";
      }
    }
    document.dispatchEvent(new CustomEvent("map-ready", { detail: { ok: false } }));
    return;
  }

  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(
      window.APP_CONFIG.DEFAULT_CENTER.lat,
      window.APP_CONFIG.DEFAULT_CENTER.lng
    ),
    zoom: window.APP_CONFIG.DEFAULT_ZOOM,
    zoomControl: true,
    zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
  });

  naver.maps.Event.addListener(map, "click", (e) => {
    if (pinDropCallback) {
      pinDropCallback({ lat: e.coord.lat(), lng: e.coord.lng() });
    }
  });

  document.dispatchEvent(new CustomEvent("map-ready"));
}

function renderMarkers(branches, onMarkerClick) {
  if (!map) return;
  const seen = new Set();
  branches.forEach((b) => {
    if (b.lat == null || b.lng == null) return;
    seen.add(b.id);
    const position = new naver.maps.LatLng(b.lat, b.lng);
    if (markers[b.id]) {
      markers[b.id].setPosition(position);
      markers[b.id].setIcon(markerIcon(b.status));
    } else {
      const marker = new naver.maps.Marker({
        position,
        map,
        icon: markerIcon(b.status),
        title: b.name,
      });
      naver.maps.Event.addListener(marker, "click", () => onMarkerClick(b.id));
      markers[b.id] = marker;
    }
  });
  Object.keys(markers).forEach((id) => {
    if (!seen.has(id)) {
      markers[id].setMap(null);
      delete markers[id];
    }
  });
}

function focusBranch(id) {
  const marker = markers[id];
  if (marker && map) {
    map.morph(marker.getPosition(), 15);
  }
}

// 로그인 전에는 #app-screen이 display:none 상태라 지도 컨테이너 크기가 0입니다.
// 네이버 지도는 init 시점의 크기로 영역을 고정하므로, 로그인 후 화면이
// 보이게 되거나 창 크기가 바뀔 때 반드시 호출해야 지도가 일부만 표시되거나
// 마커 위치가 어긋나는 문제를 방지할 수 있습니다.
function invalidateSize() {
  if (map) map.refresh(true);
}

window.addEventListener("resize", () => {
  if (map) map.refresh(true);
});

function enablePinDrop(callback) {
  pinDropCallback = callback;
}
function disablePinDrop() {
  pinDropCallback = null;
}

// 네이버 지도 SDK의 geocoder 서브모듈 사용 — Client ID 기반 인증이라
// Client Secret을 코드에 넣지 않아도 됩니다.
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    // naver.maps 자체가 없거나(인증 실패로 SDK가 비활성 상태) Service
    // 서브모듈이 없는 경우 모두 여기서 안전하게 처리합니다. 이전에는
    // naver.maps가 null일 때 "naver.maps.Service"를 바로 평가해서
    // "null is not an object" 같은 원인 불명의 오류가 떴습니다.
    if (!window.naver || !naver.maps || !naver.maps.Service) {
      reject(new Error("지도 인증에 실패해 지오코딩을 사용할 수 없습니다. 관리자에게 네이버 클라우드 플랫폼 콘솔의 Web 서비스 URL 등록을 확인해 달라고 요청하세요."));
      return;
    }
    // 이미 광역 지역명(시/도)으로 시작하는 주소는 그대로 사용하고,
    // 그렇지 않은 경우에만 "서울"을 붙입니다. 예전에는 모든 주소에
    // 무조건 "서울"을 붙여서 "경기도 고양시..." 같은 비서울 주소가
    // "서울 경기도 고양시..."로 깨져 좌표 검색이 실패했습니다.
    const REGION_PREFIXES = [
      "서울", "경기", "인천", "강원", "충북", "충청북도", "충남", "충청남도",
      "대전", "세종", "전북", "전라북도", "전남", "전라남도", "광주", "대구",
      "경북", "경상북도", "경남", "경상남도", "부산", "울산", "제주",
    ];
    const trimmed = address.trim();
    const hasRegionPrefix = REGION_PREFIXES.some((p) => trimmed.startsWith(p));
    const query = hasRegionPrefix ? trimmed : `서울 ${trimmed}`;

    const tryGeocode = (q, allowFallback) => {
      naver.maps.Service.geocode({ query: q }, (status, response) => {
        if (status !== naver.maps.Service.Status.OK) {
          reject(new Error("주소 검색 서비스 오류"));
          return;
        }
        const result = response.v2;
        const found = result && result.meta && result.meta.totalCount && result.addresses.length;
        if (!found) {
          // "서울"을 붙여서 실패한 경우, 혹시 원래 주소 자체로는 검색되는지
          // 한 번 더 시도해봅니다 (예: 지역명이 목록에 없는 경우 등 예외 대비).
          if (allowFallback && q !== trimmed) {
            tryGeocode(trimmed, false);
            return;
          }
          reject(new Error("주소를 찾을 수 없습니다. 지도를 클릭해 직접 위치를 지정해 보세요."));
          return;
        }
        const item = result.addresses[0];
        resolve({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
      });
    };
    tryGeocode(query, true);
  });
}

// 상호명(업체명) 검색 → 주소 지오코딩으로 이어지는 통합 위치 검색.
// 1) PlaceSearch(네이버 지역검색 API, 프록시가 config.js에 설정된 경우)로
//    상호명 매칭을 먼저 시도합니다. 매칭되면 그 장소의 실제 도로명주소를
//    이미 검증된 geocodeAddress()로 다시 지오코딩해 좌표를 구합니다.
//    (지역검색 API가 주는 mapx/mapy는 KATEC 좌표계라 별도 변환이 필요해
//    오차 위험이 있으므로, 주소를 한 번 더 거쳐 안전하게 좌표를 구합니다.)
// 2) 매칭이 없거나 프록시가 설정되지 않은 경우 입력값을 주소로 보고 기존
//    geocodeAddress()로 폴백합니다. 따라서 프록시를 아직 설정하지 않아도
//    기존 주소 검색 동작은 그대로 유지됩니다.
async function resolveLocation(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) throw new Error("검색어를 입력해주세요.");

  if (window.PlaceSearch) {
    try {
      const places = await window.PlaceSearch.searchPlace(trimmed);
      if (places.length && places[0].address) {
        const coords = await geocodeAddress(places[0].address);
        return {
          ...coords,
          matchedName: places[0].name,
          matchedAddress: places[0].address,
        };
      }
    } catch (e) {
      console.warn("상호명 검색 실패, 주소 검색으로 대체합니다:", e);
    }
  }
  return geocodeAddress(trimmed);
}

function drawRoute(orderedBranches, origin, routeGeometry) {
  if (!map) return;
  if (routeLayer) {
    routeLayer.setMap(null);
    routeLayer = null;
  }
  let path;
  if (routeGeometry && routeGeometry.coordinates) {
    // OSRM geojson geometry: [ [lng, lat], ... ]
    path = routeGeometry.coordinates.map(
      ([lng, lat]) => new naver.maps.LatLng(lat, lng)
    );
  } else {
    path = [
      new naver.maps.LatLng(origin.lat, origin.lng),
      ...orderedBranches.map((b) => new naver.maps.LatLng(b.lat, b.lng)),
    ];
  }
  routeLayer = new naver.maps.Polyline({
    map,
    path,
    strokeColor: "#1d4ed8",
    strokeWeight: 4,
  });
  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((p) => bounds.extend(p));
  map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
}

function clearRoute() {
  if (routeLayer) {
    routeLayer.setMap(null);
    routeLayer = null;
  }
}

// 네이버 지도 SDK는 스크립트 로드 직후 동기적으로 사용 가능하므로 즉시 초기화합니다.
document.addEventListener("DOMContentLoaded", initMap);

window.MapModule = {
  renderMarkers,
  focusBranch,
  enablePinDrop,
  disablePinDrop,
  geocodeAddress,
  resolveLocation,
  drawRoute,
  clearRoute,
  invalidateSize,
  isReady: () => !!map,
};
