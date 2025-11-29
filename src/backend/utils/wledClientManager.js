const { WLEDClient } = require('wled-client');

/**
 * WLED Client Manager - Provides real-time state synchronization for WLED devices
 * Uses WebSocket push notifications, similar to MQTT for Tasmota devices
 */
class WledClientManager {
  constructor(io) {
    this.io = io;
    this.wledClients = new Map(); // deviceId -> WLED client instance
    this.connectedDevices = new Map(); // deviceId -> { ip, endpoint, lastState }
    this.stateMonitors = new Map(); // deviceId -> monitoring interval
    console.log('[WLED Client] Manager initialized');
  }

  /**
   * Connect to a WLED device and monitor state changes
   */
  async connectDevice(deviceId, endpoint, ip) {
    try {
      console.log(`[WLED Client] Connecting to ${endpoint} at ${ip}`);

      // Create WLED client instance
      const wledClient = new WLEDClient(ip);

      // Initialize the client (connects to both JSON API and WebSocket)
      await wledClient.init();

      // Store the connection
      this.wledClients.set(deviceId, wledClient);
      this.connectedDevices.set(deviceId, { ip, endpoint, lastState: null });

      console.log(`[WLED Client] Successfully connected to ${endpoint}`);

      // Start monitoring state changes
      this.startStateMonitoring(deviceId, endpoint, wledClient);

    } catch (error) {
      console.error(`[WLED Client] Failed to connect to ${endpoint}:`, error.message);
      // Don't throw - allow the system to continue without this device
    }
  }

  /**
   * Start monitoring a device's state for changes
   */
  startStateMonitoring(deviceId, endpoint, wledClient) {
    const monitorInterval = setInterval(() => {
      try {
        // WLEDClient automatically keeps state updated via WebSocket
        const currentState = wledClient.state;
        const deviceState = currentState.on ? 'on' : 'off';

        const deviceInfo = this.connectedDevices.get(deviceId);
        const lastState = deviceInfo?.lastState;

        // Only emit if state actually changed
        if (deviceState !== lastState) {
          console.log(`[WLED Client] ${endpoint} state changed from ${lastState} to ${deviceState}`);
          this.io.emit('device-status', { endpoint, state: deviceState });

          // Update last state
          deviceInfo.lastState = deviceState;
          this.connectedDevices.set(deviceId, deviceInfo);
        }
      } catch (error) {
        console.warn(`[WLED Client] Error monitoring state for ${deviceId}:`, error.message);
      }
    }, 500); // Check for changes every 500ms

    this.stateMonitors.set(deviceId, monitorInterval);

    // Clean up monitoring when connection closes
    wledClient.on('disconnected', () => {
      console.log(`[WLED Client] Disconnected from ${endpoint}, stopping monitoring`);
      clearInterval(monitorInterval);
      this.stateMonitors.delete(deviceId);
    });
  }

  /**
   * Disconnect from a WLED device
   */
  disconnectDevice(deviceId) {
    const client = this.wledClients.get(deviceId);
    if (client) {
      console.log(`[WLED Client] Disconnecting from ${deviceId}`);
      client.disconnect();
      this.wledClients.delete(deviceId);
      this.connectedDevices.delete(deviceId);
    }
  }

  /**
   * Control a WLED device state
   */
  async setDeviceState(deviceId, state) {
    const client = this.wledClients.get(deviceId);
    if (!client) {
      throw new Error(`No WLED client connection for device ${deviceId}`);
    }

    try {
      await client.setState({ on: state === 'on' });
      console.log(`[WLED Client] Sent state ${state} to ${deviceId}`);
    } catch (error) {
      console.error(`[WLED Client] Failed to set state for ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current state of a WLED device
   */
  async getDeviceState(deviceId) {
    const client = this.wledClients.get(deviceId);
    if (!client) {
      throw new Error(`No WLED client connection for device ${deviceId}`);
    }

    try {
      const state = await client.getState();
      return state;
    } catch (error) {
      console.error(`[WLED Client] Failed to get state for ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a device is connected
   */
  isDeviceConnected(deviceId) {
    return this.wledClients.has(deviceId);
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Disconnect all devices and clean up
   */
  async disconnectAll() {
    console.log('[WLED Client] Disconnecting all devices...');

    for (const [deviceId, client] of this.wledClients) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`[WLED Client] Error disconnecting ${deviceId}:`, error.message);
      }
    }

    this.wledClients.clear();
    this.connectedDevices.clear();
    console.log('[WLED Client] All devices disconnected');
  }
}

module.exports = WledClientManager;
