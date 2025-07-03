self.addEventListener('push', function(event) {
  console.log("got to sw.js")
  let data = {};
  try { data = event.data.json(); } catch {}
  self.registration.showNotification(data.title || "Timer Alert", {
    body: data.body || "",
    icon: 'public/icon-192.png', // adjust to your app,
    requireInteraction: true
  });
});
