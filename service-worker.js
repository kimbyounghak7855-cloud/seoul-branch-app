// 간단한 오프라인 캐싱 — 정적 파일을 캐시해 홈화면 설치 후에도 앱 셸이 빠르게 열리도록 함.
// Firestore/네이버 지도 실시간 데이터는 캐싱하지 않음(항상 네트워크 사용).
const CACHE_NAME = "sba-cache-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/store.js",
  "./js/auth.js",
  "./js/map.js",
  "./js/route.js",
  "./js/sheets-import.js",
  "./js/notifications.js",
  "./js/main.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  // 새 배포가 감지되면 기존 탭이 열려 있어도 즉시 새 서비스워커로 교체되도록 합니다.
  // (캐시 이름을 올릴 때마다 새 정적 파일을 강제로 다시 받아오기 위함)
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // cache.addAll()은 내부적으로 기본 fetch()를 사용해 브라우저 HTTP 캐시에 남아있는
        // 이전 배포의 응답을 그대로 가져올 수 있습니다. { cache: "reload" }로 각 자산을
        // 강제로 네트워크에서 새로 받아와 캐시에 저장합니다.
        Promise.all(
          ASSETS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => cache.put(url, res))
              .catch(() => {})
          )
        )
      )
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  // 외부 API(Google/Firebase) 요청은 캐시하지 않고 네트워크로 직행
  if (
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("map.naver.com") ||
    url.includes("pstatic.net")
  )
    return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
