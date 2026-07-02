// ============================================================
// main.js — 화면 흐름 및 UI 이벤트 연결
// ============================================================

let currentUser = null; // {uid/id, name, email, role}
let allBranches = [];
let selectedBranchIds = new Set();
let pinDropTarget = null; // 모달 열려있는 동안 지도 클릭 좌표 저장용
let lastGeocodedAddress = null; // 현재 pinDropTarget이 어떤 주소 기준으로 설정됐는지 추적 (주소 변경 시 자동 재검색용)

const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

function showDemoBanners() {
  if (window.APP_CONFIG.IS_DEMO_MODE) {
    $("#demo-banner").hidden = false;
    $("#demo-banner-app").hidden = false;
  }
}

// ---------- 인증 화면 ----------

function initAuthScreen() {
  const loginForm = $("#login-form");
  const signupForm = $("#signup-form");
  const toggleLink = $("#toggle-auth-mode");
  const errorEl = $("#auth-error");

  toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    const showingLogin = !loginForm.hidden;
    loginForm.hidden = showingLogin;
    signupForm.hidden = !showingLogin;
    toggleLink.textContent = showingLogin
      ? "이미 계정이 있으신가요? 로그인"
      : "계정이 없으신가요? 가입하기";
    errorEl.hidden = true;
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    try {
      await window.Auth.logIn($("#login-email").value, $("#login-password").value);
      if (window.Auth.isDemo) enterApp(window.Auth.getSession());
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    try {
      const account = await window.Auth.signUp(
        $("#signup-name").value,
        $("#signup-email").value,
        $("#signup-password").value
      );
      if (window.Auth.isDemo) enterApp(account);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

function enterApp(user) {
  if (user.role === "pending") {
    alert("관리자 승인 대기 중입니다. 관리자가 가입을 승인하면 이용할 수 있습니다.");
    window.Auth.logOut();
    return;
  }
  currentUser = user;
  $("#auth-screen").hidden = true;
  $("#app-screen").hidden = false;
  $("#current-user-label").textContent = `${user.name || user.email} (${user.role || "member"})`;
  $("#admin-panel").hidden = user.role !== "admin";
  // 로그인 전에는 지도 컨테이너가 display:none 상태였기 때문에 네이버 지도가
  // 0 크기로 초기화되어 있습니다. 화면이 보이게 된 직후(레이아웃 반영 후)
  // 강제로 리사이즈를 트리거해 지도가 일부만 표시되는 문제를 방지합니다.
  requestAnimationFrame(() => {
    if (window.MapModule && window.MapModule.isReady()) window.MapModule.invalidateSize();
  });
  window.Notifications.maybeRequestBrowserNotificationPermission();
  subscribeToData();
  // 관리자 여부와 무관하게 항상 구독합니다. 관리자가 다른 기기/창에서
  // 나(또는 다른 사용자)를 탈퇴시키면 실시간으로 감지해 즉시 로그아웃시키기 위함입니다.
  subscribeToUsers();
}

function exitApp() {
  currentUser = null;
  $("#app-screen").hidden = true;
  $("#auth-screen").hidden = false;
}

// ---------- 데이터 구독 ----------

async function subscribeToData() {
  await window.Store.onBranchesChange((branches) => {
    allBranches = branches;
    refreshAssigneeFilterOptions(branches);
    renderAll();
  });
}

async function subscribeToUsers() {
  await window.Store.onUsersChange((users) => {
    checkSelfStillActive(users);
    renderUserList(users);
  });
}

// 관리자가 나를 탈퇴시켰는지 실시간 감지 — 내 계정이 사용자 목록에서
// 사라졌다면 즉시 로그아웃 처리합니다.
function checkSelfStillActive(users) {
  if (!currentUser) return;
  const stillThere = users.some((u) => u.id === currentUser.uid || u.id === currentUser.id);
  if (!stillThere) {
    alert("관리자에 의해 계정이 탈퇴 처리되었습니다.");
    window.Auth.logOut();
    exitApp();
  }
}

function renderUserList(users) {
  const ul = $("#user-list");
  ul.innerHTML = "";
  const myId = currentUser ? (currentUser.uid || currentUser.id) : null;
  const pendingUsers = users.filter((u) => u.role === "pending");
  const otherUsers = users.filter((u) => u.role !== "pending");

  pendingUsers.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${u.name || u.email} <small>${u.email || ""}</small> <span class="badge badge-orange">승인 대기</span></span>
      <div class="user-actions">
        <button type="button" class="btn-small btn-primary approve-user-btn" data-uid="${u.id}">승인</button>
        <button type="button" class="btn-small btn-danger reject-user-btn" data-uid="${u.id}" data-name="${u.name || u.email || ""}">거부</button>
      </div>
    `;
    ul.appendChild(li);
  });

  otherUsers.forEach((u) => {
    const li = document.createElement("li");
    const isSelf = u.id === myId;
    li.innerHTML = `
      <span>${u.name || u.email} <small>${u.email || ""}</small></span>
      <div class="user-actions">
        <select data-uid="${u.id}" class="role-select">
          <option value="member" ${u.role === "member" ? "selected" : ""}>member</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
        <button type="button" class="btn-small btn-danger remove-user-btn" data-uid="${u.id}" data-name="${u.name || u.email || ""}" ${isSelf ? "disabled title=\"본인 계정은 여기서 탈퇴시킬 수 없습니다\"" : ""}>탈퇴</button>
      </div>
    `;
    ul.appendChild(li);
  });

  $all(".role-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      await window.Store.upsertUser(sel.dataset.uid, { role: sel.value });
    });
  });
  $all(".remove-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const name = btn.dataset.name;
      if (!confirm(`${name} 님을 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
      const uid = btn.dataset.uid;
      await window.Store.deleteUser(uid);
      await window.Auth.deleteAccount(uid);
    });
  });
  $all(".approve-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.Store.upsertUser(btn.dataset.uid, { role: "member" });
    });
  });
  $all(".reject-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const name = btn.dataset.name;
      if (!confirm(`${name} 님의 가입 신청을 거부하시겠습니까? 계정이 삭제됩니다.`)) return;
      const uid = btn.dataset.uid;
      await window.Store.deleteUser(uid);
      await window.Auth.deleteAccount(uid);
    });
  });
}

