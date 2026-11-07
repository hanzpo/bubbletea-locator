import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Chain = { id: string; name: string; color: string; match: RegExp };

const CHAINS: Chain[] = [
  { id: "heytea", name: "Heytea", color: "#3a3a3c", match: /hey ?tea|喜茶/i },
  { id: "molly", name: "Molly Tea", color: "#2e9e6b", match: /\bmolly ?tea\b|茉莉奶白/i },
  { id: "hero", name: "Hero Tea", color: "#d6312b", match: /^hero tea\b(?! (stall|shop))|英歌魂/i },
  { id: "coco", name: "CoCo", color: "#f28c28", match: /^(coco|都可|coco ?都可)$|^coco ?(fresh|tea|bubble|都可)|^都可/i },
  { id: "chatime", name: "Chatime", color: "#6b3fa0", match: /chatime|日出茶太/i },
  { id: "gongcha", name: "Gong Cha", color: "#8c2f39", match: /gong ?cha|貢茶|贡茶|공차/i },
  { id: "chagee", name: "Chagee", color: "#b8860b", match: /chagee|霸王茶姬/i },
  { id: "kungfu", name: "Kung Fu Tea", color: "#d9a900", match: /kung ?fu ?tea/i },
  { id: "sharetea", name: "Sharetea", color: "#1f77b4", match: /share ?tea|歇脚亭/i },
  { id: "tigersugar", name: "Tiger Sugar", color: "#7a4a21", match: /tiger ?sugar|老虎堂/i },
  { id: "alley", name: "The Alley", color: "#c2679f", match: /^the alley\b|鹿角巷/i },
  { id: "yifang", name: "Yi Fang", color: "#4f7f3a", match: /\byi ?fang|一芳(?!園)/i },
  { id: "happylemon", name: "Happy Lemon", color: "#a8a800", match: /happy ?lemon|快乐柠檬|快樂檸檬/i },
  { id: "xingfutang", name: "Xing Fu Tang", color: "#9c6b3f", match: /xing ?fu ?tang/i },
  { id: "tealive", name: "Tealive", color: "#e0559b", match: /tealive/i },
  { id: "mixue", name: "Mixue", color: "#e8384f", match: /mixue|蜜雪/i },
  { id: "nayuki", name: "Nayuki", color: "#5b8c85", match: /nayuki|naixue|奈雪/i },
  { id: "presotea", name: "Presotea", color: "#3e6fb0", match: /presotea|鮮茶道/i },
  { id: "machi", name: "Machi Machi", color: "#b45f06", match: /machi ?machi|麥吉/i },
  { id: "bober", name: "Bober Tea", color: "#00838f", match: /bober ?tea/i },
  { id: "tptea", name: "TP Tea", color: "#607d3b", match: /\btp ?tea\b|茶湯會/i },
  { id: "truedan", name: "Truedan", color: "#ad1457", match: /truedan/i },
  { id: "dingtea", name: "Ding Tea", color: "#5d4037", match: /\bding ?tea\b/i },
  { id: "bobaguys", name: "Boba Guys", color: "#00695c", match: /boba ?guys/i },
];

const NOT_BOBA = /ichibanya|壱番屋|coco ?mart|coco ?nut|cocoa/i;
const DRINK_CAT = /^(bubble_tea_shop|tea_room|cafe|coffee_shop|smoothie_juice_bar|ice_cream_shop|dessert_shop|food_and_drink|restaurant|taiwanese_restaurant|chinese_restaurant)$/;
const STRICT_CAT = /^(bubble_tea_shop|tea_room|coffee_shop|smoothie_juice_bar)$/;
const GENERIC_NAME = new Set(["alley", "coco"]);
const ALWAYS_KEEP = /英歌魂|鹿角巷/;
const REBRANDED = /mollyteanyofficial|mollyteausaofficial/i;
const OSM_OK = (t: Record<string, string>) =>
  /cafe|fast_food|restaurant|ice_cream/.test(t.amenity ?? "") || /beverages|tea|confectionery/.test(t.shop ?? "");

type Row = {
  chain: number;
  lat: number;
  lon: number;
  name: string;
  addr: string;
  city: string;
  region: string;
  country: string;
  phone: string;
  website: string;
  source: number;
};

const SOURCES = ["Official store list", "OpenStreetMap", "Overture Maps", "Third-party listing"];
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const round = (n: number) => Math.round(n * 1e5) / 1e5;
const chainOf = (...names: unknown[]) => {
  const list = names.map(clean).filter(Boolean);
  if (list.some((n) => NOT_BOBA.test(n))) return -1;
  return CHAINS.findIndex((c) => list.some((n) => c.match.test(n)));
};
const read = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : []);

const rows: Row[] = [];

