import { io } from 'socket.io-client';
window.addEventListener("DOMContentLoaded", () => {
  const socket = io(); // import io from 'socket.io-client' at top
  socket.onAny((event, ...args) => {
    console.log("SOCKET EVENT:", event, args);
  });
});

import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './style.css'
import { createApp } from 'vue'
import App from './App.vue'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('Service Worker registered!', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}

const app = createApp(App);
const vm = app.mount('#app');
window.__vue_root__ = vm;


