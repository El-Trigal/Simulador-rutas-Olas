import { calculatePlannerRoute, displayPlannerRoute, getPlannerEntities } from "./app.js";

const EXCLUDED_BLOCKS = new Set(["0", "36", "52", "53", "54", "55"]);
const GARRUCHA_COLORS = [
  "#d13f3f",
  "#2563c7",
  "#27845b",
  "#d97706",
  "#7c4db3",
  "#087f8c",
  "#c23b88",
  "#9a6b16",
  "#52606d",
];
const MINUTES_PER_HOUR = 60;
const state = {
  config: {
    safetyMarginMinutes: 3,
    dwellMinutes: 10,
    operatingStartTime: "05:00",
    operatingEndTime: "18:00",
  },
  garruchas: [],
  schedules: [],
  preview: null,
  editingId: null,
};

const els = {
  tabs: [...document.querySelectorAll(".workspace-tab")],
  panels: [...document.querySelectorAll(".panel-view")],
  scheduleDate: document.getElementById("scheduleDate"),
  agendaDate: document.getElementById("agendaDate"),
  agendaTitle: document.getElementById("agendaTitle"),
  workspace: document.querySelector(".workspace"),
  agendaPanel: document.querySelector(".agenda-panel"),
  toggleAgenda: document.getElementById("toggleAgenda"),
  exportAgenda: document.getElementById("exportAgenda"),
  scheduleGarrucha: document.getElementById("scheduleGarrucha"),
  scheduleOrigin: document.getElementById("scheduleOrigin"),
  scheduleDestination: document.getElementById("scheduleDestination"),
  scheduleTime: document.getElementById("scheduleTime"),
  scheduleSpeed: document.getElementById("scheduleSpeed"),
  scheduleNotes: document.getElementById("scheduleNotes"),
  previewSchedule: document.getElementById("previewSchedule"),
  saveSchedule: document.getElementById("saveSchedule"),
  schedulePreview: document.getElementById("schedulePreview"),
  scheduleFeedback: document.getElementById("scheduleFeedback"),
  cancelEdit: document.getElementById("cancelEdit"),
  cancelProgram: document.getElementById("cancelProgram"),
  duplicateSchedule: document.getElementById("duplicateSchedule"),
  garruchaList: document.getElementById("garruchaList"),
  timeline: document.getElementById("timeline"),
};

function garruchaColor(id) {
  return GARRUCHA_COLORS[(Number(id) - 1) % GARRUCHA_COLORS.length];
}

function localDate(value = new Date()) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function currentTime() {
  const value = new Date();
  value.setMinutes(Math.ceil(value.getMinutes() / 5) * 5, 0, 0);
  const currentMinutes = value.getHours() * MINUTES_PER_HOUR + value.getMinutes();
  const startMinutes = timeToMinutes(state.config.operatingStartTime);
  const latestDefault = timeToMinutes(state.config.operatingEndTime) - 30;
  return minutesToTime(Math.max(startMinutes, Math.min(currentMinutes, latestDefault)));
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} s`;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours} h ${remainder} min`;
}

function formatMeters(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
}