for (const s of read("data/raw/molly.json")) {
  const lat = +s.lat;
  const lon = +s.lng;
  if (!lat || !lon) continue;
  rows.push({
    chain: CHAINS.findIndex((c) => c.id === "molly"),
    lat, lon,
    name: clean(s.title),
    addr: clean(s.street),
    city: clean(s.city),
    region: clean(s.state),
    country: clean(s.country),
    phone: clean(s.phone),
    website: clean(s.website),
    source: 0,
  });
}

for (const e of read("data/raw/osm.json").elements ?? []) {
  const t = e.tags ?? {};
  if (!OSM_OK(t)) continue;
  const chain = chainOf(t.brand, t.name);
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (chain < 0 || !lat) continue;
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  rows.push({
    chain, lat, lon,
    name: clean(t.name) || CHAINS[chain].name,
    addr: clean(t["addr:full"]) || clean(street),
    city: clean(t["addr:city"]),
    region: clean(t["addr:state"] ?? t["addr:province"]),
    country: clean(t["addr:country"]),
    phone: clean(t.phone ?? t["contact:phone"]),
    website: clean(t.website ?? t["contact:website"]),
    source: 1,
  });
}

for (const p of read("data/raw/overture.json")) {
  if (p.operating_status && p.operating_status !== "open") continue;
  const chain = chainOf(p.brand, p.name);
  if (chain < 0 || REBRANDED.test(p.name)) continue;
  if (!ALWAYS_KEEP.test(p.name)) {
    if ((p.confidence ?? 0) < 0.6) continue;
    const allowed = GENERIC_NAME.has(CHAINS[chain].id) ? STRICT_CAT : DRINK_CAT;
    if (!allowed.test(p.cat ?? "")) continue;
  }
  rows.push({
    chain,
    lat: p.lat,
    lon: p.lon,
    name: clean(p.name),
    addr: clean(p.addr),
    city: clean(p.city),
    region: clean(p.region),
    country: clean(p.country),
    phone: clean(p.phone),
    website: clean(p.website),
    source: 2,
  });
}

for (const m of read("data/manual.json")) {
  rows.push({ addr: "", city: "", region: "", country: "", phone: "", website: "", ...m, chain: CHAINS.findIndex((c) => c.id === m.chain), source: 3 });
}

const molly = CHAINS.findIndex((c) => c.id === "molly");
const inNyc = (r: Row) => r.lat > 40.5 && r.lat < 40.92 && r.lon > -74.03 && r.lon < -73.7;
const current = rows.filter((r) => !(r.chain === molly && r.source !== 0 && inNyc(r)));

current.sort((a, b) => a.source - b.source);

const CELL = 0.002;
const seen = new Map<string, Row[]>();
const metres = (a: Row, b: Row) => {
  const x = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(x, a.lat - b.lat) * 111320;
};
const kept: Row[] = [];
for (const r of current) {
  const cx = Math.floor(r.lon / CELL);
  const cy = Math.floor(r.lat / CELL);
  let dupe: Row | undefined;
  for (let dx = -1; dx <= 1 && !dupe; dx++)
    for (let dy = -1; dy <= 1 && !dupe; dy++)
      dupe = seen.get(`${r.chain}:${cx + dx}:${cy + dy}`)?.find((o) => metres(o, r) < 120);
  if (dupe) {
    for (const k of ["addr", "city", "region", "country", "phone", "website"] as const)
      dupe[k] ||= r[k];
    continue;
  }
  const key = `${r.chain}:${cx}:${cy}`;
  seen.set(key, [...(seen.get(key) ?? []), r]);
  kept.push(r);
}

const counts = CHAINS.map((_, i) => kept.filter((r) => r.chain === i).length);
const order = CHAINS.map((_, i) => i).filter((i) => counts[i] > 0);
const remap = new Map(order.map((old, i) => [old, i]));

writeFileSync(
  "public/stores.json",
  JSON.stringify({
    updated: new Date().toISOString().slice(0, 10),
    sources: SOURCES,
    chains: order.map((i) => ({ id: CHAINS[i].id, name: CHAINS[i].name, color: CHAINS[i].color, count: counts[i] })),
    stores: kept.map((r) => [
      remap.get(r.chain), round(r.lat), round(r.lon), r.name, r.addr, r.city, r.region, r.country, r.phone, r.website, r.source,
    ]),
  }),
);

console.log(`${kept.length} shops from ${rows.length} rows`);
for (const i of order) {
  const by = [0, 1, 2, 3].map((s) => kept.filter((r) => r.chain === i && r.source === s).length);
  console.log(CHAINS[i].name.padEnd(14), String(counts[i]).padStart(6), ` official ${by[0]} osm ${by[1]} overture ${by[2]} manual ${by[3]}`);
}
