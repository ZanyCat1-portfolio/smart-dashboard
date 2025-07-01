self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch {}
  self.registration.showNotification(data.title || "Timer Alert", {
    body: data.body || "",
    icon: 'public/icon-192.png', // adjust to your app,
    requireInteraction: true
  });
});
