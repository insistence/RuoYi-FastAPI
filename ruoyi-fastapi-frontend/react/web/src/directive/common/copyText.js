/**
 * 复制文本内容。
 * Copyright (c) 2022 ruoyi
 *
 * @param {*} value 待复制的值，null 和 undefined 按空字符串处理
 * @returns {Promise<void>} 复制完成；写入剪贴板失败时拒绝
 */
export async function copyText(value) {
  const text = String(value ?? "");
  // 优先使用浏览器剪贴板 API，不支持时使用临时文本域兼容。
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const prior = document.activeElement,
    field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    if (!document.execCommand("copy")) throw new Error("复制失败，请手动复制");
  } finally {
    field.remove();
    // 移除临时节点后，将焦点交还给原先的元素。
    prior?.focus?.();
  }
}
export default copyText;
