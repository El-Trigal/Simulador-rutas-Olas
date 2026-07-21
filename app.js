const SVG_NS = "http://www.w3.org/2000/svg";

const DATA_URLS = {
  blocks: "data/bloquesOriginalReal.geojson",
  cable: "data/CableviaOriginalReal.geojson",
  tractor: "data/viaTractor.geojson",
  posts: "data/PoscosechaOriginalReal.geojson",
  lakes: "legacy-data/Lagos%20y%20Construcciones.geojson",
};

const POST_DEFINITIONS = new Map([
  ["0", { id: "1", label: "Olas1" }],
  ["10", { id: "2", label: "Olas2" }],
]);

const MAX_ATTACHMENT_CANDIDATES = 24;
const ATTACHMENT_DISTANCE_PADDING = 220;
const ATTACHMENT_DISTANCE_FACTOR = 2.5;
const NODE_SNAP_TOLERANCE = 0.05;
const MIN_ZOOM_PERCENT = 120;
const MAX_ZOOM_PERCENT = 1000;
const CABLE_RULES = new Map([
  ["salidaposco", "exit:1"],
  ["entradaposco", "entry:1"],
  ["salidaposco2", "exit:2"],
  ["entradaposco2", "entry:2"],
  ["nousar", "blocked"],
]);

const NETWORK_CONFIGS = {
  cable: {
    key: "cable",
    label: "Garruchas",
    routeName: "cable via",
    postAccessRules: true,
    distanceFields: ["distancia", "Distancia", "DISTANCIA"],
  },
  tractor: {
    key: "tractor",
    label: "Tractor",
    routeName: "via de tractor",
    postAccessRules: false,
    distanceFields: ["Longitudes", "longitudes", "Longitud", "LONGITUD", "distancia", "Distancia", "DISTANCIA"],
  },
};

const FLOWER_CONFIGS = {
  pompon: { label: "Pompon", postId: "2", demandInput: "simPomponDemand", defaultDemand: 600000, cutterRate: 490 },
  spider: { label: "Spider", postId: "1", demandInput: "simSpiderDemand", defaultDemand: 450000, cutterRate: 450 },
  supermun: { label: "Supermun", postId: "1", demandInput: "simSupermunDemand", defaultDemand: 20000, cutterRate: 450 },
};

const BLOCK_MINUTES = 5;
const POST_MINUTES = 5;
const WORK_DAYS_PER_WEEK = 6;
const WORK_START_MINUTES = 6 * 60 + 15;
const BREAK_START_CLOCK_MINUTES = 11 * 60;
const BREAK_DURATION_MINUTES = 45;
const BREAK_START_WORK_MINUTES = BREAK_START_CLOCK_MINUTES - WORK_START_MINUTES;

const state = {
  mode: "block-block",
  data: null,
  blocks: [],
  posts: [],
  networkType: "cable",
  networks: {},
  bounds: null,
  view: null,
  standardViewWidth: null,
  route: null,
  simRoutes: [],
  planRows: [],
  useDailyBlockDemand: false,
  simulation: {
    vehicles: [],
    loads: [],
    cutterBlocks: [],
    cutterFrameKey: "__reset__",
    timeMinutes: 0,
    durationMinutes: 0,
    speedMultiplier: 10,
    running: false,
    frameId: null,
    lastFrameMs: null,
  },
  selected: {
    origin: null,
    destination: null,
  },
};

