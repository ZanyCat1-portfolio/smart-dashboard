// useSmartTimers.js
import { reactive, computed, ref } from 'vue'

const base = import.meta.env.BASE_URL;
console.log("base is:", base)

// Shared reference for time
const now = ref(Date.now())
setInterval(() => { now.value = Date.now() }, 1000)

const smartTimerStates = reactive({})

function mmss(sec) {
  if (!sec || sec <= 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useSmartTimers({ socket }) {

    async function startTimer(timerId, duration) {
        await fetch(`${base}api/smart-timers/${timerId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration })
        });
    }

    async function pauseTimer(timerId) {
        await fetch(`${base}api/smart-timers/${timerId}/pause`, { method: 'POST' });
    }

    async function unpauseTimer(timerId) {
        console.log("DID ALSO GET HERE?")
        await fetch(`${base}api/smart-timers/${timerId}/unpause`, { method: 'POST' });
    }
    
    async function cancelTimer(timerId) {
        await fetch(`${base}api/smart-timers/${timerId}/cancel`, { method: 'POST' });
    }


    // --- SOCKET: SmartTimer listeners ---
    console.log("COME BACK HERE")
    // stop querying db every time, start returning inmem db that queries at startup
    if (socket) {
        socket.on('smart-timer-update', (timer) => {
            if (['pending', 'running', 'paused'].includes(timer.state)) {
                smartTimerStates[timer.id] = timer;
            } else {
                // Remove finished/canceled timers from state
                delete smartTimerStates[timer.id];
            }
        });

        socket.on('smart-timer-snapshot', (timersArray) => {
            Object.keys(smartTimerStates).forEach(id => { delete smartTimerStates[id]; });
            timersArray.forEach(timer => {
                smartTimerStates[timer.id] = timer;
            });
        });

        socket.on('smartTimers:snapshot', (timersArray) => {
            // Clear and re-populate
            Object.keys(smartTimerStates).forEach(id => { delete smartTimerStates[id]; });
            timersArray.forEach(timer => {
                smartTimerStates[timer.id] = timer;
            });
        });
    }

    const smartTimerDisplays = computed(() => {
        const out = {}
        for (const id in smartTimerStates) {
        const timer = smartTimerStates[id]
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
        Object.values(smartTimerStates).filter(
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
        smartTimerStates,
        smartTimerDisplays,
        visibleSmartTimers,
        getSmartTimerDisplay,
        startTimer,
        pauseTimer,
        unpauseTimer,
        cancelTimer
    }
}
