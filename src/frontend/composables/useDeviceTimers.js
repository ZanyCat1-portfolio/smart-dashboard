import { reactive, computed, ref } from 'vue'

const now = ref(Date.now())
setInterval(() => { now.value = Date.now() }, 1000)

const timerStates = reactive({})
const deviceStates = reactive({})

function mmss(sec) {
  if (!sec || sec <= 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getTimerApiPrefix(device) {
  if (device.example === true) {
    if (device.type === 'wled-controller') {
      return 'example-wled'
    }
    if (device.type === 'tasmota') {
      return 'example-tasmota'
    }
    if (device.type === 'govee') {
      return 'example-govee'
    }
    return 'example'
  }

  if (device.type === 'wled-controller') {
    return 'wled'
  }
  if (device.type === 'tasmota') {
    return 'tasmota'
  }
  if (device.type === 'govee') {
    return 'govee'
  }
  return 'tasmota' // fallback
}

export function useDeviceTimers({ socket }) {
  async function startTimer(device, minutes) {
    const prefix = getTimerApiPrefix(device)
    const url = `/api/${prefix}/${device.endpoint}/timer`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })
      if (!response.ok) throw new Error('Timer start failed')
      const result = await response.json()
      // Update local timer state
      timerStates[device.endpoint] = {
        running: true,
        endTime: result.endTime
      }
    } catch (error) {
      console.error('Timer start failed:', error)
      throw error
    }
  }

  async function addToTimer(device, minutes) {
    await startTimer(device, minutes) // WLED API handles adding to existing timer
  }

  async function cancelTimer(device) {
    const prefix = getTimerApiPrefix(device)
    const url = `/api/${prefix}/${device.endpoint}/timer`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 0 })
      })
      if (!response.ok) throw new Error('Timer cancel failed')
      // Clear local timer state
      timerStates[device.endpoint] = { running: false, endTime: null }
    } catch (error) {
      console.error('Timer cancel failed:', error)
      throw error
    }
  }

  // Socket listeners for real-time updates
  if (socket) {
    socket.on('timer-update', ({ device, endTime, running }) => {
      timerStates[device] = {
        running: !!running,
        endTime: endTime || null
      }
    })

    socket.on('device-status', ({ endpoint, state }) => {
      deviceStates[endpoint] = state
    })
  }

  const timerDisplays = computed(() => {
    const out = {}
    for (const endpoint in timerStates) {
      const ts = timerStates[endpoint]
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
    deviceStates,
    startTimer,
    addToTimer,
    cancelTimer
  }
}