const els = {
  status: document.getElementById("dataStatus"),
  svg: document.getElementById("mapSvg"),
  hint: document.getElementById("mapHint"),
  lakeLayer: document.getElementById("lakeLayer"),
  blockLayer: document.getElementById("blockLayer"),
  cableLayer: document.getElementById("cableLayer"),
  tractorLayer: document.getElementById("tractorLayer"),
  postLayer: document.getElementById("postLayer"),
  routeLayer: document.getElementById("routeLayer"),
  connectorLayer: document.getElementById("connectorLayer"),
  cutterLayer: document.getElementById("cutterLayer"),
  simulationLayer: document.getElementById("simulationLayer"),
  labelLayer: document.getElementById("labelLayer"),
  originLabel: document.getElementById("originLabel"),
  destinationLabel: document.getElementById("destinationLabel"),
  originSelect: document.getElementById("originSelect"),
  destinationSelect: document.getElementById("destinationSelect"),
  speedLabel: document.getElementById("speedLabel"),
  speedInput: document.getElementById("speedInput"),
  speedRange: document.getElementById("speedRange"),
  routeButton: document.getElementById("routeButton"),
  metricCable: document.getElementById("metricCable"),
  metricTime: document.getElementById("metricTime"),
  routeSummary: document.getElementById("routeSummary"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  fitMap: document.getElementById("fitMap"),
  clearRoute: document.getElementById("clearRoute"),
  simFlowerSelect: document.getElementById("simFlowerSelect"),
  simBlockSelect: document.getElementById("simBlockSelect"),
  simBlockPlan: document.getElementById("simBlockPlan"),
  simDailyDemandToggle: document.getElementById("simDailyDemandToggle"),
  addPlanBlockButton: document.getElementById("addPlanBlockButton"),
  simPomponDemand: document.getElementById("simPomponDemand"),
  simSpiderDemand: document.getElementById("simSpiderDemand"),
  simSupermunDemand: document.getElementById("simSupermunDemand"),
  simBucketStems: document.getElementById("simBucketStems"),
  simWeeklyHours: document.getElementById("simWeeklyHours"),
  simGarruchas: document.getElementById("simGarruchas"),
  simWagons: document.getElementById("simWagons"),
  simBucketsPerWagon: document.getElementById("simBucketsPerWagon"),
  simCableSpeed: document.getElementById("simCableSpeed"),
  simTractors: document.getElementById("simTractors"),
  simTrailers: document.getElementById("simTrailers"),
  simBucketsPerTrailer: document.getElementById("simBucketsPerTrailer"),
  simTractorSpeed: document.getElementById("simTractorSpeed"),
  simDestinationMetric: document.getElementById("simDestinationMetric"),
  simDemandMetric: document.getElementById("simDemandMetric"),
  simDailyDemandMetric: document.getElementById("simDailyDemandMetric"),
  simHourlyDemandMetric: document.getElementById("simHourlyDemandMetric"),
  simBucketsMetric: document.getElementById("simBucketsMetric"),
  simCutMetric: document.getElementById("simCutMetric"),
  simMethodResults: document.getElementById("simMethodResults"),
  simPlayButton: document.getElementById("simPlayButton"),
  simResetButton: document.getElementById("simResetButton"),
  simPlaybackSpeed: document.getElementById("simPlaybackSpeed"),
  simPlaybackSpeedLabel: document.getElementById("simPlaybackSpeedLabel"),
  simClock: document.getElementById("simClock"),
  simPhaseText: document.getElementById("simPhaseText"),
  simCutterLive: document.getElementById("simCutterLive"),
  simCutterLiveTotal: document.getElementById("simCutterLiveTotal"),
};

function getProp(feature, names) {
  const props = feature?.properties || {};
  const byLower = new Map(Object.keys(props).map((key) => [key.toLowerCase(), props[key]]));
  for (const name of names) {
    const value = byLower.get(name.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cableRule(feature) {
  const value = String(getProp(feature, ["id"]) || "").trim().toLowerCase();
  return CABLE_RULES.get(value) || null;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function formatMeters(value) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${value.toFixed(value >= 100 ? 0 : 1)} m`;
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 1) return `${Math.round(value * 60)} s`;
  if (value < 60) return `${value.toFixed(1)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours} h ${minutes} min`;
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function makeSvg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function svgPoint(point) {
  return `${point[0]} ${-point[1]}`;
}

function linePath(points) {
  if (!points.length) return "";
  return `M ${svgPoint(points[0])} ${points.slice(1).map((point) => `L ${svgPoint(point)}`).join(" ")}`;
}

function polygonPathFromRings(rings) {
  return rings
    .filter((ring) => ring.length)
    .map((ring) => `M ${svgPoint(ring[0])} ${ring.slice(1).map((point) => `L ${svgPoint(point)}`).join(" ")} Z`)
    .join(" ");
}

function geometryPolygonPaths(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [polygonPathFromRings(cleanRings(geometry.coordinates))];
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygonPathFromRings(cleanRings(polygon)));
  }
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((child) => geometryPolygonPaths(child));
  }
  return [];
}

function geometryLinePaths(geometry) {
  return extractLineStrings(geometry).map((line) => linePath(line));
}

function cleanRings(rawRings) {
  return rawRings
    .map((ring) => ring.map((coord) => [Number(coord[0]), Number(coord[1])]).filter((point) => isFinitePoint(point)))
    .filter((ring) => ring.length >= 3);
}

function isFinitePoint(point) {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function addBounds(bounds, point) {
  if (!isFinitePoint(point)) return bounds;
  if (!bounds) {
    return { minX: point[0], minY: point[1], maxX: point[0], maxY: point[1] };
  }
  bounds.minX = Math.min(bounds.minX, point[0]);
  bounds.minY = Math.min(bounds.minY, point[1]);
  bounds.maxX = Math.max(bounds.maxX, point[0]);
  bounds.maxY = Math.max(bounds.maxY, point[1]);
  return bounds;
}

function boundsFromGeometry(geometry, bounds = null) {
  if (!geometry) return bounds;
  if (geometry.type === "Point") return addBounds(bounds, geometry.coordinates);
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    for (const coord of geometry.coordinates) bounds = addBounds(bounds, coord);
    return bounds;
  }
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    for (const part of geometry.coordinates) {
      for (const coord of part) bounds = addBounds(bounds, coord);
    }
    return bounds;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) bounds = addBounds(bounds, coord);
      }
    }
    return bounds;
  }
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) bounds = boundsFromGeometry(child, bounds);
  }
  return bounds;
}

function ringCentroid(ring) {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    twiceArea += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) return null;
  return {
    point: [cx / (3 * twiceArea), cy / (3 * twiceArea)],
    area: Math.abs(twiceArea / 2),
  };
}

function averagePoint(points) {
  if (!points.length) return null;
  const total = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function centroidOfGeometry(geometry) {
  if (!geometry) return null;
  const weighted = [];
  const fallback = [];

  function collect(geom) {
    if (!geom) return;
    if (geom.type === "Polygon") {
      const rings = cleanRings(geom.coordinates);
      if (rings[0]) {
        fallback.push(...rings[0]);
        const centroid = ringCentroid(stripClosingPoint(rings[0]));
        if (centroid) weighted.push(centroid);
      }
      return;
    }
    if (geom.type === "MultiPolygon") {
      for (const polygon of geom.coordinates) collect({ type: "Polygon", coordinates: polygon });
      return;
    }
    if (geom.type === "LineString" || geom.type === "MultiPoint") {
      for (const coord of geom.coordinates) fallback.push([Number(coord[0]), Number(coord[1])]);
      return;
    }
    if (geom.type === "MultiLineString") {
      for (const line of geom.coordinates) {
        for (const coord of line) fallback.push([Number(coord[0]), Number(coord[1])]);
      }
      return;
    }
    if (geom.type === "Point") {
      fallback.push([Number(geom.coordinates[0]), Number(geom.coordinates[1])]);
      return;
    }
    if (geom.type === "GeometryCollection") {
      for (const child of geom.geometries) collect(child);
    }
  }

  collect(geometry);
  if (weighted.length) {
    const area = weighted.reduce((sum, item) => sum + item.area, 0);
    return [
      weighted.reduce((sum, item) => sum + item.point[0] * item.area, 0) / area,
      weighted.reduce((sum, item) => sum + item.point[1] * item.area, 0) / area,
    ];
  }
  return averagePoint(fallback.filter(isFinitePoint));
}

function stripClosingPoint(points) {
  if (points.length > 2 && distance(points[0], points[points.length - 1]) < 1e-8) return points.slice(0, -1);
  return points;
}

function extractLineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") {
    const line = geometry.coordinates.map((coord) => [Number(coord[0]), Number(coord[1])]).filter(isFinitePoint);
    return line.length >= 2 ? [line] : [];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .map((line) => line.map((coord) => [Number(coord[0]), Number(coord[1])]).filter(isFinitePoint))
      .filter((line) => line.length >= 2);
  }
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((child) => extractLineStrings(child));
  }
  return [];
}

function prepareBlocks(featureCollection) {
  const groups = new Map();
  const features = featureCollection.features || [];

  for (const feature of features) {
    const blockValue = getProp(feature, ["bloque", "Bloque", "BLOQUE", "fid"]);
    const blockId = blockValue === null ? null : String(blockValue).trim();
    if (!blockId || blockId.toLowerCase() === "null") continue;

    const center = centroidOfGeometry(feature.geometry);
    if (!center) continue;

    if (!groups.has(blockId)) {
      groups.set(blockId, { id: blockId, label: `Bloque ${blockId}`, features: [], centerParts: [] });
    }
    const group = groups.get(blockId);
    group.features.push(feature);
    group.centerParts.push(center);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      center: averagePoint(group.centerParts),
      numericId: Number(group.id),
    }))
    .sort((a, b) => {
      if (Number.isFinite(a.numericId) && Number.isFinite(b.numericId)) return a.numericId - b.numericId;
      return a.id.localeCompare(b.id, "es", { numeric: true });
    });
}

function preparePosts(featureCollection) {
  return (featureCollection.features || [])
    .map((feature) => {
      const fid = String(getProp(feature, ["fid"]));
      const definition = POST_DEFINITIONS.get(fid);
      if (!definition) return null;
      return {
        id: definition.id,
        label: definition.label,
        feature,
        center: centroidOfGeometry(feature.geometry),
      };
    })
    .filter((item) => item?.center)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

function buildRouteNetwork(featureCollection, config = NETWORK_CONFIGS.cable) {
  const baseSegments = [];
  let featureIndex = 0;

  for (const feature of featureCollection.features || []) {
    const accessRule = config.postAccessRules ? cableRule(feature) : null;
    if (accessRule === "blocked") {
      featureIndex += 1;
      continue;
    }
    const lines = extractLineStrings(feature.geometry);
    const featureDistance = numberOrNull(getProp(feature, config.distanceFields));
    const lengths = lines.map((line) => {
      let length = 0;
      for (let i = 1; i < line.length; i += 1) length += distance(line[i - 1], line[i]);
      return length;
    });
    const totalEuclidean = lengths.reduce((sum, value) => sum + value, 0);

    lines.forEach((line, lineIndex) => {
      for (let i = 1; i < line.length; i += 1) {
        const a = line[i - 1];
        const b = line[i];
        const segmentLength = distance(a, b);
        if (segmentLength <= 0) continue;
        const weight =
          featureDistance && totalEuclidean > 0
            ? featureDistance * (segmentLength / totalEuclidean)
            : segmentLength;
        baseSegments.push({
          id: baseSegments.length,
          featureIndex,
          lineIndex,
          a,
          b,
          weight,
          accessRule,
          splits: [
            { t: 0, point: a },
            { t: 1, point: b },
          ],
        });
      }
    });
    featureIndex += 1;
  }

  addSegmentIntersections(baseSegments);
  return graphFromSegments(baseSegments, config);
}

function addSegmentIntersections(segments) {
  for (let i = 0; i < segments.length; i += 1) {
    const one = segments[i];
    for (let j = i + 1; j < segments.length; j += 1) {
      const two = segments[j];
      if (!bboxIntersects(one, two)) continue;
      const intersection = segmentIntersection(one.a, one.b, two.a, two.b);
      if (!intersection) continue;
      addSplit(one, intersection.t, intersection.point);
      addSplit(two, intersection.u, intersection.point);
    }
  }
}

function bboxIntersects(one, two) {
  const pad = 1e-7;
  const aMinX = Math.min(one.a[0], one.b[0]) - pad;
  const aMaxX = Math.max(one.a[0], one.b[0]) + pad;
  const aMinY = Math.min(one.a[1], one.b[1]) - pad;
  const aMaxY = Math.max(one.a[1], one.b[1]) + pad;
  const bMinX = Math.min(two.a[0], two.b[0]) - pad;
  const bMaxX = Math.max(two.a[0], two.b[0]) + pad;
  const bMinY = Math.min(two.a[1], two.b[1]) - pad;
  const bMaxY = Math.max(two.a[1], two.b[1]) + pad;
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinY <= bMaxY && aMaxY >= bMinY;
}

function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function segmentIntersection(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-10) return endpointIntersection(a, b, c, d);
  const cma = [c[0] - a[0], c[1] - a[1]];
  const t = cross(cma, s) / denominator;
  const u = cross(cma, r) / denominator;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  const clampedU = Math.max(0, Math.min(1, u));
  return {
    t: clampedT,
    u: clampedU,
    point: [a[0] + r[0] * clampedT, a[1] + r[1] * clampedT],
  };
}

function endpointIntersection(a, b, c, d) {
  const candidates = [
    [a, 0, pointT(a, c, d)],
    [b, 1, pointT(b, c, d)],
    [c, pointT(c, a, b), 0],
    [d, pointT(d, a, b), 1],
  ];
  for (const [point, t, u] of candidates) {
    if (t !== null && u !== null && distance(pointOnLine(a, b, t), pointOnLine(c, d, u)) < 0.05) {
      return { t, u, point };
    }
  }
  return null;
}

function pointT(point, a, b) {
  const length2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (length2 === 0) return null;
  const t = ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length2;
  if (t < -1e-7 || t > 1 + 1e-7) return null;
  const projected = pointOnLine(a, b, t);
  return distance(projected, point) < 0.05 ? Math.max(0, Math.min(1, t)) : null;
}

function pointOnLine(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function addSplit(segment, t, point) {
  if (!Number.isFinite(t) || t < -1e-9 || t > 1 + 1e-9) return;
  const clamped = Math.max(0, Math.min(1, t));
  if (segment.splits.some((split) => Math.abs(split.t - clamped) < 1e-7)) return;
  segment.splits.push({ t: clamped, point });
}

function graphFromSegments(segments, config = NETWORK_CONFIGS.cable) {
  const nodes = [];
  const nodeByKey = new Map();
  const adjacency = [];
  const edges = [];

  function nodeId(point) {
    const key = `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
    if (nodeByKey.has(key)) return nodeByKey.get(key);
    for (const node of nodes) {
      if (distance(node.point, point) <= NODE_SNAP_TOLERANCE) {
        nodeByKey.set(key, node.id);
        return node.id;
      }
    }
    const id = nodes.length;
    nodeByKey.set(key, id);
    nodes.push({ id, point: [point[0], point[1]] });
    adjacency.push([]);
    return id;
  }

  function addEdge(from, to, weight, points, segment) {
    if (from === to || weight <= 0) return;
    const resourceKey = edgeResourceKey(from, to);
    const edgeData = { sourceSegment: segment.id, accessRule: segment.accessRule, resourceKey };
    const forward = { from, to, weight, points, ...edgeData };
    const backward = { from: to, to: from, weight, points: [...points].reverse(), ...edgeData };
    adjacency[from].push(forward);
    adjacency[to].push(backward);
    edges.push(forward);
  }

  for (const segment of segments) {
    const splits = [...segment.splits].sort((a, b) => a.t - b.t);
    const unique = [];
    for (const split of splits) {
      if (!unique.length || Math.abs(split.t - unique[unique.length - 1].t) > 1e-7) unique.push(split);
    }
    for (let i = 1; i < unique.length; i += 1) {
      const prev = unique[i - 1];
      const next = unique[i];
      const from = nodeId(prev.point);
      const to = nodeId(next.point);
      addEdge(from, to, segment.weight * (next.t - prev.t), [prev.point, next.point], segment);
    }
  }

  return { nodes, adjacency, edges, sourceSegments: segments, config };
}

function edgeResourceKey(from, to) {
  return from < to ? `${from}:${to}` : `${to}:${from}`;
}

function candidateEdgeAttachments(point, network, options = {}) {
  const bestBySegment = new Map();
  for (const edge of network.edges) {
    if (options.edgeAllowed && !options.edgeAllowed(edge)) continue;
    const a = network.nodes[edge.from].point;
    const b = network.nodes[edge.to].point;
    const projection = projectPointToSegment(point, a, b);
    const dist = distance(point, projection.point);
    const segmentKey = edge.sourceSegment ?? `${edge.from}-${edge.to}`;
    const attachment = { edge, projection: projection.point, t: projection.t, distance: dist };
    const previous = bestBySegment.get(segmentKey);
    if (!previous || attachment.distance < previous.distance) bestBySegment.set(segmentKey, attachment);
  }

  const attachments = [...bestBySegment.values()].sort((a, b) => a.distance - b.distance);
  if (!attachments.length) return attachments;
  if (options.all) return attachments;

  const nearest = attachments[0].distance;
  const maxDistance = Math.max(nearest + ATTACHMENT_DISTANCE_PADDING, nearest * ATTACHMENT_DISTANCE_FACTOR);
  return attachments
    .filter((attachment) => attachment.distance <= maxDistance)
    .slice(0, MAX_ATTACHMENT_CANDIDATES);
}

function isBlock46(entity) {
  return entity?.type === "block" && String(entity.id).trim() === "46";
}

function requiredPostAccessRule(entity, network, role) {
  if (!network.config.postAccessRules || entity?.type !== "post") return null;
  return `${role === "origin" ? "exit" : "entry"}:${entity.id}`;
}

function routeAttachmentsForEntity(entity, network, role) {
  const requiredRule = requiredPostAccessRule(entity, network, role);
  const attachments = candidateEdgeAttachments(entity.center, network, {
    all: isBlock46(entity) || Boolean(requiredRule),
    edgeAllowed: (edge) => requiredRule ? edge.accessRule === requiredRule : !edge.accessRule,
  });
  return isBlock46(entity) || requiredRule ? attachments : attachments.slice(0, 1);
}

function routeAllowsEdge(network, edge, origin, destination) {
  if (!network.config.postAccessRules || !edge.accessRule) return true;
  if (edge.accessRule === `exit:${origin.type === "post" ? origin.id : ""}`) return true;
  return edge.accessRule === `entry:${destination.type === "post" ? destination.id : ""}`;
}

function projectPointToSegment(point, a, b) {
  const length2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (length2 === 0) return { point: a, t: 0 };
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length2),
  );
  return { point: pointOnLine(a, b, t), t };
}

function calculateRoute(origin, destination, speed) {
  const network = activeNetwork();
  const startAttachments = routeAttachmentsForEntity(origin, network, "origin");
  const endAttachments = routeAttachmentsForEntity(destination, network, "destination");
  if (!startAttachments.length || !endAttachments.length) throw new Error(`La red de ${network.config.routeName} no tiene tramos validos.`);

  const attempts = [];
  for (let startIndex = 0; startIndex < startAttachments.length; startIndex += 1) {
    for (let endIndex = 0; endIndex < endAttachments.length; endIndex += 1) {
      attempts.push({
        startAttach: startAttachments[startIndex],
        endAttach: endAttachments[endIndex],
        rank: startIndex + endIndex,
        distanceToCable: startAttachments[startIndex].distance + endAttachments[endIndex].distance,
      });
    }
  }
  attempts.sort((a, b) => a.rank - b.rank || a.distanceToCable - b.distanceToCable);

  let result = null;
  for (const attempt of attempts) {
    result = routeBetweenAttachments(network, attempt.startAttach, attempt.endAttach, origin, destination);
    if (result) break;
  }
  if (!result) throw new Error(`No se encontro una ruta conectada sobre la red de ${network.config.routeName}.`);

  const cableCoords = mergeLineParts(result.parts);
  const segments = routeOccupations(result.traversals, speed);

  return {
    origin,
    destination,
    speed,
    networkType: network.config.key,
    networkLabel: network.config.label,
    cableDistance: result.distance,
    timeMinutes: result.distance / speed,
    cableCoords,
    segments,
  };
}

function routeOccupations(traversals, speed) {
  const occupations = [];
  let elapsed = 0;
  for (const traversal of traversals) {
    const duration = traversal.weight / speed;
    const previous = occupations[occupations.length - 1];
    if (previous && previous.resourceKey === traversal.resourceKey) {
      previous.distanceM += traversal.weight;
      previous.offsetEndMinutes += duration;
    } else {
      occupations.push({
        resourceKey: traversal.resourceKey,
        sourceSegment: traversal.sourceSegment,
        accessRule: traversal.accessRule || null,
        distanceM: traversal.weight,
        offsetStartMinutes: elapsed,
        offsetEndMinutes: elapsed + duration,
      });
    }
    elapsed += duration;
  }
  return occupations;
}

function routeBetweenAttachments(network, startAttach, endAttach, origin, destination) {
  const baseCount = network.nodes.length;
  const startId = baseCount;
  const endId = baseCount + 1;
  const totalNodes = baseCount + 2;
  const extraAdj = new Map();

  function addExtra(from, to, weight, points, sourceEdge) {
    if (!extraAdj.has(from)) extraAdj.set(from, []);
    extraAdj.get(from).push({
      from,
      to,
      weight,
      points,
      sourceSegment: sourceEdge.sourceSegment,
      accessRule: sourceEdge.accessRule,
      resourceKey: sourceEdge.resourceKey || edgeResourceKey(sourceEdge.from, sourceEdge.to),
    });
  }

  function addTempConnections(tempId, attach) {
    const edge = attach.edge;
    const toFrom = edge.weight * attach.t;
    const toTo = edge.weight * (1 - attach.t);
    const fromPoint = network.nodes[edge.from].point;
    const toPoint = network.nodes[edge.to].point;
    addExtra(tempId, edge.from, toFrom, [attach.projection, fromPoint], edge);
    addExtra(edge.from, tempId, toFrom, [fromPoint, attach.projection], edge);
    addExtra(tempId, edge.to, toTo, [attach.projection, toPoint], edge);
    addExtra(edge.to, tempId, toTo, [toPoint, attach.projection], edge);
  }

  addTempConnections(startId, startAttach);
  addTempConnections(endId, endAttach);

  if (startAttach.edge === endAttach.edge) {
    const directWeight = startAttach.edge.weight * Math.abs(startAttach.t - endAttach.t);
    addExtra(startId, endId, directWeight, [startAttach.projection, endAttach.projection], startAttach.edge);
    addExtra(endId, startId, directWeight, [endAttach.projection, startAttach.projection], startAttach.edge);
  }

  return dijkstra(network, extraAdj, startId, endId, totalNodes, origin, destination);
}

function dijkstra(network, extraAdj, startId, endId, totalNodes, origin, destination) {
  const dist = Array(totalNodes).fill(Infinity);
  const prev = Array(totalNodes).fill(null);
  const prevEdge = Array(totalNodes).fill(null);
  const heap = new MinHeap();
  dist[startId] = 0;
  heap.push([0, startId]);

  while (heap.size()) {
    const [currentDist, node] = heap.pop();
    if (currentDist !== dist[node]) continue;
    if (node === endId) break;
    const baseEdges = network.adjacency[node] || [];
    const extraEdges = extraAdj.get(node) || [];
    for (const edge of [...baseEdges, ...extraEdges]) {
      if (!routeAllowsEdge(network, edge, origin, destination)) continue;
      const next = edge.to;
      const nextDist = currentDist + edge.weight;
      if (nextDist < dist[next]) {
        dist[next] = nextDist;
        prev[next] = node;
        prevEdge[next] = edge;
        heap.push([nextDist, next]);
      }
    }
  }

  if (!Number.isFinite(dist[endId])) return null;
  const parts = [];
  const traversals = [];
  for (let at = endId; at !== startId; at = prev[at]) {
    const edge = prevEdge[at];
    if (!edge) return null;
    parts.unshift(edge.points);
    traversals.unshift({
      resourceKey: edge.resourceKey,
      sourceSegment: edge.sourceSegment,
      accessRule: edge.accessRule || null,
      weight: edge.weight,
    });
  }
  return { distance: dist[endId], parts, traversals };
}

function mergeLineParts(parts) {
  const merged = [];
  for (const part of parts) {
    for (const point of part) {
      if (!merged.length || distance(merged[merged.length - 1], point) > 0.001) merged.push(point);
    }
  }
  return merged;
}

class MinHeap {
  constructor() {
    this.values = [];
  }

  size() {
    return this.values.length;
  }

  push(value) {
    this.values.push(value);
    this.bubbleUp(this.values.length - 1);
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length && last) {
      this.values[0] = last;
      this.sinkDown(0);
    }
    return first;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent][0] <= this.values[index][0]) break;
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }

  sinkDown(index) {
    for (;;) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;
      if (left < this.values.length && this.values[left][0] < this.values[smallest][0]) smallest = left;
      if (right < this.values.length && this.values[right][0] < this.values[smallest][0]) smallest = right;
      if (smallest === index) break;
      [this.values[smallest], this.values[index]] = [this.values[index], this.values[smallest]];
      index = smallest;
    }
  }
}