// ---------- 필터 ----------

function refreshAssigneeFilterOptions(branches) {
  const sel = $("#filter-assignee");
  const current = sel.value;
  const names = Array.from(new Set(branches.map((b) => b.assignee).filter(Boolean))).sort();
  sel.innerHTML = '<option value="">전체</option>' + names.map((n) => `<option value="${n}">${n}</option>`).join("");
  sel.value = current;
}

function getFilteredBranches() {
  const status = $("#filter-status").value;
  const priority = $("#filter-priority").value;
  const assignee = $("#filter-assignee").value;
  return allBranches.filter(
    (b) =>
      (!status || b.status === status) &&
      (!priority || b.priority === priority) &&
      (!assignee || b.assignee === assignee)
  );
}

["filter-status", "filter-priority", "filter-assignee"].forEach((id) => {
  document.addEventListener("DOMContentLoaded", () => {
    $("#" + id).addEventListener("change", renderAll);
  });
});

// ---------- 렌더링 ----------

function renderAll() {
  const filtered = getFilteredBranches();
  renderBranchList(filtered);
  renderUpcoming(allBranches);
  if (window.MapModule.isReady()) {
    window.MapModule.renderMarkers(filtered, openEditModal);
  }
  $("#branch-count").textContent = filtered.length;
}

function statusBadgeClass(status) {
  const map = {
    발굴: "gray",
    접촉중: "blue",
    협의중: "orange",
    계약완료: "green",
    보류: "red",
    영업중: "cyan",
    타업체계약: "purple",
  };
  return "badge badge-" + (map[status] || "gray");
}

// 지점을 "개원 예정 월" 기준으로 그룹화하기 위한 키 (YYYY-MM 형식).
// 구글 시트에서 가져온 지점은 sheetExpectedOpenMonth를, 직접 입력한 지점은
// 개업 예정일(openDate)의 연-월을 사용합니다. 둘 다 없으면 맨 뒤로 보냅니다.
function branchGroupKey(b) {
  if (b.sheetExpectedOpenMonth) return b.sheetExpectedOpenMonth;
  if (b.openDate) return b.openDate.slice(0, 7);
  return "9999-99";
}

