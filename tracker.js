const els = {
  garrucha: document.getElementById("trackerGarrucha"),
  schedule: document.getElementById("trackerSchedule"),
  toggle: document.getElementById("toggleTracking"),
  secureStatus: document.getElementById("secureStatus"),
  status: document.getElementById("trackingStatus"),
  dot: document.getElementById("trackingDot"),
  accuracy: document.getElementById("gpsAccuracy"),
  offset: document.getElementById("routeOffset"),
  progress: document.getElementById("routeProgress"),
  lastSent: document.getElementById("lastSent"),
  message: document.getElementById("trackerMessage"),
};

let watchId = null;
let lastUploadAt = 0;
let sending = false;

function localDate() {
  const value = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function setMessage(message, error = false) {
  els.message.textContent = message;
  els.message.classList.toggle("error", error);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No fue posible conectar con el servidor.");
  return body;
}

function populateGarruchas() {
  for (let id = 1; id <= 9; id += 1) {
    const option = document.createElement("option");
    option.value = String(id);
    option.textContent = `Garrucha ${id}`;
    els.garrucha.appendChild(option);
  }
}

async function loadSchedules() {
  els.schedule.disabled = true;
  els.schedule.replaceChildren();
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Seleccion automatica";
  els.schedule.appendChild(automatic);
  try {
    const body = await request(`/api/tracking/assignments?garruchaId=${encodeURIComponent(els.garrucha.value)}&date=${localDate()}`);
    for (const schedule of body.schedules) {
      const option = document.createElement("option");
      option.value = String(schedule.id);
      option.textContent = `${schedule.start_time}  ${schedule.origin_label} -> ${schedule.destination_label}`;
      els.schedule.appendChild(option);
    }
    if (body.schedules.length === 1) els.schedule.selectedIndex = 1;
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    els.schedule.disabled = watchId !== null;
  }
}

function statusLabel(status) {
  return {
    moving: "En movimiento",
    stopped: "Detenida",
    delayed: "Con retraso",
    waiting: "Esperando salida",
    at_destination: "En destino",
    completed: "Ruta terminada",
    off_route: "GPS fuera de ruta",
    poor_signal: "Senal GPS debil",
    no_schedule: "Sin ruta asignada",
  }[status] || "Transmitiendo";
}

async function sendPosition(position) {
  const now = Date.now();
  if (sending || now - lastUploadAt < 3000) return;
  sending = true;
  lastUploadAt = now;
  try {
    const body = await request("/api/tracking/locations", {
      method: "POST",
      body: JSON.stringify({
        garruchaId: Number(els.garrucha.value),
        scheduleId: els.schedule.value ? Number(els.schedule.value) : null,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp,
      }),
    });
    const reading = body.reading;
    els.accuracy.textContent = `${Math.round(reading.accuracy_m)} m`;
    els.offset.textContent = reading.distance_to_route_m === null ? "-" : `${Math.round(reading.distance_to_route_m)} m`;
    els.progress.textContent = reading.progress_pct === null ? "-" : `${Math.round(reading.progress_pct)}%`;
    els.lastSent.textContent = formatTime(reading.received_ts);
    els.status.textContent = statusLabel(reading.movement_status);
    setMessage(reading.origin_label
      ? `${reading.origin_label} -> ${reading.destination_label}`
      : "La ubicacion se recibe, pero no hay una ruta programada asignada.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    sending = false;
  }
}

function locationError(error) {
  const message = error.code === 1
    ? "El iPhone no autorizo el acceso a la ubicacion."
    : "No fue posible obtener una posicion GPS estable.";
  setMessage(message, true);
}

function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  els.toggle.textContent = "Iniciar seguimiento";
  els.toggle.classList.remove("active");
  els.garrucha.disabled = false;
  els.schedule.disabled = false;
  els.dot.classList.remove("active");
  els.status.textContent = "Detenido";
}

function startTracking() {
  if (!window.isSecureContext) {
    setMessage("El seguimiento GPS del iPhone requiere abrir esta pagina mediante HTTPS.", true);
    return;
  }
  if (!navigator.geolocation) {
    setMessage("Este dispositivo no ofrece geolocalizacion.", true);
    return;
  }
  watchId = navigator.geolocation.watchPosition(sendPosition, locationError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15_000,
  });
  els.toggle.textContent = "Detener seguimiento";
  els.toggle.classList.add("active");
  els.garrucha.disabled = true;
  els.schedule.disabled = true;
  els.dot.classList.add("active");
  els.status.textContent = "Buscando GPS";
  setMessage("Esperando la primera posicion del iPhone...");
}

function init() {
  populateGarruchas();
  els.secureStatus.textContent = window.isSecureContext ? "Conexion segura" : "Se requiere HTTPS en el iPhone";
  els.garrucha.addEventListener("change", loadSchedules);
  els.toggle.addEventListener("click", () => {
    if (watchId === null) startTracking();
    else stopTracking();
  });
  window.addEventListener("pagehide", stopTracking);
  loadSchedules();
}

init();
