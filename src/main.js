// import './assets/styles/global.css'

if ('serviceWorker' in navigator) {
  // Register the SW immediately on page load
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      // Optionally: console.log('SW registered', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });

  // Attach message handler directly
  navigator.serviceWorker.onmessage = event => {
    if (event.data && event.data.tag === 'sw-push') {
      // This will appear in the *tab's* console when push fires
      console.log('[FROM SW]', event.data.data);
    }
  };
}

// ...now the rest of your imports and Vue code

import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './style.css'
import { createApp } from 'vue'
import App from './App.vue'

import socket from './composables/useSocket'

const app = createApp(App);
const vm = app.mount('#app');
window.__vue_root__ = vm;