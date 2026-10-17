export function initialCrop(width, height) {
  const size = Math.min(width, height) * 0.75;
  return {
    x: (width - size) / 2,
    y: (height - size) / 2,
    width: size,
    height: size,
  };
}
export function moveCrop(crop, dx, dy, width, height) {
  return {
    ...crop,
    x: Math.max(0, Math.min(width - crop.width, crop.x + dx)),
    y: Math.max(0, Math.min(height - crop.height, crop.y + dy)),
  };
}
export function resizeCrop(crop, dx, dy, width, height, edge = "bottom-right") {
  const minWidth = Math.min(24, width);
  const minHeight = Math.min(24, height);
  let { x, y } = crop;
  let right = x + crop.width;
  let bottom = y + crop.height;
  if (edge.includes("left"))
    x = Math.max(0, Math.min(right - minWidth, x + dx));
  if (edge.includes("top"))
    y = Math.max(0, Math.min(bottom - minHeight, y + dy));
  if (edge.includes("right"))
    right = Math.min(width, Math.max(x + minWidth, right + dx));
  if (edge.includes("bottom"))
    bottom = Math.min(height, Math.max(y + minHeight, bottom + dy));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}
export function sourceCrop(crop, view, source) {
  const scaleX = source.width / view.width;
  const scaleY = source.height / view.height;
  return {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };
}
