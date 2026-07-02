# 서울지점 영업지도

서울지점 신규병원(의료폐기물 거래처) 영업 발굴을 위한 지도 기반 공유 앱입니다. 신규 발굴 지점을 지도에 등록하고, 개업예정일·요구사항을 팀과 실시간으로 공유하고, 오늘 방문할 지점들의 최적 동선을 추천받을 수 있습니다.

## 현재 상태: 데모 모드

`js/config.js`의 `FIREBASE_CONFIG`가 비어 있으면 앱은 자동으로 **데모 모드**로 동작합니다.

- 데이터는 브라우저의 localStorage에만 저장됩니다 (팀원 간 공유되지 않음, 기기/브라우저 변경 시 사라짐).
- 지도는 **네이버 지도 API**(Naver Cloud Platform Maps)를 사용하며, Client ID가 `index.html`에 이미 등록되어 있어 별도 설정 없이 항상 정상적으로 표시됩니다.
- 로그인은 가입한 브라우저에만 저장되는 간이 계정입니다. **첫 가입자가 자동으로 admin 권한**을 받습니다.

UI/흐름을 바로 체험해보려면 `index.html`을 더블클릭해서 열거나, 아래처럼 간단한 로컬 서버로 실행하세요.

```bash
cd seoul-branch-app
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

(파일을 더블클릭(file://)으로 열면 일부 브라우저에서 모듈 스크립트가 차단될 수 있어, 로컬 서버 실행을 권장합니다.)

## 실 운영 전환: Firebase 키 연결하기

### 지도/지오코딩: 네이버 지도 API (등록 완료, 추가 설정 불필요)

- **지도 표시 + 주소 → 좌표 검색("좌표 찾기")**: [네이버 지도 API v3](https://navermaps.github.io/maps.js.ncp/) (Naver Cloud Platform Maps). `index.html`의 `<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=...">`에 Client ID가 등록되어 있습니다.
  - NCP 콘솔(console.ncloud.com) > Maps > Application에 `seoul-branch-app`으로 등록되어 있으며, 대표 계정(kbh1443@naver.com) 기준 무료 이용량(Geocoding/Reverse Geocoding 각 300만 회/월, Dynamic Map 600만 회/월)이 적용됩니다.
  - Web 서비스 URL이 Application에 등록된 도메인과 다르면 인증 실패(401)가 발생하므로, 배포 도메인이 바뀌면 NCP 콘솔(console.ncloud.com > Maps > Application 수정)에서 Web 서비스 URL에 새 도메인을 추가해야 합니다.
  - **현재 GitHub Pages 배포 도메인(`https://kimbyounghak7855-cloud.github.io`)이 Application에 등록되어 있지 않으면 지도/지오코딩이 인증 실패로 동작하지 않습니다.** 예전 Netlify 도메인에서 GitHub Pages로 옮긴 뒤 이 등록을 갱신하지 않은 것이 흔한 원인입니다. 등록되지 않은 경우 지도 영역에 인증 실패 안내가 표시됩니다(`index.html`의 `navermap_authFailure` 콜백).
