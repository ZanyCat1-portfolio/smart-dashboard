// import { reactive, computed, ref } from 'vue'

// const now = ref(Date.now())
// setInterval(() => { now.value = Date.now() }, 1000)

// const timerPollIntervals = {}
// const smartTimerStates = reactive({});  // <--- SmartTimer state

// export function useDeviceTimers({ socket, fetchTimerStatus, getApiRoute }) {
//   const deviceStates = reactive({});
//   const timerStates = reactive({})

//   function mmss(sec) {
//     if (!sec || sec <= 0) return '00:00'
//     const m = Math.floor(sec / 60)
//     const s = sec % 60
//     return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
//   }

//   async function pollTimerStatus(device) {
//     const endpoint = device.endpoint
//     if (timerPollIntervals[endpoint]) return

//     timerPollIntervals[endpoint] = setInterval(async () => {
//       clearInterval(timerPollIntervals[endpoint])
//       timerPollIntervals[endpoint] = null
//     }, 1000)
//   }

//   async function startTimer(device, minutes = 5) {
//     const endpoint = device.endpoint
//     console.log("starting timer")
//     const url = getApiRoute(device, 'timer')
//     const body = { minutes }
//     try {
//       await fetch(url, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       })
//       await fetchAndSync(endpoint, device)
//     } finally {
//       pollTimerStatus(device)
//     }
//   }

//   async function addToTimer(device, minutes = 1) {
//     const endpoint = device.endpoint
//     const url = getApiRoute(device, 'timer')
//     const body = { minutes }
//     try {
//       await fetch(url, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       })
//       await fetchAndSync(endpoint, device)
//     } finally {
//       pollTimerStatus(device)
//     }
//   }

//   async function cancelTimer(device) {
//     const endpoint = device.endpoint
//     const url = getApiRoute(device, 'timer')
//     try {
//       await fetch(url, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ minutes: 0 })
//       })
//       await fetchAndSync(endpoint, device)
//     } finally {
//       clearInterval(timerPollIntervals[endpoint])
//       timerPollIntervals[endpoint] = null
//     }
//   }

//   async function fetchAndSync(endpoint, device) {
//       clearInterval(timerPollIntervals[endpoint])
//       timerPollIntervals[endpoint] = null
//   }

//   // --- SOCKET: Tasmota timer listeners (no change)
//   if (socket) {
//     socket.on('timer-snapshot', (timers) => {
//       Object.keys(timerStates).forEach(k => { delete timerStates[k]; });
//       for (const endpoint in timers) {
//         timerStates[endpoint] = timers[endpoint];
//         console.log("what is each endpoint? ", endpoint)
//       }
//     });

//     socket.on('timer-update', ({ device, endTime, running, remainingMs }) => {
//       console.log("this is useDeviceTimers.js, reporting in with device: ", device)
//       const endpoint = device
//       if (!endpoint) return

//       // Only update endTime if provided by server; else, keep existing
//       timerStates[endpoint] = {
//         ...timerStates[endpoint],
//         running: !!running,
//         endTime: (typeof endTime !== 'undefined' && endTime !== null)
//           ? endTime
//           : (timerStates[endpoint]?.endTime ?? null),
//         countdown: remainingMs ? Math.ceil(remainingMs / 1000) : 0,
//       }
//       console.log("is this where timerStates fulls?", timerStates)

//       if (!running) {
//         clearInterval(timerPollIntervals[endpoint])
//         timerPollIntervals[endpoint] = null
//       }
//     })

//     // --- SMART TIMER SOCKET LISTENERS ---
//     // Real-time: always up-to-date with the server/db!

//     // When a SmartTimer is updated/changed (add/update/remove)
//     socket.on('smart-timer-update', (timer) => {
//       if (['pending', 'running', 'paused'].includes(timer.state)) {
//         smartTimerStates[timer.id] = timer;
//       } else {
//         // Remove finished/canceled timers from state
//         delete smartTimerStates[timer.id];
//       }
//     });

//     // On connect/reconnect: server sends all current SmartTimers (active)
//     socket.on('smart-timer-snapshot', (timersArray) => {
//       Object.keys(smartTimerStates).forEach(id => { delete smartTimerStates[id]; });
//       timersArray.forEach(timer => {
//         smartTimerStates[timer.id] = timer;
//       });
//     });
//   }

//   socket.on('device-status', ({ endpoint, state }) => {
//     console.log("what is state: ", state);
//     deviceStates[endpoint] = state;
//   });

//   const timerDisplays = computed(() => {
//     const out = {}
//     for (const endpoint in timerStates) {
//       const ts = timerStates[endpoint]
//       let seconds = 0
//       if (ts && ts.running && ts.endTime) {
//         const remaining = ts.endTime - now.value
//         seconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0
//       }
//       out[endpoint] = mmss(seconds)
//     }
//     return out
//   })

//   // ---- SMART TIMER API ----
//   // Expose smartTimerStates and helpers for the UI
//   const smartTimerDisplays = computed(() => {
//     const out = {}
//     for (const id in smartTimerStates) {
//       const timer = smartTimerStates[id]
//       let seconds = 0
//       if (timer && timer.state === 'running' && timer.end_time) {
//         const remaining = new Date(timer.end_time).getTime() - now.value
//         seconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0
//       } else if (timer && timer.duration) {
//         seconds = timer.duration
//       }
//       out[id] = mmss(seconds)
//     }
//     return out
//   })

//   const visibleSmartTimers = computed(() =>
//     Object.values(smartTimerStates).filter(
//       t => ['pending', 'paused', 'running'].includes(t.state)
//     )
//   );

//   function getSmartTimerDisplay(timer) {
//     if (!timer.end_time || timer.state !== 'running') {
//       return mmss(timer.duration)
//     }
//     const remaining = Math.max(0, Math.ceil((new Date(timer.end_time).getTime() - now.value) / 1000))
//     return mmss(remaining)
//   }

//   // --- Return API, everything Tasmota + SmartTimer unified ---
//   return {
//     timerStates,
//     timerDisplays,
//     deviceStates,
//     startTimer,
//     addToTimer,
//     cancelTimer,
//     fetchAndSync,

//     // SMART TIMER EXPORTS:
//     smartTimerStates,
//     smartTimerDisplays,
//     visibleSmartTimers,
//     getSmartTimerDisplay,
//   }
// }
