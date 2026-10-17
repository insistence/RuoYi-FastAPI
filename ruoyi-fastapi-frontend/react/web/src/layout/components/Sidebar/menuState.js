export function findMenuPath(items, key, parents = []) {
  for (const item of items) {
    const path = [...parents, item.key];
    if (item.key === key) return path;
    const found = findMenuPath(item.children || [], key, path);
    if (found.length) return found;
  }
  return [];
}

// Like el-menu's unique-opened: retain ancestors, close competing branches at every depth.
export function resolveOpenKeys(items, previous, next) {
  const opening = next.find((key) => !previous.includes(key));
  if (opening) return findMenuPath(items, opening);
  return next.filter((key) => findMenuPath(items, key).every((parent) => next.includes(parent)));
}
