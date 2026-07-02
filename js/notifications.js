// ============================================================
// notifications.js — 다가오는 개업일 등 인앱 알림 패널
// (이메일/푸시 발송 없이, 로그인 시 항상 보이는 대시보드 알림입니다.
//  브라우저 알림 권한을 받으면 데스크톱 알림도 함께 띄웁니다.)
// ============================================================

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getUpcomingBranches(branches) {
  const threshold = window.APP_CONFIG.UPCOMING_DAYS_THRESHOLD ?? 14;
  return branches
    .map((b) => ({ ...b, daysLeft: daysUntil(b.openDate) }))
    .filter((b) => b.daysLeft !== null && b.daysLeft >= 0 && b.daysLeft <= threshold)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function maybeRequestBrowserNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyBrowser(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* 일부 환경(파일 직접 열기 등)에서는 알림이 차단될 수 있음 */
    }
  }
}

window.Notifications = {
  daysUntil,
  getUpcomingBranches,
  maybeRequestBrowserNotificationPermission,
  notifyBrowser,
};
