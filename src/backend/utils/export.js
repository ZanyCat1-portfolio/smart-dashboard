// --- Export Timers to CSV ---
function exportTimersToCsv(timers) {
  if (!Array.isArray(timers) || timers.length === 0) return '';
  const fields = Object.keys(timers[0]);
  const csv = [
    fields.join(','),
    ...timers.map(timer => fields.map(f => JSON.stringify(timer[f] ?? '')).join(','))
  ].join('\n');
  return csv;
}

// --- Filter: By State ---
function filterTimersByState(timers, state) {
  if (!state) return timers;
  if (Array.isArray(state)) {
    return timers.filter(t => state.includes(t.state));
  }
  return timers.filter(t => t.state === state);
}

// --- Filter: By Date Range ---
function filterTimersByDate(timers, { start, end, field = 'createdAt' }) {
  return timers.filter(t => {
    const date = new Date(t[field]);
    return (!start || date >= new Date(start)) && (!end || date <= new Date(end));
  });
}

module.exports = {
  exportTimersToCsv,
  filterTimersByState,
  filterTimersByDate,
};
