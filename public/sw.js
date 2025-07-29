// v2
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch {}

  // Set defaults
  let title = "Timer Alert";
  let body = "";

  // Helper for formatting seconds as "X hours, Y minutes"
  function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    let parts = [];
    if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
    if (!parts.length) parts.push(`${sec} seconds`);
    return parts.join(', ');
  }

  // Helper for formatting end time as "h:mm a.m./p.m."
  function formatEndTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  if (data.type && data.timer) {
    const label = data.timer.label || 'Unnamed';
    const duration = formatDuration(data.timer.duration || data.timer.initialDuration || 0);
    const endTime = formatEndTime(data.timer.endTime);

    switch (data.type) {
      case "timerStarted":
        title = `Timer Started: ${label}`;
        body = `Timer '${label}' started.\nDuration: ${duration}\nWill lapse at ${endTime}`;
        break;
      case "timerUnpaused":
        title = `Timer Unpaused: ${label}`;
        body = `Timer '${label}' resumed.\nDuration: ${duration}\nWill lapse at ${endTime}`;
        break;
      case "timerPaused":
        title = `Timer Paused: ${label}`;
        body = `Timer '${label}' is paused.`;
        break;
      case "timerFinished":
        title = `Timer Finished: ${label}`;
        body = `Timer '${label}' has finished.\nDuration: ${duration}\nShould have lapsed at ${endTime}`;
        break;
      default:
        title = "Timer Alert";
        body = `Event: ${data.type}`;
    }
  }

  // Fallback if nothing matches
  title = title || "Timer Alert";
  body = body || "";

  self.registration.showNotification(title, {
    body,
    icon: 'public/icon-192.png',
    requireInteraction: true
  });

  // Debug: broadcast to windows
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ tag: 'sw-push', data });
    });
  });
});
