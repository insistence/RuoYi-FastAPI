import useUserStore from '@/store/modules/user'
/**
 * 操作权限处理：具备任一指定权限或通配权限时渲染子内容。
 * Copyright (c) 2019 ruoyi
 *
 * @param {Object} props 组件属性
 * @param {string[]} props.value 待校验的权限列表，空列表不渲染
 * @param {import("react").ReactNode} props.children 受权限控制的内容
 * @returns {import("react").ReactNode} 有权限时的子内容，否则为 null
 */
export default function HasPermi({ value, children }) {
  const permissions = useUserStore((state) => state.permissions)
  if (!Array.isArray(value) || !value.length) return null
  return permissions.includes('*:*:*') || value.some((item) => permissions.includes(item))
    ? children
    : null
}
