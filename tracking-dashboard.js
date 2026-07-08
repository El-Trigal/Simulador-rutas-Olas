const SVG_NS = "http://www.w3.org/2000/svg";
const COLORS = ["#d13f3f", "#2563c7", "#27845b", "#d97706", "#7c4db3", "#087f8c", "#c23b88", "#9a6b16", "#52606d"];

const els = {
  list: document.getElementById("trackingList"),
  summary: document.getElementById("trackingSummary"),
  markerLayer: document.getElementById("trackingLayer"),
  routeLayer: document.getElementById("trackingRouteLayer"),
};

function colorFor(id) {
  return COLORS[(Number(id) - 1) % COLORS.length];
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function makeSvg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

function linePath(points) {
  if (!points?.length) return "";
  return `M ${points[0][0]} ${-points[0][1]} ${points.slice(1).map((point) => `L ${point[0]} ${-point[1]}`).join(" ")}`;
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
    offline: "Sin conexion",
  }[status] || "Sin datos";
}

function minutesLabel(value) {
  if (!Number.isFinite(value) || value < 0.5) return "A tiempo";
  return `${Math.round(value)} min de retraso`;
}

function stoppedLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 60) return "Sin detencion";
  const minutes = Math.floor(seconds / 60);
  return `Detenida ${minutes} min`;
}

function lastSeenLabel(timestamp) {
  if (!timestamp) return "Sin lecturas";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Ahora";
  if (seconds < 60) return `Hace ${seconds} s`;
  return `Hace ${Math.floor(seconds / 60)} min`;
}

function renderMap(items) {
  clear(els.markerLayer);
  clear(els.routeLayer);
  for (const item of items.filter((entry) => entry.online)) {
    const color = colorFor(item.garrucha_id);
    if (item.routeCoords?.length > 1) {
      els.routeLayer.appendChild(makeSvg("path", {
        d: linePath(item.routeCoords),
        class: "tracking-route",
        stroke: color,
      }));
    }
    if (!Number.isFinite(item.snapped_x) || !Number.isFinite(item.snapped_y)) continue;
    const group = makeSvg("g", { class: `tracking-marker status-${item.movement_status}` });
    const halo = makeSvg("circle", { cx: item.snapped_x, cy: -item.snapped_y, r: 12, class: "tracking-marker-halo", fill: color });
    const marker = makeSvg("circle", { cx: item.snapped_x, cy: -item.snapped_y, r: 6.5, class: "tracking-marker-core", fill: color });
    const label = makeSvg("text", {
      x: item.snapped_x,
      y: -item.snapped_y - 13,
      class: "tracking-marker-label",
      "text-anchor": "middle",
    });
    label.textContent = `G${item.garrucha_id}`;
    const title = makeSvg("title");
    title.textContent = `${item.garrucha_name}: ${statusLabel(item.movement_status)}`;
    group.append(halo, marker, label, title);
    els.markerLayer.appendChild(group);
  }
}

function metric(label, value) {
  const wrapper = document.createElement("span");
  const name = document.createElement("small");
  const result = document.createElement("strong");
  name.textContent = label;
  result.textContent = value;
  wrapper.append(name, result);
  return wrapper;
}

function renderList(items) {
  clear(els.list);
  const connected = items.filter((item) => item.online).length;
  els.summary.textContent = `${connected} conectada${connected === 1 ? "" : "s"}`;
  for (const item of items) {
    const card = document.createElement("article");
    card.className = `tracking-card status-${item.movement_status}`;
    card.style.setProperty("--garrucha-color", colorFor(item.garrucha_id));

    const header = document.createElement("div");
    header.className = "tracking-card-header";
    const identity = document.createElement("strong");
    identity.textContent = item.garrucha_name;
    const status = document.createElement("span");
    status.textContent = statusLabel(item.movement_status);
    header.append(identity, status);

    const route = document.createElement("p");
    route.textContent = item.origin_label ? `${item.origin_label} -> ${item.destination_label}` : "Sin ruta activa";

    const metrics = document.createElement("div");
    metrics.className = "tracking-card-metrics";
    metrics.append(
      metric("Avance", Number.isFinite(item.progress_pct) ? `${Math.round(item.progress_pct)}%` : "-"),
      metric("Operacion", item.movement_status === "stopped" ? stoppedLabel(item.stopped_seconds) : minutesLabel(item.delay_minutes)),
      metric("GPS", Number.isFinite(item.accuracy_m) ? `${Math.round(item.accuracy_m)} m` : "-"),
      metric("Lectura", lastSeenLabel(item.received_ts)),
    );
    card.append(header, route, metrics);
    els.list.appendChild(card);
  }
}

async function refreshTracking() {
  try {
    const response = await fetch("/api/tracking/live", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No fue posible cargar el seguimiento.");
    renderList(body.garruchas);
    renderMap(body.garruchas);
  } catch (error) {
    els.summary.textContent = "Sin conexion";
    els.list.textContent = error.message;
  }
}

refreshTracking();
setInterval(refreshTracking, 3000);
