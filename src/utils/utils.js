export function isLive(timer) {
  return timer && !['canceled', 'finished', 'completed'].includes(timer.status);
}

export function formatDisplay(sec) {
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${s.toString().padStart(2, '0')}`;
}