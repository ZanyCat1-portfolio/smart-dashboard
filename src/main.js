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

createApp(App).mount('#app')
