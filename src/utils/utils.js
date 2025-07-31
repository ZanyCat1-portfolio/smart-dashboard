import { state } from "../composables/useSessions";

export function isLive(timer) {
  return timer && !['canceled', 'finished', 'completed'].includes(timer.status);
}

export function formatDisplay(sec) {
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${s.toString().padStart(2, '0')}`;
}

export function refreshLoginTimer(callback, timeoutMs) {
  return setTimeout(callback, timeoutMs);
}

export async function authFetch(url, options) {
  const res = await fetch(url, options);

  if (res.status === 401 || res.status === 403) {
    state.user = null;
    // Optional: force navigation to login or reload
  }
  if (!res.ok) {
    // Throw with status and message (if available)
    let errMsg;
    try {
      const body = await res.json();
      errMsg = body?.error || res.statusText;
    } catch {
      errMsg = res.statusText;
    }
    const error = new Error(errMsg);
    error.status = res.status;
    throw error;
  }

  return res;
}