export const DRAG_MIME = "application/x-drive-items";

export const hasDriveDrag = (e) =>
  Array.from(e.dataTransfer?.types ?? []).includes(DRAG_MIME);

export const readDriveDrag = (e) => {
  try {
    return JSON.parse(e.dataTransfer.getData(DRAG_MIME)) ?? [];
  } catch {
    return [];
  }
};

const DRAG_BODY_CLASS = "gd-drag-active";

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
}

export function setDriveDragData(e, ids, name, iconHtml) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
  e.dataTransfer.setData("text/plain", name ?? "");
  e.dataTransfer.effectAllowed = "move";

  const chip = createDragImage(name, ids.length, iconHtml);
  e.dataTransfer.setDragImage(chip, 30, 30);
  setTimeout(() => chip.remove(), 0);


  setTimeout(() => document.body.classList.add(DRAG_BODY_CLASS), 0);
  window.addEventListener("dragend", endDragVisuals, { once: true, capture: true });
  window.addEventListener("drop", endDragVisuals, { once: true, capture: true });
}