import useUserStore from '@/store/modules/user'
/**
 * 角色权限处理：具备任一指定角色或 admin 角色时渲染子内容。
 * Copyright (c) 2019 ruoyi
 *
 * @param {Object} props 组件属性
 * @param {string[]} [props.value=[]] 待校验的角色列表，空列表不渲染
 * @param {import("react").ReactNode} props.children 受角色控制的内容
 * @returns {import("react").ReactNode} 有权限时的子内容，否则为 null
 */
export default function HasRole({ value = [], children }) {
  const roles = useUserStore((state) => state.roles)
  return Array.isArray(value) &&
    value.length > 0 &&
    (roles.includes('admin') || value.some((role) => roles.includes(role)))
    ? children
    : null
}