async function loadData() {
  const [blocks, cable, tractor, posts, lakes] = await Promise.all(
    Object.values(DATA_URLS).map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      return response.json();
    }),
  );

  state.data = { blocks, cable, tractor, posts, lakes };
  state.blocks = prepareBlocks(blocks);
  state.posts = preparePosts(posts);
  state.networks = {
    cable: buildRouteNetwork(cable, NETWORK_CONFIGS.cable),
    tractor: buildRouteNetwork(tractor, NETWORK_CONFIGS.tractor),
  };
  state.bounds = computeGlobalBounds([blocks, cable, tractor, posts, lakes]);

  if (!state.blocks.length) throw new Error("No hay bloques con campo Bloque/bloque.");
  if (!state.posts.length) throw new Error("No hay poscosechas validas.");
  if (!state.networks.cable.edges.length) throw new Error("No hay red de cable via valida.");
  if (!state.networks.tractor.edges.length) throw new Error("No hay red de tractor valida.");

  els.status.textContent = `${state.blocks.length} bloques, ${state.posts.length} poscosechas, ${state.networks.cable.edges.length} tramos cable via, ${state.networks.tractor.edges.length} tramos tractor`;
  fitToBounds();
  renderMap();
  populateSimulator();
}

function computeGlobalBounds(collections) {
  let bounds = null;
  for (const collection of collections) {
    for (const feature of collection.features || []) {
      bounds = boundsFromGeometry(feature.geometry, bounds);
    }
  }
  return bounds;
}

function fitToBounds() {
  const b = state.bounds;
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const pad = Math.max(width, height) * 0.06;
  const view = normalizeAspect({ minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad });
  state.standardViewWidth = view.maxX - view.minX;
  state.view = scaleView(view, 100 / MIN_ZOOM_PERCENT);
  updateViewBox();
}

function normalizeAspect(view) {
  const rect = els.svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return view;
  const desired = rect.width / rect.height;
  const width = view.maxX - view.minX;
  const height = view.maxY - view.minY;
  const current = width / height;
  const cx = (view.minX + view.maxX) / 2;
  const cy = (view.minY + view.maxY) / 2;
  if (current > desired) {
    const newHeight = width / desired;
    return { minX: view.minX, maxX: view.maxX, minY: cy - newHeight / 2, maxY: cy + newHeight / 2 };
  }
  const newWidth = height * desired;
  return { minX: cx - newWidth / 2, maxX: cx + newWidth / 2, minY: view.minY, maxY: view.maxY };
}

function setView(view) {
  state.view = clampViewZoom(normalizeAspect(view));
  updateViewBox();
}

function scaleView(view, factor) {
  const centerX = (view.minX + view.maxX) / 2;
  const centerY = (view.minY + view.maxY) / 2;
  const halfWidth = ((view.maxX - view.minX) * factor) / 2;
  const halfHeight = ((view.maxY - view.minY) * factor) / 2;
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  };
}

function clampViewZoom(view) {
  if (!state.standardViewWidth) return view;
  const width = view.maxX - view.minX;
  const percentage = (state.standardViewWidth / width) * 100;
  const clampedPercentage = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, percentage));
  if (Math.abs(clampedPercentage - percentage) < 0.001) return view;
  return scaleView(view, percentage / clampedPercentage);
}

function updateViewBox() {
  const view = state.view;
  if (!view) return;
  els.svg.setAttribute("viewBox", `${view.minX} ${-view.maxY} ${view.maxX - view.minX} ${view.maxY - view.minY}`);
}

function zoomAt(center, factor) {
  const view = state.view;
  const next = {
    minX: center[0] - (center[0] - view.minX) * factor,
    maxX: center[0] + (view.maxX - center[0]) * factor,
    minY: center[1] - (center[1] - view.minY) * factor,
    maxY: center[1] + (view.maxY - center[1]) * factor,
  };
  setView(next);
}

function svgClientToWorld(clientX, clientY) {
  const rect = els.svg.getBoundingClientRect();
  const sx = (clientX - rect.left) / rect.width;
  const sy = (clientY - rect.top) / rect.height;
  const view = state.view;
  const x = view.minX + sx * (view.maxX - view.minX);
  const svgY = -view.maxY + sy * (view.maxY - view.minY);
  return [x, -svgY];
}

function renderMap() {
  clearElement(els.lakeLayer);
  clearElement(els.blockLayer);
  clearElement(els.cableLayer);
  clearElement(els.tractorLayer);
  clearElement(els.postLayer);
  clearElement(els.cutterLayer);
  clearElement(els.labelLayer);
  state.simulation.cutterFrameKey = "__reset__";

  renderPolygonCollection(els.lakeLayer, state.data.lakes, "lake-shape");
  renderNetworkLines(els.cableLayer, state.data.cable, "cable-line");
  renderNetworkLines(els.tractorLayer, state.data.tractor, "tractor-line");
  renderBlocks();
  renderPosts();
  renderRoute();
}

function renderPolygonCollection(layer, collection, className) {
  for (const feature of collection.features || []) {
    for (const pathData of geometryPolygonPaths(feature.geometry)) {
      if (!pathData) continue;
      layer.appendChild(makeSvg("path", { d: pathData, class: `layer-path ${className}`, "fill-rule": "evenodd" }));
    }
  }
}

function renderNetworkLines(layer, collection, className) {
  for (const feature of collection.features || []) {
    for (const pathData of geometryLinePaths(feature.geometry)) {
      if (!pathData) continue;
      layer.appendChild(makeSvg("path", { d: pathData, class: `layer-path ${className}` }));
    }
  }
}