function timeFromTimestamp(timestamp) {
  const value = new Date(timestamp);
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function selectPanel(panelId) {
  for (const panel of els.panels) {
    const active = panel.id === panelId;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  }
  for (const tab of els.tabs) tab.classList.toggle("active", tab.dataset.panel === panelId);
}

function entityValue(type, id) {
  return `${type}:${id}`;
}

function parseEntityValue(value) {
  const separator = value.indexOf(":");
  return { type: value.slice(0, separator), id: value.slice(separator + 1) };
}

function populateEntities() {
  const { blocks, posts } = getPlannerEntities();
  const usableBlocks = blocks.filter((block) => !EXCLUDED_BLOCKS.has(block.id));
  for (const select of [els.scheduleOrigin, els.scheduleDestination]) {
    select.replaceChildren();
    const blockGroup = document.createElement("optgroup");
    blockGroup.label = "Bloques";
    for (const block of usableBlocks) {
      const option = document.createElement("option");
      option.value = entityValue("block", block.id);
      option.textContent = block.label;
      blockGroup.appendChild(option);
    }
    const postGroup = document.createElement("optgroup");
    postGroup.label = "Poscosechas";
    for (const post of posts) {
      const option = document.createElement("option");
      option.value = entityValue("post", post.id);
      option.textContent = post.label;
      postGroup.appendChild(option);
    }
    select.append(blockGroup, postGroup);
  }
  if (els.scheduleDestination.options.length > 1) els.scheduleDestination.selectedIndex = 1;
}

function populateGarruchas() {
  els.scheduleGarrucha.replaceChildren();
  for (const garrucha of state.garruchas) {
    const option = document.createElement("option");
    option.value = String(garrucha.id);
    option.textContent = garrucha.name;
    els.scheduleGarrucha.appendChild(option);
  }
  updateScheduleSpeed();
  renderGarruchaSettings();
}

function selectedGarrucha() {
  return state.garruchas.find((item) => item.id === Number(els.scheduleGarrucha.value));
}

function updateScheduleSpeed() {
  const garrucha = selectedGarrucha();
  els.scheduleSpeed.textContent = garrucha ? `${garrucha.speed_m_min} m/min` : "-";
  state.preview = null;
}

function renderGarruchaSettings() {
  els.garruchaList.replaceChildren();
  for (const garrucha of state.garruchas) {
    const row = document.createElement("div");
    row.className = "garrucha-row";
    const label = document.createElement("label");
    label.htmlFor = `garruchaSpeed${garrucha.id}`;
    label.textContent = garrucha.name;
    const input = document.createElement("input");
    input.id = `garruchaSpeed${garrucha.id}`;
    input.type = "number";
    input.min = "1";
    input.max = "350";
    input.step = "1";
    input.value = String(garrucha.speed_m_min);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Guardar";
    button.addEventListener("click", async () => {
      const result = await request(`/api/garruchas/${garrucha.id}`, {
        method: "PUT",
        body: JSON.stringify({ speed: Number(input.value) }),
      });
      if (!result.ok) {
        input.setCustomValidity(result.body.error || "Velocidad invalida.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      const index = state.garruchas.findIndex((item) => item.id === garrucha.id);
      state.garruchas[index] = result.body.garrucha;
      updateScheduleSpeed();
      button.textContent = "Guardada";
      setTimeout(() => { button.textContent = "Guardar"; }, 1200);
    });
    row.append(label, input, button);
    els.garruchaList.appendChild(row);
  }
}

function buildPreview() {
  const garrucha = selectedGarrucha();
  if (!garrucha) throw new Error("Selecciona una garrucha.");
  const origin = parseEntityValue(els.scheduleOrigin.value);
  const destination = parseEntityValue(els.scheduleDestination.value);
  const route = calculatePlannerRoute(origin.type, origin.id, destination.type, destination.id, garrucha.speed_m_min);
  displayPlannerRoute(route, garruchaColor(garrucha.id));
  const start = new Date(`${els.scheduleDate.value}T${els.scheduleTime.value}:00`);
  if (!Number.isFinite(start.getTime())) throw new Error("Selecciona fecha y hora.");
  const arrival = new Date(start.getTime() + route.timeMinutes * 60_000);
  const available = new Date(arrival.getTime() + state.config.dwellMinutes * 60_000);
  const operatingStart = new Date(`${els.scheduleDate.value}T${state.config.operatingStartTime}:00`);
  const operatingEnd = new Date(`${els.scheduleDate.value}T${state.config.operatingEndTime}:00`);
  if (start < operatingStart || available > operatingEnd) {
    throw new Error(`La ruta debe iniciar desde las ${state.config.operatingStartTime} y finalizar antes de las ${state.config.operatingEndTime}.`);
  }
  state.preview = { route, garrucha, origin, destination };
  els.schedulePreview.textContent = `${route.origin.label} -> ${route.destination.label} | ${formatMeters(route.cableDistance)} | llegada ${timeFromTimestamp(arrival.getTime())} | disponible ${timeFromTimestamp(available.getTime())}`;
  return state.preview;
}

function schedulePayload() {
  const preview = state.preview || buildPreview();
  const { route, garrucha } = preview;
  return {
    excludeId: state.editingId,
    date: els.scheduleDate.value,
    startTime: els.scheduleTime.value,
    garruchaId: garrucha.id,
    originType: route.origin.type,
    originId: route.origin.id,
    originLabel: route.origin.label,
    destinationType: route.destination.type,
    destinationId: route.destination.id,
    destinationLabel: route.destination.label,
    speed: route.speed,
    distanceM: route.cableDistance,
    travelMinutes: route.timeMinutes,
    dwellMinutes: state.config.dwellMinutes,
    routeCoords: route.cableCoords,
    segments: route.segments,
    notes: els.scheduleNotes.value.trim(),
  };
}

function clearFeedback() {
  els.scheduleFeedback.className = "schedule-feedback";
  els.scheduleFeedback.replaceChildren();
}

function showFeedback(message, type = "", suggestion = null) {
  clearFeedback();
  els.scheduleFeedback.classList.toggle("success", type === "success");
  els.scheduleFeedback.classList.toggle("error", type === "error");
  const text = document.createElement("div");
  text.textContent = message;
  els.scheduleFeedback.appendChild(text);
  if (suggestion) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";
    button.textContent = `Usar ${suggestion.time}`;
    button.addEventListener("click", () => {
      els.scheduleDate.value = suggestion.date;
      els.agendaDate.value = suggestion.date;
      els.scheduleTime.value = suggestion.time;
      state.preview = null;
      previewAndCheck();
    });
    els.scheduleFeedback.appendChild(button);
  }
}

async function previewAndCheck() {
  try {
    clearFeedback();
    state.preview = null;
    buildPreview();
    const result = await request("/api/schedules/check", { method: "POST", body: JSON.stringify(schedulePayload()) });
    if (result.ok) {
      showFeedback(`Horario disponible. Margen de seguridad: ${state.config.safetyMarginMinutes} min.`, "success");
      return true;
    }
    showFeedback(result.body.conflicts?.map((item) => item.message).join(" ") || "Horario no disponible.", "error", result.body.suggestion);
    return false;
  } catch (error) {
    showFeedback(error.message, "error");
    return false;
  }
}

async function saveSchedule() {
  try {
    state.preview = null;
    buildPreview();
    const payload = schedulePayload();
    const url = state.editingId ? `/api/schedules/${state.editingId}` : "/api/schedules";
    const method = state.editingId ? "PUT" : "POST";
    const result = await request(url, { method, body: JSON.stringify(payload) });
    if (!result.ok) {
      showFeedback(result.body.conflicts?.map((item) => item.message).join(" ") || result.body.error || "No fue posible guardar.", "error", result.body.suggestion);
      return;
    }
    showFeedback(state.editingId ? "Programación actualizada." : "Ruta programada.", "success");
    resetEditor(false);
    els.agendaDate.value = payload.date;
    await loadSchedules(payload.date);
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

function resetEditor(clearMessage = true) {
  state.editingId = null;
  state.preview = null;
  els.saveSchedule.textContent = "Programar";
  els.cancelEdit.hidden = true;
  els.cancelProgram.hidden = true;
  els.duplicateSchedule.hidden = true;
  els.scheduleNotes.value = "";
  if (clearMessage) clearFeedback();
}

async function loadSchedules(date = els.agendaDate.value) {
  const result = await request(`/api/schedules?date=${encodeURIComponent(date)}`);
  if (!result.ok) {
    els.timeline.innerHTML = `<div class="empty-agenda">${result.body.error || "No se pudo cargar la agenda."}</div>`;
    return;
  }
  state.schedules = result.body.schedules;
  renderTimeline();
}

function minuteOfDay(timestamp) {
  const value = new Date(timestamp);
  return value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
}

function renderTimeline() {
  els.timeline.replaceChildren();
  els.agendaTitle.textContent = `${state.schedules.filter((item) => item.status !== "cancelled").length} rutas`;
  const inner = document.createElement("div");
  inner.className = "timeline-inner";
  const hours = document.createElement("div");
  hours.className = "timeline-hours";
  const corner = document.createElement("div");
  corner.className = "timeline-corner";
  corner.textContent = "Garrucha";
  const hourTrack = document.createElement("div");
  hourTrack.className = "hour-track";
  const operatingStart = timeToMinutes(state.config.operatingStartTime);
  const operatingEnd = timeToMinutes(state.config.operatingEndTime);
  const timelineMinutes = operatingEnd - operatingStart;
  for (let minute = operatingStart; minute <= operatingEnd; minute += MINUTES_PER_HOUR) {
    const label = document.createElement("span");
    label.className = "hour-label";
    label.style.left = `${minute - operatingStart}px`;
    label.textContent = minutesToTime(minute);
    hourTrack.appendChild(label);
  }
  hours.append(corner, hourTrack);
  inner.appendChild(hours);

  for (const garrucha of state.garruchas) {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const label = document.createElement("div");
    label.className = "timeline-label";
    const marker = document.createElement("i");
    marker.className = "garrucha-marker";
    marker.style.backgroundColor = garruchaColor(garrucha.id);
    label.append(marker, garrucha.name);
    const track = document.createElement("div");
    track.className = "schedule-track";
    for (const schedule of state.schedules.filter((item) => item.garrucha_id === garrucha.id)) {
      const start = minuteOfDay(schedule.start_ts) - operatingStart;
      const duration = Math.max(1, (schedule.end_ts - schedule.start_ts) / 60_000);
      if (start >= timelineMinutes || start + duration <= 0) continue;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `schedule-card ${schedule.displayStatus}`;
      card.style.setProperty("--garrucha-color", garruchaColor(garrucha.id));
      const visibleStart = Math.max(0, start);
      card.style.left = `${visibleStart}px`;
      card.style.width = `${Math.max(22, Math.min(duration - Math.max(0, -start), timelineMinutes - visibleStart))}px`;
      card.textContent = `${schedule.start_time} ${schedule.origin_label} -> ${schedule.destination_label}`;
      card.title = `${schedule.garrucha_name}: ${schedule.origin_label} -> ${schedule.destination_label}\n${schedule.start_time} - ${timeFromTimestamp(schedule.end_ts)}`;
      card.addEventListener("click", () => editSchedule(schedule));
      track.appendChild(card);
    }
    row.append(label, track);
    inner.appendChild(row);
  }
  els.timeline.appendChild(inner);
}

function editSchedule(schedule) {
  selectPanel("scheduleView");
  state.editingId = schedule.id;
  els.scheduleDate.value = schedule.service_date;
  els.scheduleGarrucha.value = String(schedule.garrucha_id);
  els.scheduleOrigin.value = entityValue(schedule.origin_type, schedule.origin_id);
  els.scheduleDestination.value = entityValue(schedule.destination_type, schedule.destination_id);
  els.scheduleTime.value = schedule.start_time;
  els.scheduleNotes.value = schedule.notes || "";
  els.saveSchedule.textContent = "Guardar cambios";
  els.cancelEdit.hidden = false;
  els.cancelProgram.hidden = schedule.status === "cancelled";
  els.duplicateSchedule.hidden = false;
  updateScheduleSpeed();
  try {
    const route = calculatePlannerRoute(schedule.origin_type, schedule.origin_id, schedule.destination_type, schedule.destination_id, schedule.speed_m_min);
    displayPlannerRoute(route, garruchaColor(schedule.garrucha_id));
    state.preview = { route, garrucha: selectedGarrucha() };
    els.schedulePreview.textContent = `${schedule.origin_label} -> ${schedule.destination_label} | ${formatMeters(schedule.distance_m)} | ${schedule.start_time} - ${timeFromTimestamp(schedule.end_ts)}`;
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

async function cancelCurrentSchedule() {
  if (!state.editingId) return;
  const result = await request(`/api/schedules/${state.editingId}/cancel`, { method: "PATCH", body: "{}" });
  if (!result.ok) {
    showFeedback(result.body.error || "No fue posible cancelar.", "error");
    return;
  }
  const date = els.scheduleDate.value;
  resetEditor(false);
  showFeedback("Programación cancelada.", "success");
  await loadSchedules(date);
}

function duplicateCurrentSchedule() {
  state.editingId = null;
  els.saveSchedule.textContent = "Programar copia";
  els.cancelEdit.hidden = false;
  els.cancelProgram.hidden = true;
  els.duplicateSchedule.hidden = true;
  showFeedback("Cambia la fecha u hora y guarda la copia.", "success");
}

function setAgendaCollapsed(collapsed) {
  els.workspace.classList.toggle("agenda-collapsed", collapsed);
  els.agendaPanel.classList.toggle("collapsed", collapsed);
  els.toggleAgenda.setAttribute("aria-expanded", String(!collapsed));
  els.toggleAgenda.setAttribute("aria-label", collapsed ? "Desplegar agenda" : "Plegar agenda");
  els.toggleAgenda.title = collapsed ? "Desplegar agenda" : "Plegar agenda";
  localStorage.setItem("agenda-collapsed", collapsed ? "1" : "0");
}

function bindEvents() {
  for (const tab of els.tabs) tab.addEventListener("click", () => selectPanel(tab.dataset.panel));
  els.toggleAgenda.addEventListener("click", () => setAgendaCollapsed(!els.agendaPanel.classList.contains("collapsed")));
  els.scheduleGarrucha.addEventListener("change", updateScheduleSpeed);
  for (const control of [els.scheduleOrigin, els.scheduleDestination, els.scheduleDate, els.scheduleTime]) {
    control.addEventListener("change", () => { state.preview = null; clearFeedback(); });
  }
  els.previewSchedule.addEventListener("click", previewAndCheck);
  els.saveSchedule.addEventListener("click", saveSchedule);
  els.cancelEdit.addEventListener("click", () => resetEditor());
  els.cancelProgram.addEventListener("click", cancelCurrentSchedule);
  els.duplicateSchedule.addEventListener("click", duplicateCurrentSchedule);
  els.agendaDate.addEventListener("change", () => {
    els.scheduleDate.value = els.agendaDate.value;
    loadSchedules();
  });
  els.exportAgenda.addEventListener("click", () => {
    window.location.href = `/api/schedules/export?date=${encodeURIComponent(els.agendaDate.value)}`;
  });
  els.scheduleDate.addEventListener("change", () => {
    els.agendaDate.value = els.scheduleDate.value;
    loadSchedules();
  });
}

async function init() {
  const today = localDate();
  els.scheduleDate.value = today;
  els.agendaDate.value = today;
  bindEvents();
  const requestedPanel = new URLSearchParams(window.location.search).get("panel");
  if (requestedPanel && els.panels.some((panel) => panel.id === requestedPanel)) selectPanel(requestedPanel);
  setAgendaCollapsed(localStorage.getItem("agenda-collapsed") === "1");

  const [configResult, garruchaResult] = await Promise.all([request("/api/config"), request("/api/garruchas")]);
  if (!configResult.ok || !garruchaResult.ok) {
    showFeedback("No se pudo iniciar el programador.", "error");
    return;
  }
  state.config = { ...state.config, ...configResult.body };
  els.scheduleTime.min = state.config.operatingStartTime;
  els.scheduleTime.max = state.config.operatingEndTime;
  els.scheduleTime.value = currentTime();
  state.garruchas = garruchaResult.body.garruchas;
  populateGarruchas();

  if (!getPlannerEntities().blocks.length) {
    await new Promise((resolve) => window.addEventListener("route-planner-ready", resolve, { once: true }));
  }
  populateEntities();
  await loadSchedules(today);
  setInterval(() => loadSchedules(els.agendaDate.value), 60_000);
}

init().catch((error) => showFeedback(error.message, "error"));
