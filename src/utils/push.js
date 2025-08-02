// a frontend utility file!
// TODO maybe refactor this into ./utils file
import { frontendFetch } from "./utils";

export async function getPushSubscription() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
    if (!('PushManager' in window)) throw new Error('Push not supported in this browser');
    
    // Use the same registration as in main.js
    const swReg = await navigator.serviceWorker.ready;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission denied');

    // Get your VAPID public key from the backend
    const resp = await frontendFetch('/api/vapid-public-key');
    if (!resp.ok) throw new Error('Failed to get VAPID key');
    const publicVapidKey = await resp.text();

    function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }

    // Subscribe for push
    const subscription = await swReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });
    return subscription;
}