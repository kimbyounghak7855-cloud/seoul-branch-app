// ============================================================
// auth.js — 로그인/가입/권한
// Firebase Auth 사용 가능하면 그걸 쓰고, 데모 모드면 localStorage 기반
// 간이 인증으로 동작합니다 (비밀번호는 데모 목적상 평문 저장 — 실제
// 운영 환경에서는 반드시 Firebase Auth로 전환하세요).
// ============================================================

const DEMO = window.APP_CONFIG.IS_DEMO_MODE;
const LS_SESSION_KEY = "sba_session";
const LS_LOCAL_ACCOUNTS_KEY = "sba_accounts";

let firebaseAuth = null;
let authModule = null;

async function initAuthIfNeeded() {
  if (DEMO) return;
  authModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  firebaseAuth = authModule.getAuth(window.__firebaseAppRef);
}

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(LS_LOCAL_ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeAccounts(list) {
  localStorage.setItem(LS_LOCAL_ACCOUNTS_KEY, JSON.stringify(list));
}

async function signUp(name, email, password) {
  if (DEMO) {
    const accounts = readAccounts();
    if (accounts.find((a) => a.email === email)) {
      throw new Error("이미 가입된 이메일입니다.");
    }
    const isFirst = accounts.length === 0;
    const account = {
      uid: "u_" + Math.random().toString(36).slice(2),
      name,
      email,
      password,
      role: isFirst ? "admin" : "pending", // 최초 가입자는 관리자, 그 외는 관리자 승인 대기
    };
    accounts.push(account);
    writeAccounts(accounts);
    await window.Store.upsertUser(account.uid, { name, email, role: account.role });
    setSession(account);
    return account;
  }
  await initAuthIfNeeded();
  const { createUserWithEmailAndPassword, updateProfile } = authModule;
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await window.Store.upsertUser(cred.user.uid, { name, email, role: "pending" });
  return cred.user;
}

async function logIn(email, password) {
  if (DEMO) {
    const accounts = readAccounts();
    const account = accounts.find((a) => a.email === email && a.password === password);
    if (!account) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    setSession(account);
    return account;
  }
  await initAuthIfNeeded();
  const { signInWithEmailAndPassword } = authModule;
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

async function logOut() {
  if (DEMO) {
    localStorage.removeItem(LS_SESSION_KEY);
    return;
  }
  await initAuthIfNeeded();
  const { signOut } = authModule;
  await signOut(firebaseAuth);
}

function setSession(account) {
  localStorage.setItem(LS_SESSION_KEY, JSON.stringify(account));
}

// 관리자가 사용자를 탈퇴(추방)시킬 때 호출 — 로그인 자격을 제거합니다.
// 데모 모드: 로컬 계정 목록에서 제거하고, 본인이 탈퇴 대상이면 세션도 비웁니다.
// Firebase 모드: 클라이언트에서는 다른 사용자의 Auth 계정을 직접 삭제할 수 없으므로
// (Admin SDK/Cloud Functions 필요) 여기서는 아무 동작도 하지 않습니다. 대신
// store.js의 users 문서 삭제로 앱 접근 자체를 차단합니다(main.js 참고).
async function deleteAccount(uid) {
  if (DEMO) {
    const accounts = readAccounts().filter((a) => a.uid !== uid);
    writeAccounts(accounts);
    const session = getSession();
    if (session && session.uid === uid) {
      localStorage.removeItem(LS_SESSION_KEY);
    }
  }
}

function getSession() {
  if (DEMO) {
    try {
      return JSON.parse(localStorage.getItem(LS_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }
  return null; // Firebase 모드는 onAuthChange로 처리
}

async function onAuthChange(callback) {
  if (DEMO) {
    callback(getSession());
    return;
  }
  await initAuthIfNeeded();
  const { onAuthStateChanged } = authModule;
  onAuthStateChanged(firebaseAuth, (user) => callback(user));
}

window.Auth = { signUp, logIn, logOut, getSession, onAuthChange, deleteAccount, isDemo: DEMO };
