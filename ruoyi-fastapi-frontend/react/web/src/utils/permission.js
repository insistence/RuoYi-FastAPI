import useUserStore from '@/store/modules/user'
/**
 * 校验当前用户是否具备任一指定权限；通配权限 *:*:* 直接通过。
 * @param {string[]} permissions 待校验的权限列表
 * @returns {boolean} 是否通过权限校验
 */
export function checkPermi(permissions) {
  const current = useUserStore.getState().permissions
  return current.includes('*:*:*') || permissions.some((permission) => current.includes(permission))
}
/**
 * 校验当前用户是否具备任一指定角色；admin 角色直接通过。
 * @param {string[]} roles 待校验的角色列表
 * @returns {boolean} 是否通过角色校验
 */
export function checkRole(roles) {
  const current = useUserStore.getState().roles
  return current.includes('admin') || roles.some((role) => current.includes(role))
}