function branchGroupLabel(key) {
  return key === "9999-99" ? "개원월 미정" : `${key} 개원예정`;
}

function renderBranchList(branches) {
  const ul = $("#branch-list");
  ul.innerHTML = "";

  const groups = new Map();
  branches.forEach((b) => {
    const key = branchGroupKey(b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  });
  const sortedKeys = Array.from(groups.keys()).sort();

  sortedKeys.forEach((key) => {
    const groupBranches = groups.get(key);
    const header = document.createElement("li");
    header.className = "branch-group-header";
    header.textContent = `${branchGroupLabel(key)} (${groupBranches.length})`;
    ul.appendChild(header);

    groupBranches.forEach((b) => {
      const li = document.createElement("li");
      li.className = "branch-item";
      const checked = selectedBranchIds.has(b.id) ? "checked" : "";
      li.innerHTML = `
        <label class="branch-item-row">
          <input type="checkbox" class="select-branch" data-id="${b.id}" ${checked} />
          <span class="${statusBadgeClass(b.status)}">${b.status}</span>
          <span class="branch-name">${b.name}</span>
        </label>
        <div class="branch-meta">
          <span>${b.address || ""}</span>
          ${b.openDate ? `<span>개업 ${b.openDate}</span>` : ""}
          ${b.contractStartDate ? `<span>계약시작 ${b.contractStartDate}</span>` : ""}
          ${b.assignee ? `<span>담당 ${b.assignee}</span>` : ""}
          ${b.lat == null ? `<span class="needs-geocode-icon">⚠ 좌표 미확인</span>` : ""}
        </div>
      `;
      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("select-branch")) return;
        openEditModal(b.id);
      });
      li.querySelector(".select-branch").addEventListener("change", (e) => {
        if (e.target.checked) {
          selectedBranchIds.add(b.id);
          // 체크하면 해당 지점 좌표로 지도를 이동시켜 위치를 바로 확인할 수 있게 합니다.
          if (b.lat != null && b.lng != null) {
            window.MapModule.focusBranch(b.id);
          }
        } else {
          selectedBranchIds.delete(b.id);
        }
      });
      ul.appendChild(li);
    });
  });
}

function renderUpcoming(branches) {
  const ul = $("#upcoming-list");
  const upcoming = window.Notifications.getUpcomingBranches(branches);
  ul.innerHTML = "";
  if (!upcoming.length) {
    ul.innerHTML = `<li class="empty">예정된 개업일이 없습니다.</li>`;
    return;
  }
  upcoming.forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${b.name}</strong> — D-${b.daysLeft} (${b.openDate})`;
    li.addEventListener("click", () => {
      window.MapModule.focusBranch(b.id);
      openEditModal(b.id);
    });
    ul.appendChild(li);
  });
}

// ---------- 지점 추가/수정 모달 ----------

// 모달을 열 때마다 이전에 드래그/리사이즈한 크기·위치를 초기화해
// 화면 중앙의 기본 크기로 돌아오도록 합니다.
function resetModalBoxLayout() {
  const box = $("#branch-modal .modal-box");
  box.style.position = "";
  box.style.left = "";
  box.style.top = "";
  box.style.margin = "";
  box.style.width = "";
  box.style.height = "";
}

function openAddModal() {
  resetModalBoxLayout();
  $("#branch-modal-title").textContent = "신규 지점 추가";
  $("#branch-form").reset();
  $("#branch-id").value = "";
  $("#branch-coords").textContent = "좌표 미설정";
  $("#delete-branch-btn").hidden = true;
  $("#branch-sheet-info").hidden = true;
  pinDropTarget = null;
  lastGeocodedAddress = null;
  $("#branch-modal").hidden = false;
  window.MapModule.enablePinDrop((coords) => {
    pinDropTarget = coords;
    lastGeocodedAddress = $("#branch-address").value.trim();
    $("#branch-coords").textContent = `좌표 설정됨 (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
  });
}

