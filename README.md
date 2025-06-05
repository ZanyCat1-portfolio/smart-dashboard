# Smart Switch Dashboard

A real-time, multi-device smart switch dashboard built with **Vue 3** (frontend) and **Express.js** (backend), supporting local and cloud devices, real-time UI updates, and flexible device grouping.

---

## Features

- **Vue 3 + Vite** frontend (SPA, hot reload)
- **Express.js** backend API and proxy
- **WebSocket (socket.io)** for real-time state sync
- **Demo/Example mode**: In-memory, safe for testing
- **Tasmota support**: Local polling, toggle, and timers (works on LAN)
- **Govee support**: Explicit On/Off via Govee Cloud API
- **Responsive UI** with light/dark mode
- **Device timers**: Set, add, cancel timers; live countdown for all users
- **Group view**: Devices grouped by type, expandable/collapsible

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm
- Docker (optional but recommended for production or demo deployment)

### Install dependencies (local/dev)

    npm install

### Development (hot reload)

Run both the Vue frontend and Express backend together:

    npm run dev:full

- Frontend: http://localhost:5173
- Backend/API: http://localhost:8080

### Build (production)

Build the frontend:

    npm run build

---

## Docker Deployment

This project is designed to work with Docker.  
You can build and deploy the dashboard to run at the **root** of a domain, or at a **subdirectory** (e.g. `/smart-dashboard/`).  
**Set the base path at build time** using the `VITE_BASE_PATH` build argument.

**To build for a subdirectory:**

    docker build --build-arg VITE_BASE_PATH=/smart-dashboard/ -t yourname/smart-dashboard-demo .

**To build for root:**

    docker build --build-arg VITE_BASE_PATH=/ -t yourname/smart-dashboard-home .

> If you do **not** set `VITE_BASE_PATH`, it defaults to `/` (root).

Deploy and run the image as needed for your setup (see example systemd/nginx configs in this repo).

---

## Device Support

- **Tasmota**: Toggle, Timer, Status (real or demo)
- **Govee**: On/Off (requires API key)
- **Demo mode**: Safe, in-memory devices for UI testing

To add or edit devices, update `public/devices.json`.

**Example:**

    {
      "Living Room Lamp": {
        "ip": "192.168.0.42",
        "type": "tasmota",
        "verified": true,
        "label": "Living Room Stand Light",
        "example": true
      },
      "Desk LED Strip": {
        "device": "ABC123",
        "model": "H6104",
        "type": "govee",
        "verified": true,
        "label": "Desk LEDs"
      }
    }

> **Note:**  
> `"example": true` marks a device as a demo/simulated device (no real hardware needed).

---

## API Endpoints (summary)

- `/api/devices` – List all devices

**Demo devices:**
- `/api/example/:device/status` – Get state (demo)
- `/api/example/:device/on|off|toggle` – Set state (demo)
- `/api/example/:device/timer` – Set/add/cancel timer (demo)

**Tasmota devices:**
- `/api/:device/status` – Get Tasmota device state
- `/api/:device/on|off|toggle` – Set Tasmota device state
- `/api/:device/timer` – Set/add/cancel Tasmota timer
- `/api/:device/timer/status` – Get Tasmota timer state

**Govee devices:**
- `/api/govee/:device/on|off` – Set Govee device state

> When running in a subdirectory, **all endpoints are relative to the base path**.  
> For example, `/api/devices` → `/smart-dashboard/api/devices` if deployed under `/smart-dashboard/`.

---

## Notes

- Demo devices require no hardware or API keys.
- Govee devices require a Govee Developer API Key (.env file containing GOVEE_API_KEY=000aa000-00aa-00a0-00a0-0aaa00a00a0a).
- Tasmota devices must be accessible on the LAN (default expects `/cm?cmnd=...` API).
- Edit or add devices in `public/devices.json`. Changes are hot-reloaded.
- **If you deploy in a subdirectory, be sure to build the Docker image with the correct `VITE_BASE_PATH`!**

---

## Nginx and Socket.IO

If using Nginx as a reverse proxy, be sure to include a location block for `/socket.io/` to avoid 404s and ensure websocket connections work:

    location /socket.io/ {
        proxy_pass http://localhost:8075/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

If you see 404s for `/socket.io/` but live updates work, these can generally be ignored.

---

## Using This Project for Your Own Smart Home

The hosted demo version of Smart Switch Dashboard is for **demonstration only**—it runs in “example mode” with no real hardware and does **not** require an MQTT server.

**To use this project to control real Tasmota devices (or any other MQTT-enabled device) in your home:**

1. **You must have a running [Mosquitto](https://mosquitto.org/) MQTT broker.**
   - You can run this as a separate Docker container, system service, or directly on your server.
   - Example (as a Docker container):

         docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto:2

2. **Launch the dashboard container with the correct environment variables to connect to your MQTT broker.**
   - Example Docker run command:

         docker run -d \
           --name smart-dashboard \
           --network <your-docker-network> \
           -e MQTT_URL=mqtt://mosquitto:1883 \
           -e NODE_ENV=production \
           -v /path/to/your/devices.json:/app/public/devices.json:rw \
           yourname/smart-dashboard-home

3. **Edit `devices.json` to point to your real device IPs or identifiers.**
   - Devices with `"example": true` are fake/demo; real devices need valid `"ip"`, `"device"`, etc.

4. **Make sure your Tasmota or Govee devices are accessible and configured for your LAN and/or Govee API.**

**In summary:**  
- _Demo mode_: No Mosquitto required; in-memory, simulated devices only.
- _Production/home mode_: Mosquitto **required** for LAN device control.

---

## License

MIT

