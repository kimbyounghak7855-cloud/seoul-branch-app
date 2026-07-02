// ============================================================
// local-search-proxy.js — 네이버 지역검색(Local Search) API용 CORS 프록시
//
// 이 파일은 Cloudflare Workers에 그대로 붙여넣는 용도입니다.
// 별도 빌드 과정이 필요 없습니다.
//
// [배포 방법]
// 1) https://dash.cloudflare.com 에서 무료 계정으로 로그인(또는 가입)
// 2) 좌측 메뉴 Workers & Pages > Create > Create Worker
// 3) 이름을 정하고(예: seoul-branch-place-search) Deploy
// 4) 생성된 Worker > Edit code(Quick edit) 들어가서 기존 코드를 모두
//    지우고 이 파일의 내용 전체를 붙여넣은 뒤 Deploy
// 5) Worker > Settings > Variables and Secrets 에서 아래 2개를 추가:
//      NAVER_CLIENT_ID     = (developers.naver.com에서 발급받은 Client ID)
//      NAVER_CLIENT_SECRET = (developers.naver.com에서 발급받은 Client Secret)
//    "Secret" 타입으로 등록하면 화면에 값이 노출되지 않습니다.
// 6) Worker의 주소(예: https://seoul-branch-place-search.본인계정.workers.dev)를
//    복사해서 앱의 js/config.js 의 PLACE_SEARCH_PROXY_URL 에 붙여넣으면 됩니다.
//
// Client ID/Secret은 이 파일에 직접 적지 마세요. 반드시 위 5번처럼
// Cloudflare의 환경변수(Variables and Secrets)로만 등록해야 안전합니다.
// ============================================================

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("query");
    if (!query) {
      return new Response(JSON.stringify({ error: "query 파라미터가 필요합니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const apiUrl =
      "https://openapi.naver.com/v1/search/local.json?query=" +
      encodeURIComponent(query) +
      "&display=5&sort=random";

    let naverRes;
    try {
      naverRes = await fetch(apiUrl, {
        headers: {
          "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "네이버 API 호출 실패: " + e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const body = await naverRes.text();
    return new Response(body, {
      status: naverRes.status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  },
};
