import { Map as MapView, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type LngLatLike } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

setWorkerUrl(workerUrl);

type Chain = { id: string; name: string; color: string; count: number };
type Store = {
  i: number;
  chain: Chain;
  name: string;
  lat: number;
  lon: number;
  addr: string;
  city: string;
  region: string;
  country: string;
  phone: string;
  website: string;
  source: string;
};
type Data = {
  updated: string;
  sources: string[];
  chains: Chain[];
  stores: [number, number, number, string, string, string, string, string, string, string, number][];
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const panel = $("panel");
const body = $("body");
const chainsEl = $("chains");
const q = $<HTMLInputElement>("q");
const results = $<HTMLUListElement>("results");
const locateBtn = $<HTMLButtonElement>("locate");

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const rad = Math.PI / 180;
function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString()} km`);
const place = (s: Store) => [s.city, s.region, s.country].filter(Boolean).join(", ");

let stores: Store[] = [];
let chains: Chain[] = [];
let sources: string[] = [];
let active = new Set<string>();
let me: { lat: number; lon: number } | null = null;
let selected: Store | null = null;
let expanded = false;

const map = new MapView({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [-40, 30],
  zoom: 1.6,
  hash: true,
  attributionControl: { compact: true, customAttribution: "Shops: OpenStreetMap, Overture Maps, Molly Tea" },
});
map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

const pinned = new Marker({ color: "#0a66d6", scale: 0.7 });

function visible() {
  return active.size ? stores.filter((s) => active.has(s.chain.id)) : stores;
}

function geojson(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: visible().map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { i: s.i, color: s.chain.color },
    })),
  };
}

function renderChains() {
  const shown = expanded ? chains : chains.filter((c, i) => i < 6 || active.has(c.id));
  chainsEl.innerHTML =
    `<button class="chip" data-id="" aria-pressed="${active.size === 0}">All</button>` +
    shown
      .map(
        (c) =>
          `<button class="chip" data-id="${c.id}" aria-pressed="${active.has(c.id)}"><i style="background:${c.color}"></i>${esc(c.name)}</button>`,
      )
      .join("") +
    `<button class="chip more" data-more>${expanded ? "Less" : "More"}</button>`;
}

function renderList() {
  if (selected) return;
  const b = map.getBounds();
  const c = map.getCenter();
  const from = me && b.contains([me.lon, me.lat]) ? me : { lat: c.lat, lon: c.lng };
  const inView = visible().filter((s) => b.contains([s.lon, s.lat]));
  const rows = inView
    .map((s) => ({ s, d: km(from.lat, from.lon, s.lat, s.lon) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 60);
  body.innerHTML =
    `<div class="count">${inView.length.toLocaleString()} ${inView.length === 1 ? "shop" : "shops"} here</div>` +
    rows
      .map(
        ({ s, d }) =>
          `<button class="row" data-i="${s.i}"><i style="background:${s.chain.color}"></i><b>${esc(s.name)}</b><span>${fmtKm(d)}</span><small>${esc(s.addr || place(s))}</small></button>`,
      )
      .join("");
  body.scrollTop = 0;
}

function renderDetail(s: Store) {
  const dest = `${s.lat},${s.lon}`;
  const apple = `https://maps.apple.com/?daddr=${dest}&q=${encodeURIComponent(s.name)}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  const dist = me ? `<p>${fmtKm(km(me.lat, me.lon, s.lat, s.lon))} away</p>` : "";
  body.innerHTML = `<div class="detail">
    <button class="back" id="back">Back</button>
    <h2>${esc(s.name)}</h2>
    ${s.addr ? `<p>${esc(s.addr)}</p>` : ""}
    ${s.city && s.addr.toLowerCase().includes(s.city.toLowerCase()) ? "" : `<p>${esc(place(s))}</p>`}
    ${dist}
    <div class="actions">
      <a href="${apple}" target="_blank" rel="noopener">Apple Maps</a>
      <a href="${google}" target="_blank" rel="noopener">Google Maps</a>
      ${s.phone ? `<a href="tel:${esc(s.phone)}">Call</a>` : ""}
      ${s.website ? `<a href="${esc(s.website)}" target="_blank" rel="noopener">Website</a>` : ""}
    </div>
    <div class="source">Source: ${esc(s.source)}</div>
  </div>`;
  body.scrollTop = 0;
}

function select(s: Store | null, fly = true) {
  selected = s;
  map.setFilter("picked", ["==", ["get", "i"], s ? s.i : -1]);
  if (!s) return renderList();
  panel.classList.remove("small");
  renderDetail(s);
  if (fly) map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 14), padding: pad() });
}

