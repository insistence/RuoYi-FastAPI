export function findField(fields, id) {
  for (const field of fields) {
    if (field.formId === id) return field;
    const child = findField(field.children || [], id);
    if (child) return child;
  }
  return null;
}
export function mapFields(fields, id, update) {
  return fields.map((field) =>
    field.formId === id
      ? update(field)
      : field.children
        ? { ...field, children: mapFields(field.children, id, update) }
        : field,
  );
}
export function removeField(fields, id) {
  return fields
    .filter((field) => field.formId !== id)
    .map((field) =>
      field.children
        ? { ...field, children: removeField(field.children, id) }
        : field,
    );
}
export function insertField(fields, field, parentId = null, beforeId = null) {
  if (parentId === null) {
    const next = [...fields];
    const index =
      beforeId === null
        ? -1
        : next.findIndex((item) => item.formId === beforeId);
    next.splice(index < 0 ? next.length : index, 0, field);
    return next;
  }
  return mapFields(fields, parentId, (parent) => ({
    ...parent,
    children: insertField(parent.children || [], field, null, beforeId),
  }));
}
export function moveField(fields, id, parentId, beforeId = null) {
  const item = findField(fields, id);
  if (
    !item ||
    id === parentId ||
    id === beforeId ||
    findField(item.children || [], parentId)
  )
    return fields;
  return insertField(removeField(fields, id), item, parentId, beforeId);
}
export function flattenFields(fields) {
  return fields.flatMap((field) => [
    field,
    ...flattenFields(field.children || []),
  ]);
}
export function parsePattern(value) {
  if (!value) return null;
  const match = String(value).match(/^\/(.*)\/([dgimsuvy]*)$/);
  try {
    return new RegExp(match ? match[1] : value, match ? match[2] : "");
  } catch {
    return null;
  }
}
export function fieldRules(field) {
  const rules = [];
  if (field.required)
    rules.push({ required: true, message: `请填写${field.label}` });
  for (const item of field.regList || []) {
    const pattern = parsePattern(item.pattern);
    if (pattern) rules.push({ pattern, message: item.message || "格式不正确" });
  }
  if (
    field.tag === "Checkbox.Group" &&
    (field.min != null || field.max != null)
  )
    rules.push({
      type: "array",
      min: field.min,
      max: field.max,
      message: "选择数量不符合要求",
    });
  return rules;
}
