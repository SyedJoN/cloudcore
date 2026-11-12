export const DRAG_MIME = "application/x-drive-items";

let activeDrag = null; // { ids }

export const hasDriveDrag = (e) =>
  Boolean(activeDrag) ||
  Array.from(e.dataTransfer?.types ?? []).includes(DRAG_MIME);

export const readDriveDrag = (e) => {
  try {
    const raw = e.dataTransfer?.getData(DRAG_MIME);
    if (raw) return JSON.parse(raw) ?? [];
  } catch {
    // data nahi mila, neeche fallback
  }
  return activeDrag?.ids ?? [];
};

const DRAG_BODY_CLASS = "gd-drag-active";


// Transparent 1x1 image: hides the browser's native (frozen) drag ghost.
// Preloaded at module level so setDragImage works on the very first drag.
const EMPTY_IMG =
  typeof Image !== "undefined" ? new Image() : null;
if (EMPTY_IMG) {
  EMPTY_IMG.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

const SELECTED_BG = "var(--accent-blue-light)"; // selected title-bar colour (frame 1)
const CARD_W = 240; 
const CARD_H = 40;
const OFFSET_X = 26; 
const OFFSET_Y = 16;

// Find the title bars of the dragged items that are currently on screen.
function collectTitles(e, ids) {
  const wanted = new Set(ids.map(String));
  const sourceRoot = e.target?.closest?.("[data-drive-id]");
  const sourceId = sourceRoot?.getAttribute("data-drive-id");

  const roots = Array.from(document.querySelectorAll("[data-drive-id]"));
  const matched = roots.filter((r) => wanted.has(r.getAttribute("data-drive-id")));

  // dragged item sabse upar
  matched.sort(
    (a, b) =>
      (b.getAttribute("data-drive-id") === sourceId) -
      (a.getAttribute("data-drive-id") === sourceId),
  );

  const out = [];
  for (const root of matched) {
    const title = root.querySelector("[data-drag-title]");
    if (!title) continue;

    const r = title.getBoundingClientRect();
    if (!r.width) continue;

    const rect = {
      left: Math.min(Math.max(r.left, -r.width), window.innerWidth),
      top: Math.min(Math.max(r.top, -r.height), window.innerHeight),
      width: r.width,
      height: r.height,
    };

    out.push({ title, root, rect });
  }
  return out;
}

const FALLBACK_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="#5f6368"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5z"/></svg>';

const MORPH = ".25s cubic-bezier(.2,0,0,1)";

function createFly({ title, root, rect }, index, total) {
  /* ---------- asli title ki styling (chip isi se shuru hoga) ---------- */
  const cs = getComputedStyle(title);
  const nameEl = title.querySelector("[data-drag-name]");
  const ncs = nameEl ? getComputedStyle(nameEl) : null;
  const iconEl =
    title.querySelector("[data-drag-icon]") ||
    root?.querySelector("[data-drag-icon]");
  const ir = iconEl?.getBoundingClientRect();

  const orig = {
    padL: parseFloat(cs.paddingLeft) || 0,
    padR: parseFloat(cs.paddingRight) || 0,
    gap: parseFloat(cs.columnGap) || parseFloat(cs.gap) || 8,
    iconW: ir?.width || 18,
    iconH: ir?.height || 18,
    fontSize: ncs?.fontSize || "14px",
    color: ncs?.color || "#1f1f1f",
  };

  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:0;top:0;z-index:${2147483000 - index};
    display:flex;align-items:center;box-sizing:border-box;
    padding:0 ${orig.padR}px 0 ${orig.padL}px;column-gap:${orig.gap}px;
    border-radius:8px;white-space:nowrap;pointer-events:none;
    will-change:transform,width,height;
    background:${SELECTED_BG};color:var(--text-primary);
    box-shadow:0 0 0 rgba(0,0,0,0);
    transition:background-color .18s ease, box-shadow .18s ease, opacity .18s ease,
      padding ${MORPH}, column-gap ${MORPH};`;

  /* ---------- icon ---------- */
  const icon = document.createElement("span");
  icon.style.cssText = `display:flex;flex-shrink:0;align-items:center;justify-content:flex-start;
    width:${orig.iconW}px;height:${orig.iconH}px;overflow:visible;
    transition:opacity .18s ease, width ${MORPH}, height ${MORPH};`;

  let clone = null;
  let chipScale = 1;

  if (iconEl) {
    chipScale = 18 / Math.max(ir.width, ir.height, 1);
    clone = iconEl.cloneNode(true);
    clone.removeAttribute("data-drag-icon");
    clone.style.cssText += `;flex:none;width:${ir.width}px;height:${ir.height}px;
      transform:scale(1);transform-origin:left center;
      transition:transform ${MORPH};
      color:${getComputedStyle(iconEl).color};`;
    icon.appendChild(clone);
  } else {
    icon.innerHTML = FALLBACK_ICON;
  }

  /* ---------- name ---------- */
  const label = document.createElement("span");
  let text;
  if (nameEl) {
    text = nameEl.textContent;
  } else {
    const c = title.cloneNode(true);
    c.querySelectorAll("[data-drag-icon], button, svg").forEach((n) => n.remove());
    text = c.textContent;
  }
  label.textContent = text.trim();
  label.style.cssText = `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    font-family:${ncs?.fontFamily || "system-ui,sans-serif"};
    font-weight:${ncs?.fontWeight || "400"};
    font-size:${orig.fontSize};color:${orig.color};
    transition:opacity .18s ease, font-size ${MORPH}, color ${MORPH};`;

  el.append(icon, label);

  /* ---------- count badge (sirf top chip) ---------- */
  let badge = null;
  if (index === 0 && total > 1) {
    badge = document.createElement("span");
    badge.textContent = total;
    badge.style.cssText = `position:absolute;top:-10px;right:-10px;min-width:22px;height:22px;
      padding:0 6px;box-sizing:border-box;border-radius:11px;background:var(--accent-blue);color:var(--accent-blue-badge);
      font-size:12px;font-weight:500;display:flex;align-items:center;justify-content:center;
      transform:scale(0);transition:transform .18s cubic-bezier(.2,1.4,.4,1);`;
    el.appendChild(badge);
  }

  document.body.appendChild(el);

  /* ---------- layout morph: asli title <-> chip ---------- */
  const toChip = () => {
    el.style.paddingLeft = "16px";
    el.style.paddingRight = "16px";
    el.style.columnGap = "12px";
    icon.style.width = "18px";
    icon.style.height = "18px";
    if (clone) clone.style.transform = `scale(${chipScale})`;
    label.style.fontSize = "14px";
    label.style.color = "#1f1f1f";
  };

  const toOrigin = () => {
    el.style.paddingLeft = `${orig.padL}px`;
    el.style.paddingRight = `${orig.padR}px`;
    el.style.columnGap = `${orig.gap}px`;
    icon.style.width = `${orig.iconW}px`;
    icon.style.height = `${orig.iconH}px`;
    if (clone) clone.style.transform = "scale(1)";
    label.style.fontSize = orig.fontSize;
    label.style.color = orig.color;
  };

  return {
    el,
    icon,
    label,
    badge,
    index,
    toChip,
    toOrigin,
    // current animated values
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
    // origin (cancel hone par yahin wapas aate hain)
    ox: rect.left,
    oy: rect.top,
    ow: rect.width,
    oh: rect.height,
    // stack layer offset: 0 / 4 / 8 px
    off: Math.min(index, 2) * 4,
    // lerp speed: peeche wale items thoda late pahunchte hain
    k: Math.max(0.12, 0.3 - index * 0.03),
    arrived: false,
  };
}
function startStackDrag(e, sources, total) {
  // native ghost chhupao, hum apna chip banate hain
  e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
console.log("[drag] types after setDragImage:", Array.from(e.dataTransfer.types));
  const cur = { x: e.clientX, y: e.clientY };
  const flies = sources.map((s, i) => createFly(s, i, total));

  let raf = 0;
  let done = false;
  let returning = false;
  let last = performance.now();

  const place = (f) => {
    f.el.style.transform = `translate3d(${f.x}px,${f.y}px,0)`;
    f.el.style.width = `${f.w}px`;
    f.el.style.height = `${f.h}px`;
  };

  const setArrived = (f, arrived) => {
    f.arrived = arrived;
    f.el.style.background = arrived ? "var(--surface-white)" : SELECTED_BG;
    f.el.style.boxShadow = arrived
      ? "var(--shadow-dynamic)"
      : "0 0 0 rgba(0,0,0,0)";

    // top chip ke peeche wale layers ka text chhupa do, sirf kinara dikhe
    const showContent = !arrived || f.index === 0;
    f.icon.style.opacity = showContent ? "1" : "0";
    f.label.style.opacity = showContent ? "1" : "0";

    // 3 layers se zyada ho to baaki fade ho jayein, stack saaf rahe
    if (f.index >= 3) f.el.style.opacity = arrived ? "0" : "1";
    if (f.badge) f.badge.style.transform = arrived ? "scale(1)" : "scale(0)";
  };

  const tick = (now) => {
    const frames = Math.min(now - last, 50) / 16.67;
    last = now;

    for (const f of flies) {
      const k = 1 - Math.pow(1 - f.k, frames);

      const tx = returning ? f.ox : cur.x - OFFSET_X + f.off;
      const ty = returning ? f.oy : cur.y - OFFSET_Y + f.off;
      const tw = returning ? f.ow : CARD_W;
      const th = returning ? f.oh : CARD_H;

      f.x += (tx - f.x) * k;
      f.y += (ty - f.y) * k;
      f.w += (tw - f.w) * k;
      f.h += (th - f.h) * k;
      place(f);

      if (
        !returning &&
        !f.arrived &&
        Math.abs(tx - f.x) < 30 &&
        Math.abs(ty - f.y) < 30 &&
        Math.abs(tw - f.w) < 20
      ) {
        setArrived(f, true);
      }
    }

    raf = requestAnimationFrame(tick);
  };

  // cursor position: dragover mein har browser mein sahi coordinates milte hain
  const onOver = (ev) => {
    cur.x = ev.clientX;
    cur.y = ev.clientY;
  };

  const cleanup = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("dragover", onOver, true);
    window.removeEventListener("dragend", onEnd, true);
    window.removeEventListener("drop", onDrop, true);
    flies.forEach((f) => f.el.remove());
    endDragVisuals();
  };

  const onDrop = () => cleanup();

  const onEnd = (ev) => {
    // cancel (Esc / bahar drop): titles wapas apni jagah glide karein
    if (ev.dataTransfer?.dropEffect === "none" && !done) {
      returning = true;
      flies.forEach((f) => {
        f.k = 0.35;
        setArrived(f, false);
      });
      setTimeout(cleanup, 280);
    } else {
      cleanup();
    }
  };

  flies.forEach(place); // pehla frame bilkul asli titles ke upar
  document.addEventListener("dragover", onOver, true);
  window.addEventListener("dragend", onEnd, true);
  window.addEventListener("drop", onDrop, true);
  raf = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/*  Fallback chip (list view, reduced motion, titles not found)        */
/* ------------------------------------------------------------------ */

// Google-Drive-style chip: item icon + name, stacked cards behind, blue count badge
function createDragImage(name, count, iconHtml) {
  const wrap = document.createElement("div");
  // padding gives room for the stacked layers, shadow and the badge (all drawn in the drag image)
  wrap.style.cssText =
    "position:fixed;top:-1000px;left:-1000px;padding:14px 16px 16px 4px;pointer-events:none;";

  const stack = document.createElement("div");
  stack.style.cssText = "position:relative;width:240px;";

  const layer = (offset) => {
    const l = document.createElement("div");
    l.style.cssText = `position:absolute;inset:0;transform:translate(${offset}px,${offset}px);
      background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.3);`;
    return l;
  };
  // appended first => rendered behind the main card
  if (count > 2) stack.appendChild(layer(8));
  if (count > 1) stack.appendChild(layer(4));

  const card = document.createElement("div");
  card.style.cssText = `position:relative;display:flex;align-items:center;gap:12px;
    padding:10px 16px;background:#fff;color:#1f1f1f;border-radius:8px;
    box-shadow:0 1px 4px rgba(0,0,0,.3);font:14px system-ui,sans-serif;`;

  const icon = document.createElement("span");
  icon.style.cssText = "display:flex;flex-shrink:0;width:18px;height:18px;";
  icon.innerHTML =
    iconHtml ||
    '<span style="width:18px;height:18px;border-radius:3px;background:#4285f4;display:block"></span>';

  const label = document.createElement("span");
  label.textContent = name;
  label.style.cssText =
    "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

  card.append(icon, label);

  if (count > 1) {
    const badge = document.createElement("span");
    badge.textContent = count;
    badge.style.cssText = `position:absolute;top:-10px;right:-10px;min-width:22px;height:22px;
      padding:0 6px;box-sizing:border-box;border-radius:11px;background:#0b57d0;color:#fff;
      font-size:12px;font-weight:500;display:flex;align-items:center;justify-content:center;`;
    card.appendChild(badge);
  }

  stack.appendChild(card);
  wrap.appendChild(stack);
  document.body.appendChild(wrap);
  return wrap;
}

function endDragVisuals() {
  document.body.classList.remove(DRAG_BODY_CLASS);
  setTimeout(() => {
    activeDrag = null;
  }, 0);
}

export function setDriveDragData(e, ids, name, iconHtml) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
  e.dataTransfer.setData("text/plain", name ?? "");
  e.dataTransfer.effectAllowed = "move";
  activeDrag = { ids };
  setTimeout(() => document.body.classList.add(DRAG_BODY_CLASS), 0);
  window.addEventListener("dragend", endDragVisuals, { once: true, capture: true });
  window.addEventListener("drop", endDragVisuals, { once: true, capture: true });

  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const sources = !reduceMotion && EMPTY_IMG ? collectTitles(e, ids) : [];

  if (sources.length) {
    startStackDrag(e, sources, ids.length);
    return;
  }

  // fallback: static chip as before
  const chip = createDragImage(name, ids.length, iconHtml);
  e.dataTransfer.setDragImage(chip, 30, 30);
  setTimeout(() => chip.remove(), 0);
}