function openEditModal(id) {
  const b = allBranches.find((x) => x.id === id);
  if (!b) return;
  resetModalBoxLayout();
  $("#branch-modal-title").textContent = "지점 정보 수정";
  $("#branch-id").value = b.id;
  $("#branch-name").value = b.name || "";
  $("#branch-address").value = b.address || "";
  $("#branch-status").value = b.status || "발굴";
  $("#branch-priority").value = b.priority || "중";
  $("#branch-open-date").value = b.openDate || "";
  $("#branch-contract-start-date").value = b.contractStartDate || "";
  $("#branch-assignee").value = b.assignee || "";
  $("#branch-requirements").value = b.requirements || "";
  pinDropTarget = b.lat != null ? { lat: b.lat, lng: b.lng } : null;
  // 좌표가 이미 있으면 현재 주소 기준으로 설정된 것으로 간주(주소를 안 바꾸면 재검색 안 함).
  // 좌표가 없으면(예: 좌표 미확인) null로 두어, 주소를 그대로 두거나 수정하면 자동 검색이 시도되도록 함.
  lastGeocodedAddress = b.lat != null ? (b.address || null) : null;
  $("#branch-coords").textContent = pinDropTarget
    ? `좌표 설정됨 (${pinDropTarget.lat.toFixed(5)}, ${pinDropTarget.lng.toFixed(5)})`
    : "좌표 미설정";
  $("#delete-branch-btn").hidden = false;

  const sheetInfo = $("#branch-sheet-info");
  if (b.source === "sheet") {
    sheetInfo.hidden = false;
    $("#sheet-info-region").textContent = b.sheetRegion || "-";
    $("#sheet-info-contact").textContent = b.sheetContact || "-";
    $("#sheet-info-confirmed-date").textContent = b.sheetConfirmedDate || "-";
    $("#sheet-info-inbound-channel").textContent = b.sheetInboundChannel || "-";
    $("#sheet-info-expected-open-month").textContent = b.sheetExpectedOpenMonth || "-";
    $("#sheet-info-sales-rep").textContent = b.sheetSalesRep || "-";
    $("#sheet-info-note").textContent = b.sheetNote || "-";
  } else {
    sheetInfo.hidden = true;
  }

  $("#branch-modal").hidden = false;
  window.MapModule.enablePinDrop(async (coords) => {
    pinDropTarget = coords;
    $("#branch-coords").textContent = `좌표 설정됨 (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
    // 좌표 찾기와 동일하게, 지도를 직접 클릭해 좌표를 지정한 경우에도
    // 기존 지점이라면 즉시 저장합니다.
    await window.Store.updateBranch(b.id, { lat: coords.lat, lng: coords.lng });
  });
}

function closeModal() {
  $("#branch-modal").hidden = true;
  window.MapModule.disablePinDrop();
}

function initModalEvents() {
  $("#add-branch-btn").addEventListener("click", openAddModal);
  $("#cancel-branch-btn").addEventListener("click", closeModal);
  $("#close-branch-modal-btn").addEventListener("click", closeModal);

  $("#geocode-btn").addEventListener("click", async () => {
    const address = $("#branch-address").value.trim();
    if (!address) return;
    const btn = $("#geocode-btn");
    btn.disabled = true;
    try {
      const coords = await window.MapModule.resolveLocation(address);
      pinDropTarget = coords;
      lastGeocodedAddress = address;
      $("#branch-coords").textContent = coords.matchedName
        ? `좌표 설정됨: ${coords.matchedName} (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
        : `좌표 설정됨 (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
      // 기존 지점을 수정 중인 경우(이미 id가 있음) 좌표를 즉시 저장합니다.
      // 이전에는 "저장" 버튼을 따로 눌러야만 반영돼서, 좌표 찾기 후 모달을
      // 닫거나 다른 작업을 하면 찾은 좌표가 그대로 사라지는 문제가 있었습니다.
      const id = $("#branch-id").value;
      if (id) {
        await window.Store.updateBranch(id, { lat: coords.lat, lng: coords.lng });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // 주소를 직접 입력/수정하고 다른 필드로 넘어가면(blur) 자동으로 좌표를 찾습니다.
  // "좌표 찾기" 버튼을 따로 누르지 않아도 주소를 업데이트하는 대로 좌표가 채워집니다.
  $("#branch-address").addEventListener("blur", async () => {
    const address = $("#branch-address").value.trim();
    if (!address || address === lastGeocodedAddress) return;
    const coordsEl = $("#branch-coords");
    coordsEl.textContent = "좌표 확인 중...";
    try {
      const coords = await window.MapModule.resolveLocation(address);
      pinDropTarget = coords;
      lastGeocodedAddress = address;
      coordsEl.textContent = coords.matchedName
        ? `좌표 설정됨: ${coords.matchedName} (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
        : `좌표 설정됨 (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
      // 좌표 찾기 버튼과 동일하게, 기존 지점 수정 중이면 즉시 저장합니다.
      const id = $("#branch-id").value;
      if (id) {
        await window.Store.updateBranch(id, { lat: coords.lat, lng: coords.lng });
      }
    } catch (err) {
      pinDropTarget = null;
      coordsEl.textContent = '좌표 미설정 (자동 검색 실패 - "좌표 찾기"를 눌러 다시 시도하거나 지도를 클릭하세요)';
    }
  });

  $("#branch-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("#branch-id").value;
    const address = $("#branch-address").value.trim();
    // 주소를 수정한 뒤 다른 필드를 거치지 않고 바로 저장한 경우를 대비해
    // 저장 직전에도 주소-좌표 동기화 여부를 한 번 더 확인합니다.
    if (address && address !== lastGeocodedAddress) {
      try {
        pinDropTarget = await window.MapModule.resolveLocation(address);
        lastGeocodedAddress = address;
      } catch {
        pinDropTarget = null;
      }
    }
    const data = {
      name: $("#branch-name").value.trim(),
      address: $("#branch-address").value.trim(),
      status: $("#branch-status").value,
      priority: $("#branch-priority").value,
      openDate: $("#branch-open-date").value,
      contractStartDate: $("#branch-contract-start-date").value,
      assignee: $("#branch-assignee").value.trim(),
      requirements: $("#branch-requirements").value.trim(),
      lat: pinDropTarget ? pinDropTarget.lat : null,
      lng: pinDropTarget ? pinDropTarget.lng : null,
      createdBy: currentUser ? currentUser.name || currentUser.email : "unknown",
    };
    if (id) {
      const existing = allBranches.find((x) => x.id === id);
      await window.Store.updateBranch(id, data);
      // 시트에서 가져온 지점이면 "요구사항/메모"를 구글시트 "비고"에도 반영합니다.
      // (SHEET_WRITE_PROXY_URL 미설정 시 조용히 무시되며 실패해도 로컬 저장은 유지됩니다)
      if (existing && existing.source === "sheet" && existing.sheetKey) {
        window.SheetsImport.pushNoteToSheet(existing.sheetKey, data.requirements)
          .then(() => window.Store.updateBranch(id, { sheetNote: data.requirements }))
          .catch((err) => console.warn("구글시트 비고 동기화 실패:", err.message));
      }
    } else {
      await window.Store.addBranch(data);
    }
    closeModal();
  });

  $("#delete-branch-btn").addEventListener("click", async () => {
    const id = $("#branch-id").value;
    if (!id) return;
    if (!confirm("이 지점을 삭제하시겠습니까?")) return;
    await window.Store.deleteBranch(id);
    closeModal();
  });
}

// 지점 추가/수정 모달을 제목 표시줄을 잡고 드래그로 이동할 수 있게 합니다.
// 크기 조절(늘리고 줄이기)은 CSS의 resize: both 속성으로 모달 오른쪽 아래
// 모서리를 잡아서 처리하며, 여기서는 "이동"만 담당합니다.
function initModalDragMove() {
  const box = $("#branch-modal .modal-box");
  const handle = $("#branch-modal-title");
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener("pointerdown", (e) => {
    // 텍스트 선택/네이티브 드래그가 가로채지 않도록 가장 먼저 막습니다.
    e.preventDefault();
    dragging = true;
    const rect = box.getBoundingClientRect();
    // 드래그 시작 시 flex 중앙정렬에서 분리해 화면 절대 좌표로 고정합니다.
    box.style.position = "fixed";
    box.style.margin = "0";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // 캡처에 실패해도 document 레벨이 아닌 핸들 자체 리스너로 계속 추적 가능
    }
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = box.getBoundingClientRect();
    let newLeft = startLeft + (e.clientX - startX);
    let newTop = startTop + (e.clientY - startY);
    // 모달이 화면 밖으로 완전히 사라지지 않도록 살짝 여유를 두고 제한합니다.
    newLeft = Math.min(Math.max(newLeft, -rect.width + 80), window.innerWidth - 80);
    newTop = Math.min(Math.max(newTop, 0), window.innerHeight - 40);
    box.style.left = `${newLeft}px`;
    box.style.top = `${newTop}px`;
  });

  const stopDragging = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      // 이미 해제된 경우 무시
    }
  };
  handle.addEventListener("pointerup", stopDragging);
  handle.addEventListener("pointercancel", stopDragging);
}

// ---------- 구글 시트 동기화 ----------

// 네이버 geocode API 호출 — 대량 가져오기 중 일시적인 속도 제한/오류로
// 실패하는 경우를 대비해 짧은 대기 후 최대 2회까지 재시도합니다.
async function geocodeWithRetry(address, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await window.MapModule.geocodeAddress(address);
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  return null;
}

function initSheetSyncEvents() {
  $("#sync-sheet-btn").addEventListener("click", runSheetSync);
  const retryBtn = $("#retry-geocode-btn");
  if (retryBtn) retryBtn.addEventListener("click", runBulkGeocodeRetry);
}

// "전체 좌표 일괄 재검색" — 좌표가 없는(⚠ 좌표 미확인) 지점들을 모아
// 다시 한 번 지오코딩을 시도합니다. 서울 prefix 버그 수정이나 일시적인
// API 오류로 실패했던 지점들을 한 번에 복구할 수 있습니다.
async function runBulkGeocodeRetry() {
  const btn = $("#retry-geocode-btn");
  const statusEl = $("#sync-status");
  const targets = allBranches.filter((b) => (b.lat == null || b.lng == null) && b.address);
  if (!targets.length) {
    statusEl.className = "sync-status success";
    statusEl.textContent = "좌표 미확인 지점이 없습니다.";
    return;
  }
  btn.disabled = true;
  let fixed = 0;
  for (let i = 0; i < targets.length; i++) {
    const branch = targets[i];
    statusEl.className = "sync-status";
    statusEl.textContent = `좌표 재검색 중... (${i + 1}/${targets.length})`;
    const coords = await geocodeWithRetry(branch.address);
    if (coords) {
      await window.Store.updateBranch(branch.id, { lat: coords.lat, lng: coords.lng });
      fixed++;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  statusEl.className = "sync-status success";
  statusEl.textContent = `좌표 재검색 완료: ${fixed}/${targets.length}건 확인됨.`;
  btn.disabled = false;
}

async function runSheetSync() {
  const btn = $("#sync-sheet-btn");
  const statusEl = $("#sync-status");
  btn.disabled = true;
  statusEl.className = "sync-status";
  statusEl.textContent = "구글 시트에서 목록을 가져오는 중...";
  try {
    const rows = await window.SheetsImport.fetchSeoulHospitalsFromSheet();
    const existingKeys = new Set(allBranches.map((b) => b.sheetKey).filter(Boolean));
    const newRows = rows.filter((r) => !existingKeys.has(window.SheetsImport.sheetRowKey(r)));

    if (!newRows.length) {
      statusEl.className = "sync-status success";
      statusEl.textContent = `새로운 병원이 없습니다. (시트 ${rows.length}건 모두 이미 등록됨)`;
      return;
    }

    let added = 0;
    let geocoded = 0;
    for (const row of newRows) {
      statusEl.textContent = `가져오는 중... (${added + 1}/${newRows.length})`;
      let coords = null;
      if (window.APP_CONFIG.HAS_MAPS_KEY && row.address) {
        coords = await geocodeWithRetry(row.address);
        if (coords) geocoded++;
        await new Promise((r) => setTimeout(r, 350)); // Geocoding API 요청 속도 보호 (200ms→350ms, 대량 가져오기 시 빈번한 실패 방지)
      }
      await window.Store.addBranch({
        name: row.name,
        address: row.address,
        status: row.status,
        priority: "중",
        openDate: "",
        contractStartDate: "",
        assignee: "",
        requirements: "",
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
        createdBy: currentUser ? currentUser.name || currentUser.email : "sheet-sync",
        source: "sheet",
        sheetKey: window.SheetsImport.sheetRowKey(row),
        sheetRegion: row.region,
        sheetContact: row.contact,
        sheetConfirmedDate: row.confirmedDate,
        sheetInboundChannel: row.inboundChannel,
        sheetExpectedOpenMonth: row.expectedOpenMonth,
        sheetSalesRep: row.salesRep,
        sheetNote: row.note,
      });
      added++;
    }

    statusEl.className = "sync-status success";
    const geoNote = ` (좌표 확인 ${geocoded}/${added}건, 나머지는 "전체 좌표 일괄 재검색" 버튼이나 목록의 ⚠표시 항목을 열어 "좌표 찾기"로 보완하세요)`;
    statusEl.textContent = `${added}개 병원을 새로 가져왔습니다.${geoNote}`;
  } catch (err) {
    statusEl.className = "sync-status error";
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ---------- 동선 최적화 ----------

function initRouteEvents() {
  // 이전에 입력한 출발지 주소를 기억해두어 다음에도 다시 입력하지 않도록 합니다.
  const originInput = $("#route-origin-address");
  const savedOrigin = localStorage.getItem("sba_route_origin_address");
  if (savedOrigin) originInput.value = savedOrigin;

  $("#optimize-route-btn").addEventListener("click", async () => {
    const selected = allBranches.filter((b) => selectedBranchIds.has(b.id) && b.lat != null);
    if (selected.length < 1) {
      alert("방문할 지점을 1개 이상 선택해주세요.");
      return;
    }
    const address = originInput.value.trim();
    if (!address) {
      alert("출발지 주소를 입력해주세요.");
      originInput.focus();
      return;
    }
    const statusEl = $("#route-summary");
    statusEl.textContent = "출발지 확인 중...";
    let origin;
    try {
      origin = await window.MapModule.resolveLocation(address);
    } catch (err) {
      statusEl.textContent = "";
      alert(err.message);
      return;
    }
    if (origin.matchedName) {
      statusEl.textContent = `출발지: ${origin.matchedName} (${origin.matchedAddress})`;
    }
    localStorage.setItem("sba_route_origin_address", address);
    const result = await window.RouteEngine.computeOptimalRoute(origin, selected);
    renderRouteResult(result);
    window.MapModule.drawRoute(result.ordered, origin, result.routeGeometry);
  });
}

function renderRouteResult(result) {
  const ol = $("#route-result-list");
  ol.innerHTML = "";
  result.ordered.forEach((b) => {
    const li = document.createElement("li");
    li.textContent = b.name;
    ol.appendChild(li);
  });
  const modeLabel = result.mode === "osrm" ? "도로 기반(실제 경로)" : "직선거리 기준 추정";
  const durationLabel = result.totalDurationMin ? ` / 약 ${result.totalDurationMin}분` : "";
  $("#route-summary").textContent = `${modeLabel} · 총 ${result.totalDistanceKm.toFixed(1)}km${durationLabel}`;
}

// ---------- 메뉴 / 로그아웃 ----------

function initTopBarEvents() {
  $("#logout-btn").addEventListener("click", async () => {
    await window.Auth.logOut();
    exitApp();
  });
  $("#menu-toggle").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
}

// ---------- 초기화 ----------

function init() {
  showDemoBanners();
  initAuthScreen();
  initModalEvents();
  initModalDragMove();
  initSheetSyncEvents();
  initRouteEvents();
  initTopBarEvents();
  // 지도(네이버 지도) 초기화가 데이터 로드보다 늦게 끝나는 경우, 데이터가 먼저 도착하면
  // isReady()가 false라서 마커 렌더링이 누락됩니다. 지도가 준비되는 즉시 한 번 더
  // 렌더링해 마커가 누락되지 않도록 합니다.
  document.addEventListener("map-ready", () => {
    renderAll();
    requestAnimationFrame(() => window.MapModule.invalidateSize());
  });
  window.Auth.onAuthChange((user) => {
    if (user) enterApp(user);
    else exitApp();
  });
}

init();
