// useSmartTimers.js
import { reactive, computed, ref } from 'vue'
import { authFetch } from '../utils/utils';


const smartTimers = reactive({})
const base = import.meta.env.BASE_URL;
// console.log("base is:", base)

// Shared reference for time
const now = ref(Date.now())
setInterval(() => { now.value = Date.now() }, 1000)

// // now imported from /src/data/smartTimers
// const smartTimers = reactive({})

function mmss(sec) {
  if (!sec || sec <= 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useSmartTimers({ socket }) {

    async function startTimer(timerId, duration) {
        await authFetch(`${base}api/smart-timers/${timerId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration })
        });
    }

    async function pauseTimer(timerId) {
        await authFetch(`${base}api/smart-timers/${timerId}/pause`, { method: 'POST' });
    }

    async function unpauseTimer(timerId) {
        // console.log("DID ALSO GET HERE?")
        await authFetch(`${base}api/smart-timers/${timerId}/unpause`, { method: 'POST' });
    }
    
    async function cancelTimer(timerId) {
        await fetch(`${base}api/smart-timers/${timerId}/cancel`, { method: 'POST' });
    }
    
    async function addRecipient(timerId, userId, deviceId, type = 'webpush', target = deviceId) {
        await authFetch(`/api/smart-timers/${timerId}/recipients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, deviceId, type, target })
        });
    }

    async function removeRecipient(timerId, recipientId) {
        await authFetch(`/api/smart-timers/${timerId}/recipients/${recipientId}`, {
            method: 'DELETE'
        });
    }


    // --- SOCKET: SmartTimer listeners ---
    // console.log("COME BACK HERE")
    // console.log("what is socket: ", socket)
    // stop querying db every time, start returning inmem db that queries at startup
    if (socket) {
        socket.on('smart-timer-update', (timer) => {
            smartTimers[timer.id] = timer;
        });

        socket.on('smart-timer-snapshot', (timersArray) => {
            const arr = Array.isArray(timersArray[0]) ? timersArray[0] : timersArray;

            // Clear existing keys
            Object.keys(smartTimers).forEach(id => delete smartTimers[id]);

            // Assign each new timer
            arr.forEach(timer => {
                if (timer?.id != null) {
                smartTimers[timer.id] = timer;
                }
            });
        });

    }

    const smartTimerDisplays = computed(() => {
        const out = {}
        for (const id in smartTimers) {
        const timer = smartTimers[id]
        let seconds = 0
        if (timer && timer.state === 'running' && timer.end_time) {
            const remaining = new Date(timer.end_time).getTime() - now.value
            seconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0
        } else if (timer && timer.duration) {
            seconds = timer.duration
        }
        out[id] = mmss(seconds)
        }
        return out
    })

    const visibleSmartTimers = computed(() =>
        Object.values(smartTimers).filter(
        t => ['pending', 'paused', 'running'].includes(t.state)
        )
    );

    function getSmartTimerDisplay(timer) {
        if (!timer.end_time || timer.state !== 'running') {
        return mmss(timer.duration)
        }
        const remaining = Math.max(0, Math.ceil((new Date(timer.end_time).getTime() - now.value) / 1000))
        return mmss(remaining)
    }

    return {
        smartTimers,
        smartTimerDisplays,
        visibleSmartTimers,
        getSmartTimerDisplay,
        startTimer,
        pauseTimer,
        unpauseTimer,
        cancelTimer,
        addRecipient,
        removeRecipient,
    }
}