function renderBlocks() {
  const blockIdByFeature = new Map();
  for (const block of state.blocks) {
    for (const feature of block.features) blockIdByFeature.set(feature, block.id);
  }

  for (const feature of state.data.blocks.features || []) {
    const id = blockIdByFeature.get(feature);
    for (const pathData of geometryPolygonPaths(feature.geometry)) {
      if (!pathData) continue;
      const path = makeSvg("path", {
        d: pathData,
        class: `layer-path block-shape${id ? "" : " no-id"}`,
        "data-block-id": id || "",
        "fill-rule": "evenodd",
      });
      if (id) {
        path.addEventListener("click", (event) => {
          event.stopPropagation();
          pickEntity("block", id);
        });
      }
      els.blockLayer.appendChild(path);
    }
  }

  for (const block of state.blocks) {
    const text = makeSvg("text", {
      x: block.center[0],
      y: -block.center[1],
      class: "map-label",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    text.textContent = block.id;
    els.labelLayer.appendChild(text);
  }
  updateSelectionStyles();
}

function renderPosts() {
  for (const post of state.posts) {
    for (const pathData of geometryPolygonPaths(post.feature.geometry)) {
      if (!pathData) continue;
      const path = makeSvg("path", {
        d: pathData,
        class: "layer-path post-shape",
        "data-post-id": post.id,
        "fill-rule": "evenodd",
      });
      path.addEventListener("click", (event) => {
        event.stopPropagation();
        pickEntity("post", post.id);
      });
      els.postLayer.appendChild(path);
    }
    const text = makeSvg("text", {
      x: post.center[0],
      y: -post.center[1],
      class: "map-label",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    text.textContent = post.label;
    els.labelLayer.appendChild(text);
  }
  updateSelectionStyles();
}

function renderRoute() {
  clearElement(els.routeLayer);
  clearElement(els.connectorLayer);
  const routes = state.simRoutes.length ? state.simRoutes : (state.route ? [state.route] : []);
  for (const route of routes) {
    if (!route.cableCoords?.length) continue;
    const path = makeSvg("path", { d: linePath(route.cableCoords), class: "route-line" });
    if (route.routeColor) path.style.stroke = route.routeColor;
    els.routeLayer.appendChild(path);
  }
}
function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

function pointOnPolyline(points, fraction) {
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const total = polylineLength(points);
  if (total <= 0) return points[0];
  const target = total * Math.max(0, Math.min(1, fraction));
  let traveled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const segmentLength = distance(from, to);
    if (segmentLength <= 0) continue;
    if (traveled + segmentLength >= target) {
      return pointOnLine(from, to, (target - traveled) / segmentLength);
    }
    traveled += segmentLength;
  }
  return points[points.length - 1];
}

function buildSimulationVehicles(results) {
  return results.flatMap((result) =>
    (result.operatorTimelines || []).map((timeline, index) => ({
      id: `${result.networkType}-${index}`,
      label: `${result.operatorSingularLabel} ${index + 1}`,
      shortLabel: `${result.networkType === "tractor" ? "T" : "G"}${index + 1}`,
      networkType: result.networkType,
      color: result.routeColor,
      timeline,
      totalMinutes: result.dayWallMinutes || result.totalMinutes || 0,
    })),
  ).filter((vehicle) => vehicle.timeline.length > 0);
}

function buildSimulationLoads(results) {
  return results.flatMap((result) =>
    (result.loadTimelines || []).map((load, index) => ({
      id: `${result.networkType}-load-${index}`,
      networkType: result.networkType,
      color: result.routeColor,
      ...load,
    })),
  );
}

function buildSimulationCutterBlocks(cutterPlan) {
  const blocks = new Map();
  for (const entry of cutterPlan?.entries || []) {
    if (entry.workMinutes <= 0) continue;
    if (!blocks.has(entry.block.id)) {
      blocks.set(entry.block.id, {
        id: entry.block.id,
        label: entry.block.label,
        point: entry.block.center,
        index: entry.index,
        entries: [],
      });
    }
    blocks.get(entry.block.id).entries.push({
      flowerLabel: entry.flower.label,
      initialCutters: entry.initialCutters,
      transfers: entry.transfers,
      finishWorkMinutes: entry.finishWorkMinutes,
    });
  }
  return [...blocks.values()].sort((a, b) => a.index - b.index);
}

function cutterBlocksAt(workTime) {
  return state.simulation.cutterBlocks.map((block) => {
    let count = 0;
    let allFinished = true;
    for (const entry of block.entries) {
      const finished = workTime >= entry.finishWorkMinutes - 1e-6;
      if (finished) continue;
      allFinished = false;
      count += entry.initialCutters;
      for (const transfer of entry.transfers) {
        if (transfer.workMinutes <= workTime + 1e-6) count += transfer.added;
      }
    }
    return {
      ...block,
      count,
      status: count > 0 ? "active" : (allFinished ? "finished" : "waiting"),
      flowers: [...new Set(block.entries.map((entry) => entry.flowerLabel))].join(", "),
    };
  });
}

function renderCutterFrame(workTime) {
  const blocks = cutterBlocksAt(workTime);
  const frameKey = blocks.map((block) => `${block.id}:${block.count}:${block.status}`).join("|");
  if (frameKey === state.simulation.cutterFrameKey) return blocks;
  state.simulation.cutterFrameKey = frameKey;
  clearElement(els.cutterLayer);
  clearElement(els.simCutterLive);

  let activeCutters = 0;
  let activeBlocks = 0;
  for (const block of blocks) {
    activeCutters += block.count;
    if (block.count > 0) activeBlocks += 1;

    const label = makeSvg("text", {
      x: block.point[0],
      y: -block.point[1] + 14,
      class: `cutter-count-label ${block.status}`,
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    label.textContent = `C:${block.count}`;
    const title = makeSvg("title");
    title.textContent = `${block.label}: ${block.count} cortadores (${block.status === "active" ? "activo" : block.status === "waiting" ? "pendiente" : "finalizado"})`;
    label.appendChild(title);
    els.cutterLayer?.appendChild(label);

    if (els.simCutterLive) {
      const row = document.createElement("div");
      row.className = `cutter-live-row ${block.status}`;
      const blockName = document.createElement("span");
      blockName.textContent = block.label;
      const flowers = document.createElement("span");
      flowers.textContent = block.flowers;
      const count = document.createElement("strong");
      count.textContent = String(block.count);
      const status = document.createElement("small");
      status.textContent = block.status === "active" ? "Activo" : block.status === "waiting" ? "Pendiente" : "Finalizado";
      row.append(blockName, flowers, count, status);
      els.simCutterLive.appendChild(row);
    }
  }

  if (!blocks.length && els.simCutterLive) {
    const empty = document.createElement("div");
    empty.className = "cutter-live-empty";
    empty.textContent = "Sin plan calculado.";
    els.simCutterLive.appendChild(empty);
  }
  if (els.simCutterLiveTotal) {
    els.simCutterLiveTotal.textContent = blocks.length ? `${activeCutters} en ${activeBlocks} bloques` : "0 activos";
  }
  return blocks;
}

function simulationFrameForVehicle(vehicle, timeMinutes) {
  if (!vehicle.timeline.length) return { point: null, phase: "Sin viaje", loadState: "idle" };
  const segment = vehicle.timeline.find((item) => timeMinutes <= item.end) || vehicle.timeline[vehicle.timeline.length - 1];
  if (segment.type === "wait") return { point: segment.point, phase: segment.label, loadState: segment.loadState || "idle" };
  const duration = Math.max(0.0001, segment.end - segment.start);
  const progress = (Math.max(segment.start, Math.min(segment.end, timeMinutes)) - segment.start) / duration;
  return { point: pointOnPolyline(segment.points, progress), phase: segment.label, loadState: segment.loadState || "empty" };
}

function formatSimulationClock(value) {
  const totalMinutes = Math.round(WORK_START_MINUTES + Math.max(0, value));
  const hours = Math.floor((totalMinutes / 60) % 24);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function updatePlaybackUi() {
  const sim = state.simulation;
  const hasPlayback = sim.vehicles.length > 0 || sim.cutterBlocks.length > 0;
  if (els.simPlaybackSpeed) {
    sim.speedMultiplier = Math.max(1, Math.min(100, Number(els.simPlaybackSpeed.value) || 10));
    els.simPlaybackSpeed.value = String(sim.speedMultiplier);
    if (els.simPlaybackSpeedLabel) els.simPlaybackSpeedLabel.textContent = `${sim.speedMultiplier}x`;
  }
  if (els.simClock) els.simClock.textContent = formatSimulationClock(sim.timeMinutes);
  if (els.simPlayButton) {
    els.simPlayButton.textContent = sim.running ? "Pausar" : "Reproducir";
    els.simPlayButton.disabled = !hasPlayback;
  }
  if (els.simResetButton) els.simResetButton.disabled = !hasPlayback;
  if (els.simPhaseText) {
    if (!hasPlayback) {
      els.simPhaseText.textContent = "Calcula un viaje para reproducirlo.";
    } else {
      const activeVehicles = sim.vehicles
        .map((vehicle) => `${vehicle.label}: ${simulationFrameForVehicle(vehicle, sim.timeMinutes).phase}`)
        .slice(0, 3)
        .join(" | ");
      const cutterStates = cutterBlocksAt(wallToWorkMinutes(sim.timeMinutes));
      const activeCutters = cutterStates.reduce((sum, block) => sum + block.count, 0);
      const activeBlocks = cutterStates.filter((block) => block.count > 0).length;
      const cutterSummary = cutterStates.length ? `Corte: ${activeCutters} cortadores en ${activeBlocks} bloques` : "";
      const vehicleSummary = sim.vehicles.length > 3 ? `${activeVehicles} | ...` : activeVehicles;
      els.simPhaseText.textContent = [vehicleSummary, cutterSummary].filter(Boolean).join(" | ");
    }
  }
}

function renderSimulationFrame() {
  if (els.simulationLayer) {
    clearElement(els.simulationLayer);
    const time = state.simulation.timeMinutes;
    const workTime = wallToWorkMinutes(time);
    renderCutterFrame(workTime);
    for (const load of state.simulation.loads) {
      if (time < load.start || time > load.end) continue;
      const fillWindow = Math.max(0.0001, load.workReady - load.workStart);
      const progress = Math.max(0, Math.min(1, (workTime - load.workStart) / fillWindow));
      const group = makeSvg("g", {
        class: `simulation-load ${load.networkType}`,
        transform: `translate(${load.point[0]} ${-load.point[1]})`,
      });
      group.appendChild(makeSvg("rect", { x: -17, y: 10, width: 34, height: 9, rx: 3, class: "simulation-load-track" }));
      group.appendChild(makeSvg("rect", { x: -16, y: 11, width: 32 * progress, height: 7, rx: 2, class: "simulation-load-fill" }));
      const label = makeSvg("text", { x: 0, y: 8, class: "simulation-load-label", "text-anchor": "middle" });
      label.textContent = `${Math.round(progress * 100)}%`;
      group.appendChild(label);
      const title = makeSvg("title");
      title.textContent = load.label;
      group.appendChild(title);
      els.simulationLayer.appendChild(group);
    }
    for (const vehicle of state.simulation.vehicles) {
      const frame = simulationFrameForVehicle(vehicle, time);
      if (!frame.point) continue;
      const group = makeSvg("g", {
        class: `simulation-vehicle ${vehicle.networkType} ${frame.loadState || "idle"}`,
        transform: `translate(${frame.point[0]} ${-frame.point[1]})`,
      });
      group.appendChild(makeSvg("circle", { r: 15, class: "simulation-marker-halo", fill: vehicle.color }));
      const body = vehicle.networkType === "tractor"
        ? makeSvg("rect", { x: -8, y: -6, width: 16, height: 12, rx: 3, class: "simulation-marker-core", fill: vehicle.color })
        : makeSvg("circle", { r: 7, class: "simulation-marker-core", fill: vehicle.color });
      group.appendChild(body);
      const label = makeSvg("text", { x: 0, y: -18, class: "simulation-marker-label", "text-anchor": "middle" });
      const stateSuffix =
        frame.loadState === "loaded" ? "L"
        : frame.loadState === "empty" ? "V"
        : frame.loadState === "solo" ? "S"
        : frame.loadState === "swap" ? "M"
        : frame.loadState === "break" ? "D"
        : "P";
      label.textContent = `${vehicle.shortLabel}-${stateSuffix}`;
      group.appendChild(label);
      const title = makeSvg("title");
      title.textContent = `${vehicle.label}: ${frame.phase}`;
      group.appendChild(title);
      els.simulationLayer.appendChild(group);
    }
  }
  updatePlaybackUi();
}

function pauseSimulationPlayback() {
  const sim = state.simulation;
  if (sim.frameId) cancelAnimationFrame(sim.frameId);
  sim.running = false;
  sim.frameId = null;
  sim.lastFrameMs = null;
  updatePlaybackUi();
}

function resetSimulationPlayback() {
  pauseSimulationPlayback();
  state.simulation.timeMinutes = 0;
  renderSimulationFrame();
}

function clearSimulationPlayback() {
  pauseSimulationPlayback();
  state.simulation.vehicles = [];
  state.simulation.loads = [];
  state.simulation.cutterBlocks = [];
  state.simulation.cutterFrameKey = "__reset__";
  state.simulation.durationMinutes = 0;
  state.simulation.timeMinutes = 0;
  renderSimulationFrame();
}

function prepareSimulationPlayback(results, cutterPlan) {
  pauseSimulationPlayback();
  state.simulation.vehicles = buildSimulationVehicles(results);
  state.simulation.loads = buildSimulationLoads(results);
  state.simulation.cutterBlocks = buildSimulationCutterBlocks(cutterPlan);
  state.simulation.cutterFrameKey = "__reset__";
  const vehicleDuration = state.simulation.vehicles.reduce((max, vehicle) => Math.max(max, vehicle.totalMinutes), 0);
  const loadDuration = state.simulation.loads.reduce((max, load) => Math.max(max, load.end || 0), 0);
  const cutterDuration = workToWallEnd(cutterPlan?.finishWorkMinutes || 0);
  state.simulation.durationMinutes = Math.max(vehicleDuration, loadDuration, cutterDuration);
  state.simulation.timeMinutes = 0;
  renderSimulationFrame();
}

function stepSimulationPlayback(timestamp) {
  const sim = state.simulation;
  if (!sim.running) return;
  if (sim.lastFrameMs === null) {
    sim.lastFrameMs = timestamp;
    sim.frameId = requestAnimationFrame(stepSimulationPlayback);
    return;
  }
  const elapsedMs = Math.max(0, timestamp - sim.lastFrameMs);
  sim.lastFrameMs = timestamp;
  sim.timeMinutes = Math.min(sim.durationMinutes, sim.timeMinutes + (elapsedMs / 60000) * sim.speedMultiplier);
  renderSimulationFrame();
  if (sim.timeMinutes >= sim.durationMinutes) {
    pauseSimulationPlayback();
    return;
  }
  sim.frameId = requestAnimationFrame(stepSimulationPlayback);
}

function toggleSimulationPlayback() {
  const sim = state.simulation;
  if (!sim.vehicles.length && !sim.cutterBlocks.length) return;
  if (sim.running) {
    pauseSimulationPlayback();
    return;
  }
  if (sim.timeMinutes >= sim.durationMinutes) sim.timeMinutes = 0;
  sim.running = true;
  sim.lastFrameMs = null;
  sim.frameId = requestAnimationFrame(stepSimulationPlayback);
  updatePlaybackUi();
}

function pickEntity(type, id) {
  if (type === "block") {
    ensurePlanRows();
    state.planRows[0].blockId = id;
    renderPlanRows();
    calculateSimulation();
  }
}

function updateSelectionStyles() {
  document.querySelectorAll(".block-shape.selected,.post-shape.selected").forEach((element) => {
    element.classList.remove("selected");
  });
  const selectedBlockIds = new Set((state.planRows || []).map((row) => row.blockId).filter(Boolean));
  const selectedPostIds = new Set((state.planRows || []).map((row) => FLOWER_CONFIGS[row.flowerKey]?.postId).filter(Boolean));
  for (const item of [state.selected.origin, state.selected.destination]) {
    if (!item) continue;
    if (item.type === "block") selectedBlockIds.add(item.id);
    if (item.type === "post") selectedPostIds.add(item.id);
  }
  for (const id of selectedBlockIds) {
    document.querySelectorAll(`.block-shape[data-block-id="${CSS.escape(id)}"]`).forEach((element) => element.classList.add("selected"));
  }
  for (const id of selectedPostIds) {
    document.querySelectorAll(`.post-shape[data-post-id="${CSS.escape(id)}"]`).forEach((element) => element.classList.add("selected"));
  }
}


function readNumber(input, fallback = 0) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function readInteger(input, fallback = 0) {
  return Math.max(0, Math.floor(readNumber(input, fallback)));
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("es-CO");
}

function formatHours(value) {
  if (!Number.isFinite(value)) return "-";
  return value >= 100 ? `${value.toFixed(0)} h` : `${value.toFixed(1)} h`;
}

function selectedTransportMode() {
  return document.querySelector(".transport-button.active")?.dataset.transport || "cable";
}

function setTransportMode(mode) {
  document.querySelectorAll(".transport-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.transport === mode);
  });
}

function flowerKeys() {
  return Object.keys(FLOWER_CONFIGS);
}

function defaultBlockId() {
  return (state.blocks.find((block) => block.id === "1") || state.blocks[0])?.id || "";
}

function nextAvailableBlockId() {
  const used = new Set(state.planRows.map((row) => row.blockId));
  return (state.blocks.find((block) => !used.has(block.id)) || state.blocks[0])?.id || "";
}

function createPlanRow(blockId = null, flowerKey = "pompon") {
  return {
    id: `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    blockId: blockId || nextAvailableBlockId() || defaultBlockId(),
    flowerKey: FLOWER_CONFIGS[flowerKey] ? flowerKey : "pompon",
    dailyDemand: 0,
  };
}

function ensurePlanRows() {
  if (!state.planRows.length && state.blocks.length) state.planRows.push(createPlanRow(defaultBlockId(), "pompon"));
}

function addPlanRow(blockId = null, flowerKey = "pompon") {
  state.planRows.push(createPlanRow(blockId, flowerKey));
  renderPlanRows();
  calculateSimulation();
}

function weeklyDailyDemandForRow(row) {
  const flowerKey = FLOWER_CONFIGS[row.flowerKey] ? row.flowerKey : "pompon";
  const flower = FLOWER_CONFIGS[flowerKey];
  const count = Math.max(1, state.planRows.filter((item) => item.flowerKey === flowerKey).length);
  const weeklyDemand = Math.max(0, readNumber(els[flower.demandInput], flower.defaultDemand));
  return weeklyDemand / WORK_DAYS_PER_WEEK / count;
}

function seedDailyDemandFromWeekly() {
  for (const row of state.planRows) {
    const current = Number(row.dailyDemand);
    if (Number.isFinite(current) && current > 0) continue;
    row.dailyDemand = Math.round(weeklyDailyDemandForRow(row));
  }
}

function updateDailyDemandToggle() {
  if (!els.simDailyDemandToggle) return;
  els.simDailyDemandToggle.classList.toggle("active", state.useDailyBlockDemand);
  els.simDailyDemandToggle.textContent = state.useDailyBlockDemand
    ? "Usando tallos diarios por bloque"
    : "Usar tallos diarios por bloque";
}

function toggleDailyBlockDemand() {
  state.useDailyBlockDemand = !state.useDailyBlockDemand;
  if (state.useDailyBlockDemand) seedDailyDemandFromWeekly();
  renderPlanRows();
  calculateSimulation();
}

function renderPlanRows() {
  if (!els.simBlockPlan) return;
  ensurePlanRows();
  clearElement(els.simBlockPlan);
  updateDailyDemandToggle();
  state.planRows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = `block-plan-row ${state.useDailyBlockDemand ? "daily-demand-row" : ""}`;

    const order = document.createElement("div");
    order.className = "block-plan-index";
    order.textContent = String(index + 1);

    const blockField = document.createElement("label");
    blockField.className = "field compact";
    const blockLabel = document.createElement("span");
    blockLabel.textContent = "Bloque";
    const blockSelect = document.createElement("select");
    for (const block of state.blocks) {
      const option = document.createElement("option");
      option.value = block.id;
      option.textContent = block.label;
      blockSelect.appendChild(option);
    }
    blockSelect.value = row.blockId;
    blockSelect.addEventListener("change", () => {
      row.blockId = blockSelect.value;
      calculateSimulation();
      updateSelectionStyles();
    });
    blockField.append(blockLabel, blockSelect);

    const flowerField = document.createElement("label");
    flowerField.className = "field compact";
    const flowerLabel = document.createElement("span");
    flowerLabel.textContent = "Flor";
    const flowerSelect = document.createElement("select");
    for (const key of flowerKeys()) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = FLOWER_CONFIGS[key].label;
      flowerSelect.appendChild(option);
    }
    flowerSelect.value = row.flowerKey;
    flowerSelect.addEventListener("change", () => {
      row.flowerKey = flowerSelect.value;
      calculateSimulation();
      updateSelectionStyles();
    });
    flowerField.append(flowerLabel, flowerSelect);

    let dailyField = null;
    if (state.useDailyBlockDemand) {
      dailyField = document.createElement("label");
      dailyField.className = "field compact daily-demand-field";
      const dailyLabel = document.createElement("span");
      dailyLabel.textContent = "Tallos dia";
      const dailyInput = document.createElement("input");
      dailyInput.type = "number";
      dailyInput.min = "0";
      dailyInput.step = "1";
      dailyInput.value = String(Math.max(0, Math.round(Number(row.dailyDemand) || 0)));
      dailyInput.addEventListener("input", () => {
        row.dailyDemand = Math.max(0, Number(dailyInput.value) || 0);
        calculateSimulation();
      });
      dailyField.append(dailyLabel, dailyInput);
    }

    const removeButton = document.createElement("button");
    removeButton.className = "block-plan-remove";
    removeButton.type = "button";
    removeButton.textContent = "X";
    removeButton.title = "Quitar bloque";
    removeButton.disabled = state.planRows.length <= 1;
    removeButton.addEventListener("click", () => {
      state.planRows.splice(index, 1);
      renderPlanRows();
      calculateSimulation();
    });

    item.append(order, blockField, flowerField);
    if (dailyField) item.appendChild(dailyField);
    item.appendChild(removeButton);
    els.simBlockPlan.appendChild(item);
  });
}

function populateSimulator() {
  ensurePlanRows();
  renderPlanRows();
}

function selectedPlanRows() {
  ensurePlanRows();
  return state.planRows
    .map((row) => {
      const block = entityByTypeAndId("block", row.blockId);
      const flowerKey = FLOWER_CONFIGS[row.flowerKey] ? row.flowerKey : "pompon";
      const flower = FLOWER_CONFIGS[flowerKey];
      const post = entityByTypeAndId("post", flower.postId);
      const dailyDemand = state.useDailyBlockDemand ? Math.max(0, Number(row.dailyDemand) || 0) : null;
      return block && post ? { ...row, block, flowerKey, flower, post, dailyDemand } : null;
    })
    .filter(Boolean);
}

function demandPlanByFlower(planRows, weeklyHours = 0) {
  const counts = new Map();
  for (const row of planRows) counts.set(row.flowerKey, (counts.get(row.flowerKey) || 0) + 1);
  const dailyHours = weeklyHours / WORK_DAYS_PER_WEEK;
  const demandByFlower = new Map();
  const manualMode = state.useDailyBlockDemand;
  for (const [flowerKey, count] of counts) {
    const flower = FLOWER_CONFIGS[flowerKey];
    const rowsForFlower = planRows.filter((row) => row.flowerKey === flowerKey);
    const weeklyDemandInput = Math.max(0, readNumber(els[flower.demandInput], flower.defaultDemand));
    const dailyDemand = manualMode ? rowsForFlower.reduce((sum, row) => sum + Math.max(0, Number(row.dailyDemand) || 0), 0) : weeklyDemandInput / WORK_DAYS_PER_WEEK;
    const weeklyDemand = manualMode ? dailyDemand * WORK_DAYS_PER_WEEK : weeklyDemandInput;
    const cutterHoursWeek = flower.cutterRate > 0 ? weeklyDemand / flower.cutterRate : 0;
    const cutterHoursDay = flower.cutterRate > 0 ? dailyDemand / flower.cutterRate : 0;
    const cuttersWeek = weeklyHours > 0 ? cutterHoursWeek / weeklyHours : 0;
    const cuttersDay = dailyHours > 0 ? cutterHoursDay / dailyHours : 0;
    const perBlockDemand = count > 0 ? dailyDemand / count : 0;
    demandByFlower.set(flowerKey, { count, flower, weeklyDemand, dailyDemand, perBlockDemand, cutterHoursWeek, cutterHoursDay, cuttersWeek, cuttersDay, cuttersPerBlock: count > 0 ? cuttersDay / count : 0, stemsPerBlockHour: dailyHours > 0 ? perBlockDemand / dailyHours : 0, manualMode });
  }
  return demandByFlower;
}

function dailyDemandForPlanRow(row, demandByFlower) {
  if (state.useDailyBlockDemand) return Math.max(0, Number(row.dailyDemand) || 0);
  return demandByFlower.get(row.flowerKey)?.perBlockDemand || 0;
}

function buildCutterWorkforcePlan(planRows, demandByFlower, weeklyHours) {
  const dailyWorkMinutes = Math.max(0, weeklyHours / WORK_DAYS_PER_WEEK * 60);
  const entries = planRows.map((row, index) => {
    const demand = dailyDemandForPlanRow(row, demandByFlower);
    const workMinutes = row.flower.cutterRate > 0 ? demand / row.flower.cutterRate * 60 : 0;
    return {
      id: row.id,
      index,
      block: row.block,
      flower: row.flower,
      demand,
      workMinutes,
      remainingWorkMinutes: workMinutes,
      initialCutters: 0,
      currentCutters: 0,
      peakCutters: 0,
      finishWorkMinutes: 0,
      transfers: [],
    };
  });
  const activeEntries = entries.filter((entry) => entry.workMinutes > 0);
  const totalWorkMinutes = activeEntries.reduce((sum, entry) => sum + entry.workMinutes, 0);
  const equivalentCutters = dailyWorkMinutes > 0 ? totalWorkMinutes / dailyWorkMinutes : 0;
  const totalCutters = activeEntries.length
    ? Math.max(1, Math.ceil(equivalentCutters - 1e-9))
    : 0;

  for (const entry of activeEntries.slice(0, totalCutters)) {
    entry.initialCutters = 1;
    entry.currentCutters = 1;
    entry.peakCutters = 1;
  }

  function entryNeedingCutter(candidates) {
    const waitingEntry = candidates.find((entry) => entry.currentCutters === 0);
    if (waitingEntry) return waitingEntry;
    return candidates.reduce((best, entry) => {
      if (!best) return entry;
      const entryDuration = entry.remainingWorkMinutes / Math.max(1, entry.currentCutters);
      const bestDuration = best.remainingWorkMinutes / Math.max(1, best.currentCutters);
      return entryDuration > bestDuration + 1e-9 ? entry : best;
    }, null);
  }

  for (let remaining = totalCutters - Math.min(totalCutters, activeEntries.length); remaining > 0; remaining -= 1) {
    const entry = entryNeedingCutter(activeEntries);
    entry.initialCutters += 1;
    entry.currentCutters += 1;
    entry.peakCutters = Math.max(entry.peakCutters, entry.currentCutters);
  }

  let elapsed = 0;
  let unfinished = [...activeEntries];
  let guard = 0;
  while (unfinished.length && guard < 10000) {
    guard += 1;
    const cuttingEntries = unfinished.filter((entry) => entry.currentCutters > 0);
    const elapsedToNextFinish = Math.min(...cuttingEntries.map((entry) => entry.remainingWorkMinutes / entry.currentCutters));
    if (!Number.isFinite(elapsedToNextFinish)) break;
    elapsed += elapsedToNextFinish;
    for (const entry of unfinished) {
      entry.remainingWorkMinutes = Math.max(0, entry.remainingWorkMinutes - entry.currentCutters * elapsedToNextFinish);
    }

    const finished = cuttingEntries.filter((entry) => entry.remainingWorkMinutes <= 1e-6);
    let releasedCutters = 0;
    for (const entry of finished) {
      entry.finishWorkMinutes = elapsed;
      releasedCutters += entry.currentCutters;
      entry.currentCutters = 0;
    }
    unfinished = unfinished.filter((entry) => entry.remainingWorkMinutes > 1e-6);
    if (!unfinished.length) break;

    const transfersByEntry = new Map();
    for (let index = 0; index < releasedCutters; index += 1) {
      const recipient = entryNeedingCutter(unfinished);
      recipient.currentCutters += 1;
      recipient.peakCutters = Math.max(recipient.peakCutters, recipient.currentCutters);
      transfersByEntry.set(recipient, (transfersByEntry.get(recipient) || 0) + 1);
    }
    for (const [entry, added] of transfersByEntry) {
      entry.transfers.push({ workMinutes: elapsed, added, total: entry.currentCutters });
    }
  }

  return {
    entries,
    totalCutters,
    equivalentCutters,
    staffingEquivalent: equivalentCutters,
    totalWorkMinutes,
    initialCutters: activeEntries.reduce((sum, entry) => sum + entry.initialCutters, 0),
    transferredCutters: entries.reduce((sum, entry) => sum + entry.transfers.reduce((subtotal, transfer) => subtotal + transfer.added, 0), 0),
    transferMoments: entries.reduce((sum, entry) => sum + entry.transfers.length, 0),
    finishWorkMinutes: activeEntries.reduce((max, entry) => Math.max(max, entry.finishWorkMinutes), 0),
    dailyWorkMinutes,
    manualMode: state.useDailyBlockDemand,
  };
}

function routeForNetwork(origin, destination, speed, networkType) {
  const previousNetworkType = state.networkType;
  state.networkType = networkType;
  try {
    return calculateRoute(origin, destination, speed);
  } finally {
    state.networkType = previousNetworkType;
  }
}

function methodInputs(networkType, bucketStems, weeklyHours) {
  if (networkType === "tractor") {
    const units = Math.max(0, Math.min(2, readInteger(els.simTractors, 2)));
    const trailers = Math.min(7, Math.max(1, readInteger(els.simTrailers, 7)));
    const bucketsPerTrailer = Math.min(12, Math.max(1, readInteger(els.simBucketsPerTrailer, 12)));
    const bucketsPerTrip = trailers * bucketsPerTrailer;
    return {
      networkType,
      label: "Tractor",
      unitLabel: units === 1 ? "conductor" : "conductores",
      operatorLabel: "conductores",
      operatorSingularLabel: "Conductor",
      loadSetLabel: "serie de trailers",
      pairedSetLabel: "2 series de trailers",
      maxLoadSets: 4,
      routeColor: "#7a5b2b",
      units,
      speed: Math.max(1, readNumber(els.simTractorSpeed, 250)),
      bucketsPerTrip,
      stemsPerTrip: bucketsPerTrip * bucketStems,
      setsPerOperator: 2,
      weeklyHours,
    };
  }
  const units = Math.max(0, Math.min(9, readInteger(els.simGarruchas, 9)));
  const wagons = Math.min(13, Math.max(1, readInteger(els.simWagons, 13)));
  const bucketsPerWagon = Math.min(2, Math.max(1, readInteger(els.simBucketsPerWagon, 2)));
  const bucketsPerTrip = wagons * bucketsPerWagon;
  return {
    networkType: "cable",
    label: "Garruchas",
    unitLabel: units === 1 ? "garruchero" : "garrucheros",
    operatorLabel: "garrucheros",
    operatorSingularLabel: "Garruchero",
    loadSetLabel: "garrucha",
    pairedSetLabel: "2 garruchas",
    maxLoadSets: units * 2,
    routeColor: "#0677c8",
    units,
    speed: Math.max(1, readNumber(els.simCableSpeed, 55)),
    bucketsPerTrip,
    stemsPerTrip: bucketsPerTrip * bucketStems,
    setsPerOperator: 2,
    weeklyHours,
  };
}

function simulateMethod(origin, destination, demand, input) {
  if (input.units <= 0) throw new Error("No hay equipos activos para este metodo.");
  const route = routeForNetwork(origin, destination, input.speed, input.networkType);
  const travelMinutes = route.cableDistance / input.speed;
  const cycleMinutes = BLOCK_MINUTES + travelMinutes + POST_MINUTES;
  const tripsNeeded = input.stemsPerTrip > 0 ? Math.ceil(demand / input.stemsPerTrip) : 0;
  const hoursNeeded = (tripsNeeded * cycleMinutes) / 60;
  const availableHours = input.units * input.weeklyHours;
  const stemsPerHour = cycleMinutes > 0 ? input.stemsPerTrip * (60 / cycleMinutes) : 0;
  const fleetStemsPerHour = stemsPerHour * input.units;
  const dailyCapacity = fleetStemsPerHour * (input.weeklyHours / WORK_DAYS_PER_WEEK);
  const fleetTrips = cycleMinutes > 0 ? Math.floor((availableHours * 60) / cycleMinutes) : 0;
  const weeklyCapacity = fleetTrips * input.stemsPerTrip;
  return {
    ...input,
    route: { ...route, routeColor: input.routeColor },
    distance: route.cableDistance,
    travelMinutes,
    cycleMinutes,
    tripsNeeded,
    hoursNeeded,
    availableHours,
    stemsPerHour,
    fleetStemsPerHour,
    dailyCapacity,
    fleetTrips,
    weeklyCapacity,
    balance: weeklyCapacity - demand,
  };
}


function workToWallStart(workMinutes) {
  return workMinutes < BREAK_START_WORK_MINUTES ? workMinutes : workMinutes + BREAK_DURATION_MINUTES;
}

function workToWallEnd(workMinutes) {
  return workMinutes <= BREAK_START_WORK_MINUTES ? workMinutes : workMinutes + BREAK_DURATION_MINUTES;
}

function wallToWorkMinutes(wallMinutes) {
  if (wallMinutes <= BREAK_START_WORK_MINUTES) return wallMinutes;
  if (wallMinutes <= BREAK_START_WORK_MINUTES + BREAK_DURATION_MINUTES) return BREAK_START_WORK_MINUTES;
  return wallMinutes - BREAK_DURATION_MINUTES;
}

function addTimelineSegment(timeline, segment) {
  const breakAt = BREAK_START_WORK_MINUTES;
  const start = segment.workStart;
  const end = segment.workEnd;
  if (end <= start) return;
  if (start < breakAt && end > breakAt) {
    const point = segment.type === "travel"
      ? pointOnPolyline(segment.points, (breakAt - start) / (end - start))
      : segment.point;
    addTimelineSegment(timeline, { ...segment, workStart: start, workEnd: breakAt, points: segment.type === "travel" ? [segment.points[0], point] : segment.points });
    timeline.push({
      type: "wait",
      start: breakAt,
      end: breakAt + BREAK_DURATION_MINUTES,
      point,
      label: "Desayuno",
      loadState: "break",
    });
    addTimelineSegment(timeline, { ...segment, workStart: breakAt, workEnd: end, points: segment.type === "travel" ? [point, segment.points[segment.points.length - 1]] : segment.points });
    return;
  }
  timeline.push({
    ...segment,
    start: workToWallStart(start),
    end: workToWallEnd(end),
  });
}

function routeCacheKey(origin, destination, networkType) {
  return `${networkType}:${origin.type}:${origin.id}->${destination.type}:${destination.id}`;
}

function intervalsOverlap(start, end, booking) {
  return start < booking.end && end > booking.start;
}

function nextRouteStart(route, earliestStart, reservations) {
  if (!reservations || !route?.segments?.length) return earliestStart;
  let start = Math.max(0, earliestStart);
  for (let guard = 0; guard < 1000; guard += 1) {
    let shifted = false;
    for (const occupation of route.segments) {
      const bookings = reservations.get(occupation.resourceKey) || [];
      const intervalStart = start + occupation.offsetStartMinutes;
      const intervalEnd = start + occupation.offsetEndMinutes;
      for (const booking of bookings) {
        if (!intervalsOverlap(intervalStart, intervalEnd, booking)) continue;
        start = booking.end - occupation.offsetStartMinutes;
        shifted = true;
        break;
      }
      if (shifted) break;
    }
    if (!shifted) return start;
  }
  return start;
}

function reserveRoute(route, start, reservations, label) {
  if (!reservations || !route?.segments?.length) return;
  for (const occupation of route.segments) {
    const list = reservations.get(occupation.resourceKey) || [];
    list.push({
      start: start + occupation.offsetStartMinutes,
      end: start + occupation.offsetEndMinutes,
      label,
    });
    list.sort((a, b) => a.start - b.start);
    reservations.set(occupation.resourceKey, list);
  }
}

function nextBlockStart(blockId, earliestStart, duration, reservations) {
  let start = Math.max(0, earliestStart);
  const bookings = reservations.get(blockId) || [];
  for (let guard = 0; guard < 200; guard += 1) {
    const conflict = bookings.find((booking) => intervalsOverlap(start, start + duration, booking));
    if (!conflict) return start;
    start = conflict.end;
  }
  return start;
}

function reserveBlock(blockId, start, end, reservations, label) {
  const list = reservations.get(blockId) || [];
  list.push({ start, end, label });
  list.sort((a, b) => a.start - b.start);
  reservations.set(blockId, list);
}

function simulateDailyPlanMethod(planRows, demandByFlower, input) {
  if (input.units <= 0) throw new Error("No hay operadores disponibles para este metodo.");
  if (input.weeklyHours <= 0) throw new Error("Las horas semanales deben ser mayores a cero.");

  const dailyWorkMinutes = (input.weeklyHours / WORK_DAYS_PER_WEEK) * 60;
  const dayWallMinutes = dailyWorkMinutes + BREAK_DURATION_MINUTES;
  const routeCache = new Map();
  const routeKeys = new Set();
  const jobs = [];
  let totalStems = 0;
  let totalTrips = 0;
  let loadedDistance = 0;
  let plannedTravelMinutes = 0;
  let plannedServiceMinutes = 0;

  function cachedRoute(origin, destination) {
    const key = routeCacheKey(origin, destination, input.networkType);
    if (!routeCache.has(key)) routeCache.set(key, routeForNetwork(origin, destination, input.speed, input.networkType));
    return routeCache.get(key);
  }

  for (const row of planRows) {
    const blockDemand = dailyDemandForPlanRow(row, demandByFlower);
    const dailyWorkHours = dailyWorkMinutes / 60;
    const cuttersNeeded = dailyWorkHours > 0 && row.flower.cutterRate > 0 ? (blockDemand / dailyWorkHours) / row.flower.cutterRate : 0;
    const productionPerMinute = cuttersNeeded * row.flower.cutterRate / 60;
    const tripsNeeded = input.stemsPerTrip > 0 ? Math.ceil(blockDemand / input.stemsPerTrip) : 0;
    const loadedRoute = cachedRoute(row.block, row.post);
    const loadedMinutes = loadedRoute.cableDistance / input.speed;
    let cumulative = 0;
    const job = {
      block: row.block,
      flower: row.flower,
      post: row.post,
      row,
      loadedRoute,
      loadedMinutes,
      demand: blockDemand,
      tripsNeeded,
      tripStems: [],
      distance: 0,
      minutes: 0,
      cuttersNeeded,
      productionPerMinute,
      productionPerHour: cuttersNeeded * row.flower.cutterRate,
      cutWaitMinutes: 0,
      firstArrivalMinutes: null,
      firstAvailableStems: 0,
      transportedStems: 0,
      stemsPerTrip: input.stemsPerTrip,
      lastTripStems: tripsNeeded > 0 ? blockDemand - input.stemsPerTrip * (tripsNeeded - 1) : 0,
      timeToFullTripMinutes: productionPerMinute > 0 ? Math.min(input.stemsPerTrip, blockDemand) / productionPerMinute : Infinity,
    };
    for (let tripIndex = 0; tripIndex < tripsNeeded; tripIndex += 1) {
      const remaining = Math.max(0, blockDemand - cumulative);
      const stems = Math.min(input.stemsPerTrip, remaining);
      cumulative += stems;
      job.tripStems.push(stems);
      job.distance += loadedRoute.cableDistance;
      job.minutes += BLOCK_MINUTES + loadedMinutes + POST_MINUTES;
      job.transportedStems += stems;
      totalTrips += 1;
      totalStems += stems;
      loadedDistance += loadedRoute.cableDistance;
      plannedTravelMinutes += loadedMinutes;
      plannedServiceMinutes += BLOCK_MINUTES + POST_MINUTES;
    }
    jobs.push(job);
  }

  function scheduleWith(operatorCount, keepTimeline = false, cutterMultiplier = 1) {
    const startPost = planRows[0]?.post;
    const resourceReservations = input.networkType === "cable" ? new Map() : null;
    const blockReservations = new Map();
    const loadTimelines = [];
    const jobWaits = new Map(jobs.map((job) => [job, 0]));
    const operators = Array.from({ length: operatorCount }, (_, index) => ({
      index,
      time: 0,
      currentPost: startPost,
      timeline: [],
      busyMinutes: 0,
      distance: 0,
      trips: 0,
    }));
    const blockStates = jobs
      .filter((job) => job.tripsNeeded > 0)
      .map((job) => ({
        job,
        row: job.row,
        seeded: false,
        nextTripIndex: 0,
        remainingTrips: job.tripsNeeded,
        currentLoadStart: null,
        currentLoadReady: null,
      }));

    function fillMinutes(state, tripIndex) {
      const stems = state.job.tripStems[tripIndex] || input.stemsPerTrip;
      const production = state.job.productionPerMinute * Math.max(0.0001, cutterMultiplier);
      return production > 0 ? stems / production : Infinity;
    }

    function pushLoadTimeline(state, endWork) {
      if (!keepTimeline || state.currentLoadStart === null || state.currentLoadReady === null) return;
      const visibleEnd = Math.max(endWork, state.currentLoadReady);
      if (visibleEnd <= state.currentLoadStart) return;
      loadTimelines.push({
        point: state.job.loadedRoute.cableCoords?.[0] || state.row.block.center,
        start: workToWallStart(state.currentLoadStart),
        end: workToWallEnd(visibleEnd),
        workStart: state.currentLoadStart,
        workReady: state.currentLoadReady,
        workEnd: visibleEnd,
        label: `${input.loadSetLabel} en ${state.row.block.label}: llenandose para viaje ${state.nextTripIndex + 1}`,
      });
    }

    function setupCandidate(operator, state) {
      const emptyRoute = cachedRoute(operator.currentPost, state.row.block);
      const emptyStart = nextRouteStart(emptyRoute, operator.time, resourceReservations);
      const emptyEnd = emptyStart + emptyRoute.timeMinutes;
      const blockStart = nextBlockStart(state.row.block.id, emptyEnd, BLOCK_MINUTES, blockReservations);
      const blockEnd = blockStart + BLOCK_MINUTES;
      const soloRoute = cachedRoute(state.row.block, state.row.post);
      const soloStart = blockEnd;
      const soloEnd = soloStart + soloRoute.timeMinutes;
      const wait = Math.max(0, emptyStart - operator.time) + Math.max(0, blockStart - emptyEnd);
      return {
        type: "setup",
        operator,
        state,
        emptyRoute,
        emptyStart,
        emptyEnd,
        blockStart,
        blockEnd,
        soloRoute,
        soloStart,
        soloEnd,
        wait,
        finish: soloEnd,
        score: soloEnd + wait * 0.35,
      };
    }

    function pickupCandidate(operator, state) {
      const emptyRoute = cachedRoute(operator.currentPost, state.row.block);
      const emptyStart = nextRouteStart(emptyRoute, operator.time, resourceReservations);
      const emptyEnd = emptyStart + emptyRoute.timeMinutes;
      const readyStart = Math.max(emptyEnd, state.currentLoadReady || 0);
      const blockStart = nextBlockStart(state.row.block.id, readyStart, BLOCK_MINUTES, blockReservations);
      const blockEnd = blockStart + BLOCK_MINUTES;
      const loadedStart = nextRouteStart(state.job.loadedRoute, blockEnd, resourceReservations);
      const loadedEnd = loadedStart + state.job.loadedRoute.timeMinutes;
      const finish = loadedEnd + POST_MINUTES;
      const wait =
        Math.max(0, emptyStart - operator.time)
        + Math.max(0, blockStart - emptyEnd)
        + Math.max(0, loadedStart - blockEnd);
      return {
        type: "pickup",
        operator,
        state,
        emptyRoute,
        emptyStart,
        emptyEnd,
        blockStart,
        blockEnd,
        loadedStart,
        loadedEnd,
        finish,
        wait,
        score: finish + wait * 0.35,
      };
    }

    function addTravel(timeline, route, start, end, label, loadState) {
      if (!keepTimeline || !route.cableCoords?.length || end <= start) return;
      addTimelineSegment(timeline, {
        type: "travel",
        workStart: start,
        workEnd: end,
        points: route.cableCoords,
        label,
        loadState,
      });
    }

    function addWait(timeline, start, end, point, label, loadState = "idle") {
      if (!keepTimeline || end <= start) return;
      addTimelineSegment(timeline, {
        type: "wait",
        workStart: start,
        workEnd: end,
        point,
        label,
        loadState,
      });
    }

    let guard = 0;
    while (blockStates.some((state) => !state.seeded || state.remainingTrips > 0) && guard < 10000) {
      guard += 1;
      let best = null;
      for (const operator of operators) {
        for (const state of blockStates) {
          if (!state.seeded) {
            const candidate = setupCandidate(operator, state);
            if (!best || candidate.score < best.score) best = candidate;
            continue;
          }
          if (state.remainingTrips <= 0) continue;
          const candidate = pickupCandidate(operator, state);
          if (!best || candidate.score < best.score) best = candidate;
        }
      }
      if (!best) break;

      const { operator, state } = best;
      const taskStart = operator.time;
      if (best.type === "setup") {
        reserveRoute(best.emptyRoute, best.emptyStart, resourceReservations, `vacia a ${state.row.block.label}`);
        reserveBlock(state.row.block.id, best.blockStart, best.blockEnd, blockReservations, `deja vacia ${state.row.block.label}`);
        addWait(operator.timeline, taskStart, best.emptyStart, operator.currentPost?.center || state.row.post.center, "Espera tramo libre para salir", "idle");
        addTravel(operator.timeline, best.emptyRoute, best.emptyStart, best.emptyEnd, `${input.operatorSingularLabel} ${operator.index + 1}: lleva ${input.loadSetLabel} vacia a ${state.row.block.label}`, "empty");
        addWait(operator.timeline, best.emptyEnd, best.blockStart, best.emptyRoute.cableCoords?.[best.emptyRoute.cableCoords.length - 1] || state.row.block.center, `Espera entrada libre en ${state.row.block.label}`, "idle");
        addWait(operator.timeline, best.blockStart, best.blockEnd, state.job.loadedRoute.cableCoords?.[0] || state.row.block.center, `Deja ${input.loadSetLabel} vacia en ${state.row.block.label}`, "swap");
        addTravel(operator.timeline, best.soloRoute, best.soloStart, best.soloEnd, `${input.operatorSingularLabel} ${operator.index + 1}: regresa sin ${input.loadSetLabel} a ${state.row.post.label}`, "solo");
        state.seeded = true;
        state.currentLoadStart = best.blockEnd;
        state.currentLoadReady = best.blockEnd + fillMinutes(state, state.nextTripIndex);
        operator.time = best.finish;
        operator.currentPost = state.row.post;
        operator.busyMinutes += best.finish - taskStart;
        operator.distance += best.emptyRoute.cableDistance + best.soloRoute.cableDistance;
      } else {
        reserveRoute(best.emptyRoute, best.emptyStart, resourceReservations, `vacia a ${state.row.block.label}`);
        reserveBlock(state.row.block.id, best.blockStart, best.blockEnd, blockReservations, `intercambio ${state.row.block.label}`);
        reserveRoute(state.job.loadedRoute, best.loadedStart, resourceReservations, `llena a ${state.row.post.label}`);
        pushLoadTimeline(state, best.blockStart);
        addWait(operator.timeline, taskStart, best.emptyStart, operator.currentPost?.center || state.row.post.center, "Espera tramo libre para salir", "idle");
        addTravel(operator.timeline, best.emptyRoute, best.emptyStart, best.emptyEnd, `${input.operatorSingularLabel} ${operator.index + 1}: lleva ${input.loadSetLabel} vacia a ${state.row.block.label}`, "empty");
        addWait(operator.timeline, best.emptyEnd, best.blockStart, best.emptyRoute.cableCoords?.[best.emptyRoute.cableCoords.length - 1] || state.row.block.center, `Espera ${input.loadSetLabel} llena o entrada libre en ${state.row.block.label}`, "idle");
        addWait(operator.timeline, best.blockStart, best.blockEnd, state.job.loadedRoute.cableCoords?.[0] || state.row.block.center, `Saca llena, deja vacia y despeja ${state.row.block.label}`, "swap");
        addWait(operator.timeline, best.blockEnd, best.loadedStart, state.job.loadedRoute.cableCoords?.[0] || state.row.block.center, "Espera tramo libre con carga al lado", "idle");
        addTravel(operator.timeline, state.job.loadedRoute, best.loadedStart, best.loadedEnd, `${input.operatorSingularLabel} ${operator.index + 1}: lleva ${input.loadSetLabel} llena a ${state.row.post.label}`, "loaded");
        addWait(operator.timeline, best.loadedEnd, best.finish, state.job.loadedRoute.cableCoords?.[state.job.loadedRoute.cableCoords.length - 1] || state.row.post.center, `Descarga en ${state.row.post.label}`, "idle");
        const wait = best.wait;
        jobWaits.set(state.job, (jobWaits.get(state.job) || 0) + wait);
        state.job.firstArrivalMinutes ??= best.emptyEnd;
        state.job.firstAvailableStems ||= Math.max(0, Math.min(state.job.demand, state.job.productionPerHour * cutterMultiplier / 60 * best.emptyEnd));
        state.nextTripIndex += 1;
        state.remainingTrips -= 1;
        if (state.remainingTrips > 0) {
          state.currentLoadStart = best.blockEnd;
          state.currentLoadReady = best.blockEnd + fillMinutes(state, state.nextTripIndex);
        } else {
          state.currentLoadStart = null;
          state.currentLoadReady = null;
        }
        operator.time = best.finish;
        operator.currentPost = state.row.post;
        operator.busyMinutes += best.finish - taskStart;
        operator.distance += best.emptyRoute.cableDistance + state.job.loadedRoute.cableDistance;
        operator.trips += 1;
      }
    }

    for (const operator of operators) {
      if (keepTimeline && operator.time < dailyWorkMinutes) {
        const point = operator.currentPost?.center || planRows[0]?.post?.center || [0, 0];
        addTimelineSegment(operator.timeline, {
          type: "wait",
          workStart: operator.time,
          workEnd: dailyWorkMinutes,
          point,
          label: "Disponible sin viaje asignado",
          loadState: "idle",
        });
      }
    }

    return {
      operators,
      loadTimelines,
      finishWorkMinutes: operators.reduce((max, operator) => Math.max(max, operator.time), 0),
      totalBusyMinutes: operators.reduce((sum, operator) => sum + operator.busyMinutes, 0),
      waitForReadyMinutes: [...jobWaits.values()].reduce((sum, value) => sum + value, 0),
      jobWaits,
    };
  }

  let requiredOperatorsRounded = input.units + 1;
  let requiredCutterMultiplier = 1;
  let selectedSchedule = null;
  for (let count = 1; count <= input.units; count += 1) {
    const instantSchedule = scheduleWith(count, false, 1000000);
    if (instantSchedule.finishWorkMinutes > dailyWorkMinutes) continue;

    let low = 1;
    let high = 1;
    let highSchedule = scheduleWith(count, false, high);
    while (highSchedule.finishWorkMinutes > dailyWorkMinutes && high < 64) {
      low = high;
      high *= 2;
      highSchedule = scheduleWith(count, false, high);
    }
    if (highSchedule.finishWorkMinutes > dailyWorkMinutes) continue;
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const mid = (low + high) / 2;
      const midSchedule = scheduleWith(count, false, mid);
      if (midSchedule.finishWorkMinutes <= dailyWorkMinutes) {
        high = mid;
        highSchedule = midSchedule;
      } else {
        low = mid;
      }
    }
    requiredOperatorsRounded = count;
    requiredCutterMultiplier = high;
    selectedSchedule = highSchedule;
    break;
  }
  if (!selectedSchedule) selectedSchedule = scheduleWith(input.units, false, 1);
  const feasible = requiredOperatorsRounded <= input.units;
  const animationOperatorCount = feasible ? requiredOperatorsRounded : input.units;
  const animationCutterMultiplier = feasible ? requiredCutterMultiplier : 1;
  const animationSchedule = scheduleWith(animationOperatorCount, true, animationCutterMultiplier);
  const operatorMinutesEquivalent = animationSchedule.totalBusyMinutes / dailyWorkMinutes;
  const requiredLoadSets = Math.min(input.maxLoadSets, Math.ceil(animationOperatorCount * input.setsPerOperator));
  const loadSetGap = input.maxLoadSets - requiredLoadSets;
  const adjustedJobs = jobs.map((job) => ({
    ...job,
    baseCuttersNeeded: job.cuttersNeeded,
    cuttersNeeded: job.cuttersNeeded * animationCutterMultiplier,
    productionPerHour: job.productionPerHour * animationCutterMultiplier,
    cutWaitMinutes: animationSchedule.jobWaits.get(job) || 0,
    timeToFullTripMinutes: job.timeToFullTripMinutes / animationCutterMultiplier,
  }));
  const adjustedCuttersDay = adjustedJobs.reduce((sum, job) => sum + job.cuttersNeeded, 0);

  return {
    ...input,
    routes: [...routeCache.values()].filter((route) => {
      const key = `${route.networkType}:${route.origin?.type}:${route.origin?.id}:${route.destination?.type}:${route.destination?.id}:${input.routeColor}`;
      if (routeKeys.has(key)) return false;
      routeKeys.add(key);
      return true;
    }).map((route) => ({ ...route, routeColor: input.routeColor })),
    operatorTimelines: animationSchedule.operators.map((operator) => operator.timeline),
    loadTimelines: animationSchedule.loadTimelines,
    jobs: adjustedJobs,
    distance: animationSchedule.operators.reduce((sum, operator) => sum + operator.distance, 0),
    loadedDistance,
    travelMinutes: plannedTravelMinutes,
    cutWaitMinutes: animationSchedule.waitForReadyMinutes,
    serviceMinutes: plannedServiceMinutes,
    cycleMinutes: dailyWorkMinutes,
    totalMinutes: dayWallMinutes,
    dayWorkMinutes: dailyWorkMinutes,
    dayWallMinutes,
    totalStems,
    tripsNeeded: totalTrips,
    fleetTripCapacity: input.stemsPerTrip,
    hoursNeeded: operatorMinutesEquivalent * (dailyWorkMinutes / 60),
    availableHours: input.units * (dailyWorkMinutes / 60),
    dailyWorkHours: dailyWorkMinutes / 60,
    stemsPerHour: operatorMinutesEquivalent > 0 ? totalStems / (operatorMinutesEquivalent * dailyWorkMinutes / 60) : 0,
    fleetStemsPerHour: totalStems / (dailyWorkMinutes / 60),
    dailyCapacity: totalStems,
    weeklyCapacity: totalStems * WORK_DAYS_PER_WEEK,
    requiredOperators: operatorMinutesEquivalent,
    requiredOperatorsRounded,
    cutterMultiplier: animationCutterMultiplier,
    adjustedCuttersDay,
    feasible,
    operatorGap: input.units - operatorMinutesEquivalent,
    loadSetsRequired: requiredLoadSets,
    loadSetGap,
    balance: input.units * dailyWorkMinutes - animationSchedule.totalBusyMinutes,
    finishWorkMinutes: animationSchedule.finishWorkMinutes,
    overWorkMinutes: Math.max(0, animationSchedule.finishWorkMinutes - dailyWorkMinutes),
    routeColor: input.routeColor,
  };
}

function renderCutterSummaryCard(cutterPlan) {
  const card = document.createElement("div");
  card.className = "method-card cutter-summary";
  const title = document.createElement("h3");
  title.textContent = "Cortadores requeridos en la finca";
  const grid = document.createElement("div");
  grid.className = "method-stat-grid";
  const totals = [
    ["Total finca", `${cutterPlan.totalCutters} personas`],
    ["Equivalente minimo", cutterPlan.equivalentCutters.toFixed(1)],
    ["Asignados 06:15", `${cutterPlan.initialCutters} personas`],
    ["Movimientos entre bloques", formatInteger(cutterPlan.transferredCutters)],
    ["Horas-persona", formatHours(cutterPlan.totalWorkMinutes / 60)],
    ["Ultimo corte", formatSimulationClock(workToWallEnd(cutterPlan.finishWorkMinutes))],
    ["Modo demanda", cutterPlan.manualMode ? "Diaria manual" : "Semanal"],
  ];
  for (const [label, value] of totals) {
    const item = document.createElement("div");
    item.className = "method-stat";
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(span, strong);
    grid.appendChild(item);
  }
  const note = document.createElement("div");
  note.className = "cutter-plan-note";
  note.textContent = "Cada persona se cuenta una sola vez. Los bloques con 0 cortadores a las 06:15 quedan pendientes hasta que se libere personal de otro bloque; el traslado se considera inmediato.";
  const list = document.createElement("div");
  list.className = "block-trip-list";
  for (const entry of cutterPlan.entries) {
    const row = document.createElement("div");
    row.className = "block-trip-row cutter-row";
    const transferText = entry.transfers.length
      ? entry.transfers.map((transfer) => `+${transfer.added} a las ${formatSimulationClock(workToWallStart(transfer.workMinutes))} (${transfer.total} en bloque)`).join("; ")
      : "sin refuerzo posterior";
    const finishText = entry.workMinutes > 0 ? formatSimulationClock(workToWallEnd(entry.finishWorkMinutes)) : "sin corte";
    row.innerHTML = `<span>${entry.index + 1}. ${entry.block.label}</span><span>${entry.flower.label}</span><strong>${entry.initialCutters} a las 06:15</strong><small>${formatInteger(entry.demand)} tallos | ${formatHours(entry.workMinutes / 60)} de corte | termina ${finishText} | ${transferText}</small>`;
    list.appendChild(row);
  }
  card.append(title, grid, note, list);
  return card;
}

function inputDailyHours() {
  return Math.max(0.0001, Math.max(0, readNumber(els.simWeeklyHours, 42)) / WORK_DAYS_PER_WEEK);
}

function renderMethodCard(result) {
  const card = document.createElement("div");
  card.className = `method-card ${result.networkType === "tractor" ? "tractor" : ""} ${result.feasible ? "" : "error"}`;
  const title = document.createElement("h3");
  title.textContent = result.label;
  const grid = document.createElement("div");
  grid.className = "method-stat-grid";
  const stats = [
    ["Jornada efectiva", formatHours(result.dayWorkMinutes / 60)],
    ["Desayuno", "45 min 11:00"],
    ["Operadores disp.", `${result.units} ${result.unitLabel}`],
    ["Operadores req.", result.feasible ? `${result.requiredOperators.toFixed(1)} / ${result.requiredOperatorsRounded}` : `>${result.units}`],
    ["Gabela oper.", result.feasible ? `${result.operatorGap >= 0 ? "+" : ""}${result.operatorGap.toFixed(1)}` : "No cabe"],
    ["Vehiculos req.", `${result.loadSetsRequired} de ${result.maxLoadSets}`],
    ["Ritmo de corte", result.cutterMultiplier > 1.01 ? `${result.cutterMultiplier.toFixed(2)}x` : "Base"],
    ["Gabela veh.", `${result.loadSetGap >= 0 ? "+" : ""}${result.loadSetGap}`],
    ["Bloques", formatInteger(result.jobs.length)],
    ["Viajes plan", formatInteger(result.tripsNeeded)],
    ["Tallos plan", formatInteger(result.totalStems)],
    ["Tallos/viaje", formatInteger(result.fleetTripCapacity)],
    ["Baldes/viaje", formatInteger(result.bucketsPerTrip)],
    ["Traslado cargado", formatMinutes(result.travelMinutes)],
    ["Espera llenado", formatMinutes(result.cutWaitMinutes)],
    ["Tallos/h jornada", formatInteger(result.fleetStemsPerHour)],
    ["Balance horas", result.feasible ? `${result.balance >= 0 ? "+" : ""}${formatHours(result.balance / 60)}` : `-${formatHours(result.overWorkMinutes / 60)}`],
  ];
  for (const [label, value] of stats) {
    const item = document.createElement("div");
    item.className = "method-stat";
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(span, strong);
    grid.appendChild(item);
  }

  const jobList = document.createElement("div");
  jobList.className = "block-trip-list";
  for (const [index, job] of result.jobs.entries()) {
    const row = document.createElement("div");
    row.className = "block-trip-row";
    row.innerHTML = `<span>${index + 1}. ${job.block.label}</span><span>${job.flower.label}</span><strong>${formatInteger(job.tripsNeeded)} viajes</strong><small>${formatInteger(job.demand)} tallos | ${formatInteger(job.stemsPerTrip)} tallos/viaje | ultimo ${formatInteger(job.lastTripStems)} | ${formatInteger(job.productionPerHour)} tallos/h de corte | ${formatMinutes(job.timeToFullTripMinutes)} para llenar viaje</small>`;
    jobList.appendChild(row);
  }

  card.append(title, grid, jobList);
  return card;
}

function renderErrorCard(label, message) {
  const card = document.createElement("div");
  card.className = "method-card error";
  const title = document.createElement("h3");
  title.textContent = label;
  const text = document.createElement("div");
  text.className = "route-summary";
  text.textContent = message;
  card.append(title, text);
  return card;
}

function calculateSimulation() {
  const planRows = selectedPlanRows();
  if (!planRows.length) return;
  const bucketStems = Math.max(1, readNumber(els.simBucketStems, 150));
  const weeklyHours = Math.max(0, readNumber(els.simWeeklyHours, 42));
  const demandByFlower = demandPlanByFlower(planRows, weeklyHours);
  const mode = selectedTransportMode();
  const methods = mode === "both" ? ["cable", "tractor"] : [mode];
  const results = [];
  const errors = [];

  for (const method of methods) {
    const input = methodInputs(method, bucketStems, weeklyHours);
    try {
      results.push(simulateDailyPlanMethod(planRows, demandByFlower, input));
    } catch (error) {
      errors.push({ label: input.label, message: error.message });
    }
  }

  const cutterPlan = buildCutterWorkforcePlan(planRows, demandByFlower, weeklyHours);
  const displayRoutes = [];
  const routeKeys = new Set();
  for (const route of results.flatMap((result) => result.routes)) {
    const key = `${route.networkType}:${route.origin?.type}:${route.origin?.id}:${route.destination?.type}:${route.destination?.id}:${route.routeColor}`;
    if (routeKeys.has(key)) continue;
    routeKeys.add(key);
    displayRoutes.push(route);
  }
  state.simRoutes = displayRoutes;
  state.route = state.simRoutes[0] || null;
  state.selected.origin = planRows[0]?.block || null;
  state.selected.destination = planRows[planRows.length - 1]?.post || null;
  renderRoute();
  prepareSimulationPlayback(results, cutterPlan);
  updateSelectionStyles();

  const selectedFlowerKeys = new Set(planRows.map((row) => row.flowerKey));
  const dailyDemand = planRows.reduce((sum, row) => {
    const info = demandByFlower.get(row.flowerKey);
    return sum + (state.useDailyBlockDemand ? Math.max(0, Number(row.dailyDemand) || 0) : (info?.perBlockDemand || 0));
  }, 0);
  const weeklyDemand = state.useDailyBlockDemand
    ? dailyDemand * WORK_DAYS_PER_WEEK
    : [...selectedFlowerKeys].reduce((sum, key) => sum + (demandByFlower.get(key)?.weeklyDemand || 0), 0);
  const dailyHours = weeklyHours / WORK_DAYS_PER_WEEK;
  const hourlyDemand = dailyHours > 0 ? dailyDemand / dailyHours : 0;
  const bucketsNeeded = Math.ceil(dailyDemand / bucketStems);
  const destinationLabels = [...new Set(planRows.map((row) => row.post.label))].join(", ");
  const totalPlanMinutes = results.reduce((max, result) => Math.max(max, result.dayWallMinutes || result.totalMinutes), 0);
  const totalTrips = results[0]?.tripsNeeded || 0;
  const feasibleText = results.length ? (results.every((result) => result.feasible) ? "La flota calculada cabe en la jornada." : "La flota disponible no alcanza para la jornada.") : "";

  els.simDestinationMetric.textContent = destinationLabels;
  els.simDemandMetric.textContent = state.useDailyBlockDemand ? "Diaria manual" : formatInteger(weeklyDemand);
  els.simDailyDemandMetric.textContent = formatInteger(dailyDemand);
  els.simHourlyDemandMetric.textContent = `${formatInteger(hourlyDemand)}/h`;
  els.simBucketsMetric.textContent = formatInteger(bucketsNeeded);
  els.simCutMetric.textContent = `${cutterPlan.totalCutters} finca / ${cutterPlan.equivalentCutters.toFixed(1)} equiv.`;
  const cutWaitMinutes = results[0]?.cutWaitMinutes || 0;
  els.routeSummary.textContent = `Plan diario con ${planRows.length} bloques. Demanda diaria: ${formatInteger(dailyDemand)} tallos en ${dailyHours.toFixed(2)} h efectivas/dia; meta: ${formatInteger(hourlyDemand)} tallos/h. Cortadores unicos en la finca: ${cutterPlan.totalCutters}; se realizan ${formatInteger(cutterPlan.transferredCutters)} movimientos de personal entre bloques. Viajes calculados: ${formatInteger(totalTrips)}. Espera por llenado: ${formatMinutes(cutWaitMinutes)}. ${feasibleText}`;
  els.hint.textContent = `${planRows[0].block.label} -> ${planRows[planRows.length - 1].post.label}`;

  clearElement(els.simMethodResults);
  els.simMethodResults.appendChild(renderCutterSummaryCard(cutterPlan));
  for (const result of results) els.simMethodResults.appendChild(renderMethodCard(result));
  for (const error of errors) els.simMethodResults.appendChild(renderErrorCard(error.label, error.message));
}

function activeNetwork() {
  const network = state.networks[state.networkType];
  if (!network) throw new Error("Selecciona un tipo de via valido.");
  return network;
}

function updateNetworkUi() {
  document.querySelectorAll(".network-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.network === state.networkType);
  });
  if (els.speedLabel) els.speedLabel.textContent = state.networkType === "tractor" ? "Velocidad tractor" : "Velocidad garrucha";
}

function getModeTypes() {
  if (state.mode === "block-post") return { origin: "block", destination: "post" };
  if (state.mode === "post-block") return { origin: "post", destination: "block" };
  return { origin: "block", destination: "block" };
}

function updateMode() {
  const types = getModeTypes();
  els.originLabel.textContent = types.origin === "block" ? "Bloque origen" : "Poscosecha origen";
  els.destinationLabel.textContent = types.destination === "block" ? "Bloque destino" : "Poscosecha destino";
  fillSelect(els.originSelect, types.origin);
  fillSelect(els.destinationSelect, types.destination);
  if (types.origin === types.destination && els.destinationSelect.options.length > 1) {
    els.destinationSelect.selectedIndex = 1;
  }
  syncSelectionFromControls();
  clearRoute(true);
}

function fillSelect(select, type) {
  const source = type === "block" ? state.blocks : state.posts;
  clearElement(select);
  for (const item of source) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.appendChild(option);
  }
}

function entityByTypeAndId(type, id) {
  const source = type === "block" ? state.blocks : state.posts;
  const entity = source.find((item) => item.id === id);
  return entity ? { ...entity, type } : null;
}

function syncSelectionFromControls() {
  const types = getModeTypes();
  state.selected.origin = entityByTypeAndId(types.origin, els.originSelect.value);
  state.selected.destination = entityByTypeAndId(types.destination, els.destinationSelect.value);
  updateSelectionStyles();
}

function getSpeed() {
  const value = Math.max(1, Number(els.speedInput.value) || 1);
  els.speedInput.value = String(value);
  els.speedRange.value = String(Math.min(350, value));
  return value;
}

function calculateAndDrawRoute() {
  syncSelectionFromControls();
  const origin = state.selected.origin;
  const destination = state.selected.destination;
  if (!origin || !destination) return;
  if (origin.type === destination.type && origin.id === destination.id) {
    showRouteError("Selecciona dos elementos diferentes.");
    return;
  }

  try {
    const route = calculateRoute(origin, destination, getSpeed());
    state.route = route;
    updateMetrics(route);
    renderRoute();
    updateSelectionStyles();
    els.hint.textContent = `${origin.label} -> ${destination.label}`;
  } catch (error) {
    showRouteError(error.message);
  }
}

function updateMetrics(route) {
  if (els.metricCable) els.metricCable.textContent = formatMeters(route.cableDistance);
  if (els.metricTime) els.metricTime.textContent = formatMinutes(route.timeMinutes);
  if (els.routeSummary) els.routeSummary.textContent = `${route.origin.label} -> ${route.destination.label}. ${route.networkLabel}: ${formatMeters(route.cableDistance)}. Tiempo estimado: ${formatMinutes(route.timeMinutes)}.`;
}

function showRouteError(message) {
  state.route = null;
  renderRoute();
  if (els.metricCable) els.metricCable.textContent = "-";
  if (els.metricTime) els.metricTime.textContent = "-";
  if (els.routeSummary) els.routeSummary.textContent = message;
  els.hint.textContent = message;
}

function clearRoute(resetMetrics = true) {
  state.route = null;
  renderRoute();
  updateSelectionStyles();
  if (resetMetrics) {
    if (els.metricCable) els.metricCable.textContent = "-";
    if (els.metricTime) els.metricTime.textContent = "-";
    if (els.routeSummary) els.routeSummary.textContent = "Sin simulacion.";
    els.hint.textContent = "Listo";
  }
}

export function getPlannerEntities() {
  return {
    blocks: state.blocks.map((item) => ({ id: item.id, label: item.label, type: "block" })),
    posts: state.posts.map((item) => ({ id: item.id, label: item.label, type: "post" })),
  };
}

export function calculatePlannerRoute(originType, originId, destinationType, destinationId, speed, networkType = "cable") {
  const origin = entityByTypeAndId(originType, String(originId));
  const destination = entityByTypeAndId(destinationType, String(destinationId));
  if (!origin || !destination) throw new Error("Selecciona un origen y destino validos.");
  if (origin.type === destination.type && origin.id === destination.id) throw new Error("Origen y destino deben ser diferentes.");
  const previousNetworkType = state.networkType;
  state.networkType = networkType;
  try {
    return calculateRoute(origin, destination, Number(speed));
  } finally {
    state.networkType = previousNetworkType;
  }
}

export function displayPlannerRoute(route, routeColor = null) {
  if (route.networkType && state.networks[route.networkType]) {
    state.networkType = route.networkType;
    updateNetworkUi();
  }
  state.route = { ...route, routeColor };
  state.selected.origin = route.origin;
  state.selected.destination = route.destination;
  updateMetrics(route);
  renderRoute();
  updateSelectionStyles();
  els.hint.textContent = `${route.origin.label} -> ${route.destination.label}`;
}

function bindEvents() {
  document.querySelectorAll(".transport-button").forEach((button) => {
    button.addEventListener("click", () => {
      setTransportMode(button.dataset.transport);
      calculateSimulation();
    });
  });

  const simulationControls = [
    els.simPomponDemand,
    els.simSpiderDemand,
    els.simSupermunDemand,
    els.simBucketStems,
    els.simWeeklyHours,
    els.simGarruchas,
    els.simWagons,
    els.simBucketsPerWagon,
    els.simCableSpeed,
    els.simTractors,
    els.simTrailers,
    els.simBucketsPerTrailer,
    els.simTractorSpeed,
  ].filter(Boolean);
  for (const control of simulationControls) control.addEventListener("input", calculateSimulation);
  els.simDailyDemandToggle?.addEventListener("click", toggleDailyBlockDemand);
  els.addPlanBlockButton?.addEventListener("click", () => addPlanRow());
  els.routeButton?.addEventListener("click", calculateSimulation);
  els.simPlayButton?.addEventListener("click", toggleSimulationPlayback);
  els.simResetButton?.addEventListener("click", resetSimulationPlayback);
  els.simPlaybackSpeed?.addEventListener("input", updatePlaybackUi);
  els.clearRoute?.addEventListener("click", () => {
    state.simRoutes = [];
    clearSimulationPlayback();
    clearRoute(true);
  });
  els.fitMap?.addEventListener("click", fitToBounds);
  els.zoomIn?.addEventListener("click", () => zoomAt(centerOfView(), 0.72));
  els.zoomOut?.addEventListener("click", () => zoomAt(centerOfView(), 1.35));

  bindMapNavigation();
  window.addEventListener("resize", () => {
    if (state.view) setView(state.view);
  });
}

function centerOfView() {
  const view = state.view;
  return [(view.minX + view.maxX) / 2, (view.minY + view.maxY) / 2];
}

function bindMapNavigation() {
  let drag = null;

  els.svg.addEventListener("wheel", (event) => {
    if (!state.view) return;
    event.preventDefault();
    const center = svgClientToWorld(event.clientX, event.clientY);
    zoomAt(center, event.deltaY < 0 ? 0.82 : 1.22);
  }, { passive: false });

  els.svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !state.view) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      view: { ...state.view },
    };
    els.svg.setPointerCapture(event.pointerId);
    els.svg.classList.add("dragging");
  });

  els.svg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const rect = els.svg.getBoundingClientRect();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const worldWidth = drag.view.maxX - drag.view.minX;
    const worldHeight = drag.view.maxY - drag.view.minY;
    const moveX = (-dx / rect.width) * worldWidth;
    const moveY = (dy / rect.height) * worldHeight;
    setView({
      minX: drag.view.minX + moveX,
      maxX: drag.view.maxX + moveX,
      minY: drag.view.minY + moveY,
      maxY: drag.view.maxY + moveY,
    });
  });

  els.svg.addEventListener("pointerup", (event) => {
    if (!drag) return;
    drag = null;
    els.svg.releasePointerCapture(event.pointerId);
    els.svg.classList.remove("dragging");
  });

  els.svg.addEventListener("pointerleave", () => {
    drag = null;
    els.svg.classList.remove("dragging");
  });
}

async function init() {
  bindEvents();
  try {
    await loadData();
    calculateSimulation();
    window.dispatchEvent(new CustomEvent("route-planner-ready"));
  } catch (error) {
    els.status.textContent = "Error cargando datos";
    els.hint.textContent = error.message;
    els.routeSummary.textContent = error.message;
    console.error(error);
  }
}

init();