function pad() {
  return innerWidth > 720
    ? { left: 384, top: 0, right: 0, bottom: 0 }
    : { left: 0, top: 0, right: 0, bottom: panel.offsetHeight };
}

function goTo(center: LngLatLike, zoom: number) {
  map.flyTo({ center, zoom, padding: pad(), speed: 1.8 });
}

function locate() {
  locateBtn.setAttribute("aria-busy", "true");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      locateBtn.removeAttribute("aria-busy");
      me = { lat: coords.latitude, lon: coords.longitude };
      q.value = "";
      pinned.setLngLat([me.lon, me.lat]).addTo(map);
      select(null);
      goTo([me.lon, me.lat], 12.5);
    },
    () => locateBtn.removeAttribute("aria-busy"),
    { timeout: 10000 },
  );
}

async function setup() {
  const data: Data = await (await fetch("/stores.json")).json();
  chains = data.chains;
  sources = data.sources;
  stores = data.stores.map((r, i) => ({
    i,
    chain: chains[r[0]],
    lat: r[1],
    lon: r[2],
    name: r[3],
    addr: r[4],
    city: r[5],
    region: r[6],
    country: r[7],
    phone: r[8],
    website: r[9],
    source: sources[r[10]],
  }));
  renderChains();

  if (!map.loaded()) await new Promise((r) => map.once("load", r));
  map.addSource("stores", {
    type: "geojson",
    data: geojson(),
    cluster: true,
    clusterRadius: 44,
    clusterMaxZoom: 12,
  });
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "stores",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#1d1d1f",
      "circle-radius": ["step", ["get", "point_count"], 13, 20, 16, 200, 20, 1000, 25],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  });
  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "stores",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#fff" },
  });
  map.addLayer({
    id: "points",
    type: "circle",
    source: "stores",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 15, 9],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  });
  map.addLayer({
    id: "picked",
    type: "circle",
    source: "stores",
    filter: ["==", ["get", "i"], -1],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 12,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#1d1d1f",
    },
  });

  map.on("click", "clusters", async (e) => {
    const f = e.features![0];
    const src = map.getSource("stores") as GeoJSONSource;
    const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
  });
  map.on("click", "points", (e) => select(stores[e.features![0].properties.i], false));
  for (const l of ["clusters", "points"]) {
    map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
  }
  map.on("moveend", renderList);
  renderList();

  const perm = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
  if (perm?.state === "granted" && !location.hash) locate();
}

chainsEl.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".chip");
  if (!b) return;
  if ("more" in b.dataset) {
    expanded = !expanded;
    return renderChains();
  }
  const id = b.dataset.id!;
  if (!id) active.clear();
  else if (active.has(id)) active.delete(id);
  else active.add(id);
  renderChains();
  (map.getSource("stores") as GeoJSONSource).setData(geojson());
  select(null);
});

body.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.id === "back") return select(null);
  const row = t.closest<HTMLButtonElement>(".row");
  if (row) select(stores[+row.dataset.i!]);
});

locateBtn.addEventListener("click", locate);
$("grab").addEventListener("click", () => panel.classList.toggle("small"));

type Hit = { lat: number; lon: number; title: string; sub: string; zoom: number };
let timer = 0;
let seq = 0;

async function geocode(text: string) {
  const id = ++seq;
  const c = map.getCenter();
  const url = `https://photon.komoot.io/api/?limit=5&lat=${c.lat}&lon=${c.lng}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => null);
  if (id !== seq || !res) return;
  const hits: Hit[] = res.features.map((f: any) => {
    const p = f.properties;
    return {
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      title: p.name ?? p.street ?? text,
      sub: [p.city, p.state, p.country].filter((v: string) => v && v !== p.name).join(", "),
      zoom: ["country", "state"].includes(p.type) ? 6 : p.type === "city" ? 11 : 14,
    };
  });
  results.innerHTML = hits
    .map(
      (h, i) => `<li><button data-h="${i}">${esc(h.title)}<small>${esc(h.sub)}</small></button></li>`,
    )
    .join("");
  results.hidden = !hits.length;
  results.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    const h = hits[+b.dataset.h!];
    results.hidden = true;
    q.value = h.title;
    select(null);
    goTo([h.lon, h.lat], h.zoom);
  };
}

q.addEventListener("input", () => {
  clearTimeout(timer);
  const text = q.value.trim();
  if (text.length < 2) {
    seq++;
    results.hidden = true;
    return;
  }
  timer = window.setTimeout(() => geocode(text), 250);
});
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") (results.querySelector("button") as HTMLButtonElement | null)?.click();
  if (e.key === "Escape") results.hidden = true;
});

setup();