- **동선 최적화**: [OSRM](http://project-osrm.org/) 공개 데모 서버의 Trip API로 도로 기반 최적 순서를 계산합니다. 데모 서버는 무료이지만 공용 자원이라 응답이 느리거나 일시적으로 실패할 수 있으며, 이 경우 자동으로 직선거리 기준 최근접 이웃 휴리스틱으로 대체됩니다.
- 트래픽이 매우 많아지면(예: 팀이 커지거나 매우 빈번한 동선 계산) [OSRM](http://project-osrm.org/#results) 사용 정책을 검토해, 필요시 자체 서버를 구축하는 것을 권장합니다.

### 상호명(업체명) 검색 — 네이버 지역검색 API (선택 사항)

기본적으로 "좌표 찾기"와 출발지 입력은 **주소**만 검색됩니다(네이버 지도 SDK의 한계). "한국의료환경"처럼 **상호명만으로** 검색하려면 별도의 네이버 "지역검색" Open API 연동이 필요하며, 아래 단계는 직접(본인 계정으로) 진행해야 합니다. 설정하지 않아도 기존 주소 검색 기능은 그대로 동작합니다.

1. **네이버 개발자센터에서 앱 등록 (본인 계정으로 직접)**
   - https://developers.naver.com/apps/#/register 접속 → 로그인 (대표 계정 kbh1443@naver.com 권장)
   - 애플리케이션 이름 입력 (예: "서울지점 영업지도 검색")
   - 사용 API에서 **"검색"** 체크
   - 비로그인 오픈 API 서비스 환경으로 등록 (웹 서비스 URL에 `https://kimbyounghak7855-cloud.github.io` 입력)
   - 등록 완료 후 발급된 **Client ID / Client Secret**을 확인 (다음 단계에서 필요)
2. **Cloudflare Worker에 CORS 프록시 배포 (본인 계정으로 직접)**
   - 이 API는 브라우저에서 직접 호출하면 CORS로 차단되고 Client Secret이 노출되므로, 중간 서버(프록시) 하나가 필요합니다. 무료인 Cloudflare Workers를 사용합니다.
   - `cloudflare-worker/local-search-proxy.js` 파일 안에 상세 배포 절차가 코드 주석으로 적혀 있습니다. 요약:
     1. https://dash.cloudflare.com 무료 가입/로그인
     2. Workers & Pages > Create > Create Worker로 생성
     3. Edit code에서 `local-search-proxy.js` 내용 전체를 붙여넣고 Deploy
     4. Worker > Settings > Variables and Secrets에서 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 1번 단계에서 받은 값으로 등록 (Secret 타입 권장)
     5. 생성된 Worker 주소(예: `https://seoul-branch-place-search.본인계정.workers.dev`) 복사
   - **주의**: Client ID/Secret은 코드에 직접 적지 말고, 반드시 Cloudflare의 환경변수(Variables and Secrets)로만 등록하세요. 저는 비밀번호·API 키 같은 자격 정보를 대신 입력해드릴 수 없으므로, 이 등록은 직접 진행해주세요.
3. **앱에 프록시 주소 연결**
   - `js/config.js`의 `PLACE_SEARCH_PROXY_URL`에 2번에서 복사한 Worker 주소를 붙여넣으면 바로 적용됩니다. (이 부분은 알려주시면 제가 반영해서 재배포해 드릴 수 있습니다.)
   - 설정 후에는 "출발지" 입력란과 지점 "주소" 입력란 모두에서 상호명 검색이 먼저 시도되고, 매칭되는 업체가 없으면 기존 주소 검색으로 자동 전환됩니다.

### 지점 "요구사항/메모" → 구글시트 "비고" 자동 반영 (선택 사항)

구글 스프레드시트 연동으로 가져온 병원(지점 정보 수정 화면에 "시트 정보" 패널이 보이는 병원)은, 지점 수정 화면의 "요구사항/메모"를 저장할 때 시트의 "비고"(M열)에도 같은 내용이 자동으로 기록되도록 설정할 수 있습니다. 시트 읽기(gviz)와 달리 쓰기는 인증이 필요해 아래 단계는 직접(본인 계정으로) 진행해야 합니다. 설정하지 않아도 앱 내 저장/공유 기능은 그대로 동작하며, 시트에만 반영되지 않습니다.

1. **Google Apps Script 배포 (시트 편집 권한이 있는 계정으로 직접)**
   - `google-apps-script/update-remarks.gs` 파일 안에 상세 배포 절차가 코드 주석으로 적혀 있습니다. 요약:
     1. https://script.google.com 에서 새 프로젝트 생성
     2. 기본 코드를 지우고 `update-remarks.gs` 내용 전체를 붙여넣기
     3. 배포 > 새 배포 > 유형: 웹 앱, 실행 계정: 나, 액세스 권한: 전체 → 배포
     4. 처음 배포 시 뜨는 권한 승인 화면을 본인 계정으로 승인
     5. 발급된 웹앱 주소(예: `https://script.google.com/macros/s/xxx/exec`) 복사
   - **주의**: 이 웹앱은 배포한 계정의 권한으로 시트에 값을 쓰므로, 반드시 시트에 대한 편집 권한이 있는 계정으로 배포하세요.
2. **앱에 웹앱 주소 연결**
   - `js/config.js`의 `SHEET_WRITE_PROXY_URL`에 1번에서 복사한 웹앱 주소를 붙여넣으면 바로 적용됩니다. (이 부분은 알려주시면 제가 반영해서 재배포해 드릴 수 있습니다.)
   - 설정 후에는 시트에서 가져온 병원의 "요구사항/메모"를 수정하고 저장할 때마다 시트의 해당 행(순번+상호로 매칭) "비고"에 자동 반영됩니다. 매칭되는 행을 찾지 못하거나 네트워크 오류가 있어도 앱 내 저장에는 영향을 주지 않고, 콘솔에 경고만 남습니다.
   - 시트에서 가져오지 않고 앱에서 직접 추가한 지점은 대응하는 시트 행이 없어 반영되지 않습니다.

### Firebase (실시간 공유 + 로그인)

1. https://console.firebase.google.com 에서 새 프로젝트 생성
2. "Firestore Database" 메뉴에서 데이터베이스 생성 (시작은 테스트 모드 가능)
3. "Authentication" 메뉴에서 "이메일/비밀번호" 로그인 방식 활성화
4. "프로젝트 설정 > 일반 > 내 앱"에서 웹 앱 추가 후 `firebaseConfig` 값 복사
5. `js/config.js`의 `FIREBASE_CONFIG`에 그대로 붙여넣기

Firebase 키를 입력하면 데모 배너가 사라지고, 모든 팀원이 같은 데이터를 실시간으로 보게 됩니다. (지도 기능은 키 입력 여부와 무관하게 항상 동일하게 동작합니다.)

### Firestore 보안 규칙 (운영 전 필수)

테스트 모드는 누구나 읽고 쓸 수 있어 운영에 부적합합니다. Firestore "규칙" 탭에서 아래와 같이 로그인한 사용자만 접근하도록 설정하세요.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /branches/{branchId} {
      allow read, write: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

(admin이 다른 사용자의 role을 변경하는 기능까지 엄격히 막으려면, Cloud Functions로 권한 변경을 처리하는 것을 권장합니다. 소규모 팀이라면 위 규칙으로도 충분합니다.)

## 주요 기능

- **지점 등록/관리**: 병원명, 주소(지오코딩 또는 지도 클릭으로 좌표 지정), 상태(영업중/계약완료/타업체계약 + 발굴/접촉중/협의중/보류), 우선순위, 개업예정일, 계약시작일, 담당자, 요구사항 메모
- **지도 표시**: 상태별 색상 마커, 클릭 시 상세정보/수정
- **구글 스프레드시트 연동**: 사이드바 "시트 동기화" 클릭 시 "개원예정(메디잡)" 시트의 서울지점 병원을 읽어와 지도/목록에 추가 (아래 별도 섹션 참고)
- **최적 동선 추천**: 방문할 지점 체크 후 "동선 최적화" 클릭 → OSRM으로 도로 기반 최적 순서 계산 (서버 응답 실패 시 직선거리 기준으로 자동 대체)
- **실시간 공유**: Firestore 기반, 팀원 전원이 동시에 보고 수정 가능
- **권한 관리**: 최초 가입자가 admin, 이후 가입자는 member(가입 즉시 바로 사용 가능, 별도 승인 절차 없음). admin은 사이드바 "사용자 권한 관리" 패널에서 다른 사용자의 권한 변경 및 **탈퇴(추방) 처리**가 가능 (본인 계정은 탈퇴 버튼이 비활성화됩니다)
- **알림**: 개업예정일이 임박(기본 14일 이내)한 지점을 사이드바 상단에 자동 표시, 브라우저 알림 권한 허용 시 데스크톱 알림도 지원
- **모바일 설치(PWA)**: 모바일 브라우저에서 "홈 화면에 추가"로 설치해 앱처럼 사용 가능, 반응형 레이아웃 적용

## 구글 스프레드시트 연동 (개원예정 병원 가져오기)

사이드바의 **"시트 동기화"** 버튼을 누르면 아래 시트에서 서울지점 병원 목록을 읽어와 새로운 병원만 지도/목록에 추가합니다.

- 대상 시트: [서울지점 영업 스프레드시트](https://docs.google.com/spreadsheets/d/1hoRNH8ZF2H7lT1eHco7EbwyDtRkBmaQapXstzDlzilQ/edit) 의 **"개원예정(메디잡)"** 탭
- 조회 방식: API 키/로그인 없이 구글 시트의 `gviz` 조회 기능(JSONP)으로 읽기만 합니다. 시트가 **"링크가 있는 모든 사용자에게 보기 권한"**으로 공유되어 있어야 정상 동작합니다.
- 지점(서울/경기 등) 컬럼이 `서울`인 행만 가져오며, 진행현황 컬럼 값을 다음과 같이 매핑합니다: 비어있음/기타 → **영업중**, `계약완료` → **계약완료**, `타업체계약` → **타업체계약**.
- 지역(간이 분류)·연락처·확인일자·유입경로·개원예정월·담당영업사원·비고까지 시트의 모든 컬럼을 가져와 지점 상세(수정 모달)에서 읽기 전용으로 표시됩니다.
- **계약시작일**은 시트에 없는 항목으로, 앱에서 직접 입력/관리하는 필드입니다.
- 지점 목록은 **개원 예정 월** 기준으로 그룹(예: "2025-08 개원예정")을 묶어 보여줍니다. 직접 입력한 지점은 개업 예정일의 연-월을 사용하며, 월 정보가 없으면 "개원월 미정" 그룹으로 분류됩니다.

### 동기화 정책 (중요)

- 동기화는 **신규 병원만 추가**합니다. 이미 가져온 병원(상호+순번 기준 식별)은 건너뛰며, 시트 내용이 바뀌어도 이미 등록된 항목을 자동으로 덮어쓰지 않습니다.
- 따라서 앱에서 직접 입력한 계약시작일/요구사항/담당자 등은 재동기화로 사라지지 않습니다.
- 시트 쪽 상태(진행현황)가 바뀌었는데 앱에 반영하고 싶다면, 해당 병원을 앱에서 직접 열어 상태를 수동으로 수정하세요.
- 주소는 시트의 "지역(시/군/구)" 컬럼을 사용합니다. 입력 시기에 따라 구 단위(예: "관악구")만 있는 경우와 전체 도로명주소가 있는 경우가 섞여 있어, 구 단위만 있는 항목은 지오코딩 시 해당 구의 대략적인 중심 좌표로 잡힙니다. 더 정확한 위치가 필요하면 지점을 열어 주소를 보완한 뒤 "좌표 찾기"를 다시 누르세요.
- 시트의 주소가 불완전하거나 네이버 지도 지오코딩이 좌표를 찾지 못하면 좌표 없이 병원 정보만 추가됩니다 — 목록에 "⚠ 좌표 미확인"으로 표시되며, 지점을 열어 주소를 보완한 뒤 "좌표 찾기"를 다시 누르거나 지도를 클릭해 직접 위치를 지정할 수 있습니다.
- 시트 ID/탭이 변경되면 `js/sheets-import.js` 상단의 `SHEET_ID`, `GID`, `QUERY` 값을 수정하세요.

## 관리자: 사용자 탈퇴(추방) 처리

사이드바 "사용자 권한 관리" 패널에서 각 사용자 옆의 **탈퇴** 버튼으로 언제든 계정을 추방할 수 있습니다.

- **데모 모드**: 탈퇴 처리 즉시 로그인 자격(`sba_accounts`)과 권한 정보(`sba_users`)가 모두 삭제되어, 해당 계정은 더 이상 로그인할 수 없습니다. 만약 탈퇴 대상이 현재 다른 화면에서 로그인 중이라면, 다음 데이터 갱신 시점에 자동으로 로그아웃됩니다.
- **Firebase 모드(주의)**: 클라이언트 SDK는 다른 사용자의 Firebase Auth 계정을 직접 삭제할 수 없습니다(Admin SDK/Cloud Functions 필요). 대신 탈퇴 처리 시 Firestore의 `users/{uid}` 문서를 삭제해 **앱 접근 자체를 차단**합니다 — 권한 문서가 없는 사용자는 로그인 직후 자동 로그아웃됩니다. 다만 Firebase Auth 계정 자체(이메일/비밀번호 로그인 정보)는 남아있으므로, 완전히 계정을 없애려면 Firebase 콘솔의 Authentication 메뉴에서 해당 사용자를 별도로 삭제하거나 Cloud Function을 구성하세요.

## 설정값 변경

`js/config.js`에서 아래 값도 조정할 수 있습니다.

- `DEFAULT_CENTER` / `DEFAULT_ZOOM`: 지도 초기 위치 (기본: 서울시청), 동선 계산 시 "출발지"로도 사용됨
- `UPCOMING_DAYS_THRESHOLD`: 개업예정일 알림 기준일

## 배포

정적 파일이므로 Firebase Hosting, Netlify, Vercel, 사내 웹서버 등 어디든 올리면 됩니다. Firebase를 이미 쓴다면:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public 디렉터리를 seoul-branch-app으로 지정
firebase deploy
```

## 폴더 구조

```
seoul-branch-app/
├── index.html
├── manifest.json
├── service-worker.js
├── css/style.css
├── js/
│   ├── config.js      # Firebase 키 / 기본 설정
│   ├── store.js       # 데이터 레이어 (Firestore ↔ localStorage 폴백)
│   ├── auth.js        # 로그인/가입/권한
│   ├── map.js          # 네이버 지도 API v3 지도, 마커, 지오코딩
│   ├── route.js        # 동선 최적화 (OSRM ↔ 직선거리 폴백)
│   ├── sheets-import.js # 구글 스프레드시트("개원예정(메디잡)") 연동
│   ├── place-search.js  # 네이버 지역검색(상호명 검색) API 연동 (프록시 필요)
│   ├── notifications.js # 개업예정일 알림
│   └── main.js          # 화면 흐름 및 이벤트 연결
├── cloudflare-worker/
│   └── local-search-proxy.js # 지역검색 API CORS 프록시 (Cloudflare Workers에 배포)
├── google-apps-script/
│   └── update-remarks.gs # "요구사항/메모" → 시트 "비고" 자동 반영 웹앱 (Apps Script에 배포)
└── icons/
```
