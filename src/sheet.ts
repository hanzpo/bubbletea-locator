export type Stop = "peek" | "half" | "full";

type Gesture = {
  x: number;
  y: number;
  off: number;
  mode: "wait" | "drag" | "none";
  inBody: boolean;
  inChains: boolean;
};

export function createSheet(panel: HTMLElement, body: HTMLElement, chains: HTMLElement, grab: HTMLElement) {
  const mobile = matchMedia("(max-width: 720px)");
  let stop: Stop = "peek";
  let offset = 0;
  let g: Gesture | null = null;
  let samples: [number, number][] = [];

  const height = () => innerHeight - panel.offsetTop;
  const safeBottom = () => parseFloat(getComputedStyle(panel).paddingBottom) || 0;
  const offsets = (): Record<Stop, number> => {
    const h = height();
    const peek = Math.max(0, h - (chains.offsetTop + chains.offsetHeight + safeBottom()));
    return { full: 0, half: Math.min(peek, Math.max(0, h - Math.round(innerHeight * 0.45))), peek };
  };

  const paint = (animate: boolean) => {
    panel.style.transition = animate ? "transform .34s cubic-bezier(.2, .9, .25, 1)" : "none";
    panel.style.transform = `translateY(${offset}px)`;
  };

  function snap(next: Stop, animate = true) {
    if (!mobile.matches) return;
    stop = next;
    offset = offsets()[next];
    panel.classList.toggle("full", next === "full");
    if (next !== "full") body.scrollTop = 0;
    panel.classList.toggle("top", body.scrollTop <= 0);
    paint(animate);
  }

  function reset() {
    panel.style.transition = panel.style.transform = "";
    panel.classList.remove("full");
  }

  panel.addEventListener(
    "touchstart",
    (e) => {
      const t = e.target as HTMLElement;
      if (!mobile.matches || e.touches.length > 1 || t.closest("#q, #results")) return void (g = null);
      const p = e.touches[0];
      g = { x: p.clientX, y: p.clientY, off: offset, mode: "wait", inBody: !!t.closest("#body"), inChains: !!t.closest("#chains") };
      samples = [[e.timeStamp, p.clientY]];
    },
    { passive: true },
  );

  panel.addEventListener(
    "touchmove",
    (e) => {
      if (!g || g.mode === "none") return;
      const p = e.touches[0];
      const dx = p.clientX - g.x;
      const dy = p.clientY - g.y;
      if (g.mode === "wait") {
        if (!dx && !dy) return;
        const sideways = g.inChains && Math.abs(dx) > Math.abs(dy);
        const scrolling = g.inBody && stop === "full" && (body.scrollTop > 0 || dy < 0);
        if (sideways || scrolling || !e.cancelable) return void (g.mode = "none");
        g.mode = "drag";
        g.y = p.clientY;
        g.off = offset;
        paint(false);
      }
      e.preventDefault();
      const o = offsets();
      let next = g.off + (p.clientY - g.y);
      if (next < 0) next /= 3;
      if (next > o.peek) next = o.peek + (next - o.peek) / 3;
      offset = next;
      panel.style.transform = `translateY(${offset}px)`;
      samples.push([e.timeStamp, p.clientY]);
      if (samples.length > 5) samples.shift();
    },
    { passive: false },
  );

  const end = () => {
    if (g?.mode === "drag") {
      const [t0, y0] = samples[0];
      const [t1, y1] = samples[samples.length - 1];
      const v = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;
      const aim = offset + v * 220;
      const o = offsets();
      const best = (Object.keys(o) as Stop[]).reduce((a, b) => (Math.abs(o[b] - aim) < Math.abs(o[a] - aim) ? b : a));
      snap(best);
    }
    g = null;
  };
  body.addEventListener("scroll", () => panel.classList.toggle("top", body.scrollTop <= 0), { passive: true });
  panel.addEventListener("touchend", end);
  panel.addEventListener("touchcancel", end);

  grab.addEventListener("click", () => snap(stop === "peek" ? "half" : stop === "half" ? "full" : "peek"));
  addEventListener("resize", () => (mobile.matches ? snap(stop, false) : reset()));
  mobile.addEventListener("change", () => (mobile.matches ? snap(stop, false) : reset()));

  return {
    snap,
    get stop() {
      return stop;
    },
    isMobile: () => mobile.matches,
    visible: () => height() - offsets()[stop],
    init: () => (mobile.matches ? snap(stop, false) : reset()),
  };
}
