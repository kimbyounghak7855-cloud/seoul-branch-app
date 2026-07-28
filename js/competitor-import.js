// ============================================================
// competitor-import.js — "서울그린 영업 관련정리.xlsx" (경쟁사 계약처 명단)에서
// 추출한 정적 데이터(data/competitor-hospitals-seoul.json)를 가져와
// 지점 목록에 추가하는 기능.
//
// 이 데이터는 실시간 연동이 아니라, 특정 시점에 엑셀 파일에서 한 번 추출해
// 저장해둔 스냅샷입니다(사업자번호 기준, 없으면 병원명+주소 기준으로 중복 제거 완료).
// 최신화하려면 새 엑셀을 같은 방식으로 다시 추출해 이 JSON 파일을 교체해야 합니다.
// ============================================================

let cachedRecords = null;

async function fetchCompetitorHospitals() {
  if (cachedRecords) return cachedRecords;
  const res = await fetch("data/competitor-hospitals-seoul.json");
  if (!res.ok) throw new Error("경쟁사 거래처 데이터를 불러오지 못했습니다.");
  cachedRecords = await res.json();
  return cachedRecords;
}

// 재가져오기 시 이미 추가된 항목을 건너뛰기 위한 고유 키 (원본 데이터의 id 기준).
function competitorKey(record) {
  return "competitor:" + record.id;
}

window.CompetitorImport = {
  fetchCompetitorHospitals,
  competitorKey,
};
