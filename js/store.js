// ============================================================
// store.js — 데이터 레이어
// Firebase가 설정되어 있으면 Firestore 실시간 동기화를 사용하고,
// 설정되어 있지 않으면 localStorage 기반 데모 모드로 동작합니다.
// 두 경우 모두 동일한 인터페이스(window.Store)를 제공하므로
// 다른 화면 코드는 모드를 신경쓰지 않아도 됩니다.
// ============================================================

const DEMO = window.APP_CONFIG.IS_DEMO_MODE;
const LS_BRANCHES_KEY = "sba_branches";
const LS_USERS_KEY = "sba_users";

let firebaseApp = null;
let db = null;

async function initFirebaseIfNeeded() {
  if (DEMO) return;
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  firebaseApp = initializeApp(window.APP_CONFIG.FIREBASE_CONFIG);
  db = firestore.getFirestore(firebaseApp);
  window.__firestore = firestore;
  window.__db = db;
}

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function writeLocal(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function uid() {
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- 지점(branch) CRUD ----------

const branchListeners = [];

function notifyBranches() {
  const list = readLocal(LS_BRANCHES_KEY);
  branchListeners.forEach((cb) => cb(list));
}

async function onBranchesChange(callback) {
  await initFirebaseIfNeeded();
  if (DEMO) {
    branchListeners.push(callback);
    notifyBranches();
    return () => {
      const i = branchListeners.indexOf(callback);
      if (i >= 0) branchListeners.splice(i, 1);
    };
  }
  const { collection, onSnapshot } = window.__firestore;
  const ref = collection(db, "branches");
  return onSnapshot(ref, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

async function addBranch(data) {
  await initFirebaseIfNeeded();
  const now = new Date().toISOString();
  if (DEMO) {
    const list = readLocal(LS_BRANCHES_KEY);
    const item = { id: uid(), ...data, createdAt: now, updatedAt: now };
    list.push(item);
    writeLocal(LS_BRANCHES_KEY, list);
    notifyBranches();
    return item.id;
  }
  const { collection, addDoc, serverTimestamp } = window.__firestore;
  const ref = await addDoc(collection(db, "branches"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

async function updateBranch(id, data) {
  await initFirebaseIfNeeded();
  const now = new Date().toISOString();
  if (DEMO) {
    const list = readLocal(LS_BRANCHES_KEY);
    const idx = list.findIndex((b) => b.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data, updatedAt: now };
      writeLocal(LS_BRANCHES_KEY, list);
      notifyBranches();
    }
    return;
  }
  const { doc, updateDoc, serverTimestamp } = window.__firestore;
  await updateDoc(doc(db, "branches", id), { ...data, updatedAt: serverTimestamp() });
}

async function deleteBranch(id) {
  await initFirebaseIfNeeded();
  if (DEMO) {
    const list = readLocal(LS_BRANCHES_KEY).filter((b) => b.id !== id);
    writeLocal(LS_BRANCHES_KEY, list);
    notifyBranches();
    return;
  }
  const { doc, deleteDoc } = window.__firestore;
  await deleteDoc(doc(db, "branches", id));
}

// ---------- 사용자(user) / 권한 ----------

const userListeners = [];
function notifyUsers() {
  const list = readLocal(LS_USERS_KEY);
  userListeners.forEach((cb) => cb(list));
}

async function onUsersChange(callback) {
  await initFirebaseIfNeeded();
  if (DEMO) {
    userListeners.push(callback);
    notifyUsers();
    return () => {
      const i = userListeners.indexOf(callback);
      if (i >= 0) userListeners.splice(i, 1);
    };
  }
  const { collection, onSnapshot } = window.__firestore;
  const ref = collection(db, "users");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

async function upsertUser(idOrUid, data) {
  await initFirebaseIfNeeded();
  if (DEMO) {
    const list = readLocal(LS_USERS_KEY);
    const idx = list.findIndex((u) => u.id === idOrUid);
    if (idx >= 0) list[idx] = { ...list[idx], ...data };
    else list.push({ id: idOrUid, ...data });
    writeLocal(LS_USERS_KEY, list);
    notifyUsers();
    return;
  }
  const { doc, setDoc } = window.__firestore;
  await setDoc(doc(db, "users", idOrUid), data, { merge: true });
}

// 관리자가 사용자를 탈퇴(추방) 처리 — users 문서를 제거하면 앱 접근 권한이 즉시 차단됩니다.
async function deleteUser(id) {
  await initFirebaseIfNeeded();
  if (DEMO) {
    const list = readLocal(LS_USERS_KEY).filter((u) => u.id !== id);
    writeLocal(LS_USERS_KEY, list);
    notifyUsers();
    return;
  }
  const { doc, deleteDoc } = window.__firestore;
  await deleteDoc(doc(db, "users", id));
}

window.Store = {
  isDemo: DEMO,
  onBranchesChange,
  addBranch,
  updateBranch,
  deleteBranch,
  onUsersChange,
  upsertUser,
  deleteUser,
};
