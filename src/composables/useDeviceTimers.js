// src/composables/useDeviceTimers.js
import { reactive, computed, ref } from 'vue'

const now = ref(Date.now())
setInterval(() => { now.value = Date.now() }, 1000)

const timerPollIntervals = {}

export function useDeviceTimers({ socket, fetchTimerStatus, getApiRoute }) {
  // timerStates[endpoint] = { running, endTime, power, countdown }
  const timerStates = reactive({})

  // --- Helper: Format MM:SS string ---
  function mmss(sec) {
    if (!sec || sec <= 0) return '00:00'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // --- Per-device polling for /timer/status ---
  async function pollTimerStatus(device) {
    const endpoint = device.endpoint
    // If already polling, don't start another
    if (timerPollIntervals[endpoint]) return

    timerPollIntervals[endpoint] = setInterval(async () => {
      const status = await fetchTimerStatus(device)
      // Sync with state
      if (status) {
        timerStates[endpoint] = { ...timerStates[endpoint], ...status }
        // Stop polling if timer is no longer running
        if (!status.running) {
          clearInterval(timerPollIntervals[endpoint])
          timerPollIntervals[endpoint] = null
        }
      }
    }, 1000)
  }

  // --- API: start timer (optimistic) ---
  async function startTimer(device, minutes = 5) {
    const endpoint = device.endpoint
    const url = getApiRoute(device, 'timer')
    const body = { minutes }
    // Optimistically update
    timerStates[endpoint] = {
      running: true,
      endTime: Date.now() + minutes * 60_000,
      power: 'on',
      countdown: minutes * 60
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      await fetchAndSync(endpoint, device)
    } finally {
      // Always (re)start polling when a timer starts
      pollTimerStatus(device)
    }
  }

  // --- API: add time ---
  async function addToTimer(device, minutes = 1) {
    const endpoint = device.endpoint
    const url = getApiRoute(device, 'timer')
    const body = { minutes }
    // Optimistically add
    if (timerStates[endpoint] && timerStates[endpoint].running) {
      timerStates[endpoint].endTime += minutes * 60_000
      timerStates[endpoint].countdown += minutes * 60
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      await fetchAndSync(endpoint, device)
    } finally {
      pollTimerStatus(device)
    }
  }

  // --- API: cancel timer ---
  async function cancelTimer(device) {
    const endpoint = device.endpoint
    const url = getApiRoute(device, 'timer')
    // Optimistically update
    timerStates[endpoint].running = false
    timerStates[endpoint].endTime = null
    timerStates[endpoint].countdown = 0
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes: 0 })
        })
      await fetchAndSync(endpoint, device)
    } finally {
      // Always stop polling when cancelled
      clearInterval(timerPollIntervals[endpoint])
      timerPollIntervals[endpoint] = null
    }
  }

  // --- Manual fetch/sync state from backend ---
  async function fetchAndSync(endpoint, device) {
    const status = await fetchTimerStatus(device)
    if (status) {
      timerStates[endpoint] = {
        running: !!status.running,
        endTime: status.endTime || null,
        countdown: status.remainingMs ? Math.ceil(status.remainingMs / 1000) : 0,
      }
      // If timer is running, ensure polling, otherwise stop
      if (status.running) {
        pollTimerStatus(device)
      } else {
        clearInterval(timerPollIntervals[endpoint])
        timerPollIntervals[endpoint] = null
      }
    }
  }

  // --- Socket timer updates ---
  if (socket) {
    socket.on('timer-update', ({ device, endTime, running, remainingMs }) => {
      const endpoint = device
      if (!endpoint) return
      timerStates[endpoint] = {
        running: !!running,
        endTime: endTime || null,
        countdown: remainingMs ? Math.ceil(remainingMs / 1000) : 0,
      }
      // If not running, stop polling
      if (!running) {
        clearInterval(timerPollIntervals[endpoint])
        timerPollIntervals[endpoint] = null
      }
    })
  }

  // --- Computed MM:SS string for display (per device) ---
const timerDisplays = computed(() => {
  const out = {}
  for (const endpoint in timerStates) {
    const ts = timerStates[endpoint]
    // Use backend-provided endTime, not local countdown mutation!
    let seconds = 0
    if (ts && ts.running && ts.endTime) {
      const remaining = ts.endTime - now.value
      seconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0
    }
    out[endpoint] = mmss(seconds)
  }
  return out
})
  return {
    timerStates,
    timerDisplays,
    startTimer,
    addToTimer,
    cancelTimer,
    fetchAndSync,
  }
}
