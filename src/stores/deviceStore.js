// frontend/src/stores/deviceStore.js

let cachedDevices = null
let cachedMeta = null
let cachedAt = 0

export default {
  async getDevices(frontendFetch) {
    // If we have a cached value less than 1 hour old, reuse it
    const ONE_HOUR = 60 * 60 * 1000
    const HOURS = 168
    const TTL = ONE_HOUR * HOURS
    if (cachedDevices && Date.now() - cachedAt < TTL) {
      return { devices: cachedDevices, meta: cachedMeta }
    }

    // Otherwise fetch from backend
    const res = await frontendFetch(`/api/tasmota/devices`, { cache: 'no-store' })
    const map = await res.json()

    if (!map) return { devices: [], meta: null }

    // Transform like before
    const devices = Object.entries(map)
      .filter(([key, device]) => !key.startsWith('_') && device.verified)
      .map(([key, device]) => ({
        ...device,
        endpoint: key.toLowerCase().replace(/\s+/g, ''),
        label: device.label || key
      }))

    const meta = map._meta || {}

    // Cache results in memory
    cachedDevices = devices
    cachedMeta = meta
    cachedAt = Date.now()

    return { devices, meta }
  },

  clearCache() {
    cachedDevices = null
    cachedMeta = null
    cachedAt = 0
  }
}
