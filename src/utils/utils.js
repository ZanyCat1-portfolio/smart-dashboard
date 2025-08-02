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

export async function frontendAuthFetch(endpoint, options) {
  const base = import.meta.env.VITE_BASE_PATH || '/';
  console.log("what is base authFetch: ", base)
  const url = base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
  const res = await fetch(url, options);

  if (res.status === 401 || res.status === 403) {
    state.user = null;
    // Optionally redirect or reload
  }
  if (!res.ok) {
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

export async function frontendFetch(endpoint, options = {}) {
  const base = import.meta.env.VITE_BASE_PATH || '/';
  console.log("what is base frotFetch: ", base)
  // Remove double slashes
  const url = base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
  return fetch(url, options)
}