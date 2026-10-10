// The mask and both outline strokes share these coordinates, including on
// Retina screens and when a target is partly outside the viewport.
export function spotlightGeometry(box, viewport, { radius = 0, padding = 5, pixelRatio = 1 } = {}) {
  const ratio = Math.max(1, pixelRatio || 1);
  const snap = value => Math.round(value * ratio) / ratio;
  const edge = (value, limit) => snap(Math.max(4, Math.min(limit - 4, value)));
  const left = edge(box.left - padding, viewport.width);
  const top = edge(box.top - padding, viewport.height);
  const right = Math.max(left, edge(box.right + padding, viewport.width));
  const bottom = Math.max(top, edge(box.bottom + padding, viewport.height));
  const r = Math.floor(Math.max(0, Math.min(radius + padding, (right - left) / 2, (bottom - top) / 2)) * ratio) / ratio;
  return { left, top, right, bottom, radius: r };
}

export function roundedSpotlightPath({ left: x, top: y, right, bottom, radius: r }) {
  if (!r) return `M${x} ${y} H${right} V${bottom} H${x} Z`;
  return `M${x + r} ${y} H${right - r} A${r} ${r} 0 0 1 ${right} ${y + r} V${bottom - r} A${r} ${r} 0 0 1 ${right - r} ${bottom} H${x + r} A${r} ${r} 0 0 1 ${x} ${bottom - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}
