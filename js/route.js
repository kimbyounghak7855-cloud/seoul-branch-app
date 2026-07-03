// ============================================================
// route.js — 최적 동선 계산
// OSRM(Open Source Routing Machine) 공개 데모 서버의 Trip API로
// 도로 기반 최적 순서를 계산하고, 실패 시 직선거리(haversine) 기준
// 최근접 이웃(Nearest Neighbor) 휴리스틱으로 대체합니다.
// 키/결제 등록이 필요 없는 무료 서비스입니다.
// ============================================================

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 직선거리 기반 최근접 이웃 정렬 (OSRM 실패 시 폴백)
function nearestNeighborOrder(origin, points) {
  const remaining = [...points];
  const ordered = [];
  let current = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push({ ...next, legDistanceKm: bestDist });
    current = next;
  }
  return ordered;
}

// origin이 없으면(고정 출발지 미사용) 등록된 지점들만으로 가장 효율적인
// 경로(어디서 출발하든 총 이동거리가 가장 짧은 경로)를 계산합니다.
async function computeOptimalRoute(origin, branches) {
  if (!branches.length) return { ordered: [], totalDistanceKm: 0, mode: "none" };

  try {
    return await computeWithOSRM(origin, branches);
  } catch (e) {
    console.warn("OSRM 동선 계산 실패, 직선거리 폴백 사용:", e);
  }

  if (origin) {
    const ordered = nearestNeighborOrder(origin, branches);
    const totalDistanceKm = ordered.reduce((sum, p) => sum + p.legDistanceKm, 0);
    return { ordered, totalDistanceKm, mode: "straight-line" };
  }

  // 고정 출발지가 없는 폴백: 등록된 지점 중 첫 번째를 임시 시작점으로 삼아
  // 나머지를 최근접 이웃 순서로 정렬합니다(완전한 최적해는 아니지만 합리적인 대체).
  const [first, ...rest] = branches;
  const restOrdered = nearestNeighborOrder(first, rest);
  const ordered = [{ ...first, legDistanceKm: 0 }, ...restOrdered];
  const totalDistanceKm = ordered.reduce((sum, p) => sum + p.legDistanceKm, 0);
  return { ordered, totalDistanceKm, mode: "straight-line" };
}

async function computeWithOSRM(origin, branches) {
  // origin이 있으면 "source=first"로 출발지를 고정하고, 없으면 소스/목적지를
  // 지정하지 않아(기본값 any/any) OSRM이 등록 지점들만으로 가장 효율적인
  // 시작점과 순서를 스스로 찾도록 합니다.
  const points = origin ? [origin, ...branches] : branches;
  const coordsStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const params = origin ? "source=first&roundtrip=false" : "roundtrip=false";
  const url =
    `https://router.project-osrm.org/trip/v1/driving/${coordsStr}` +
    `?${params}&geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM 요청 실패: " + res.status);
  const data = await res.json();
  if (data.code !== "Ok" || !data.trips || !data.trips[0]) {
    throw new Error("OSRM 응답 오류: " + data.code);
  }

  const trip = data.trips[0];
  // origin이 있으면 waypoints[0]은 출발지이고 waypoints[1..]가 branches와 대응되며,
  // origin이 없으면 waypoints가 branches와 그대로 1:1 대응됩니다.
  const branchWaypoints = origin ? data.waypoints.slice(1) : data.waypoints;
  const order = branchWaypoints
    .map((wp, i) => ({ i, waypointIndex: wp.waypoint_index }))
    .sort((a, b) => a.waypointIndex - b.waypointIndex);
  const ordered = order.map(({ i }) => branches[i]);

  return {
    ordered,
    totalDistanceKm: trip.distance / 1000,
    totalDurationMin: Math.round(trip.duration / 60),
    routeGeometry: trip.geometry,
    mode: "osrm",
  };
}

window.RouteEngine = { computeOptimalRoute, haversineKm };
