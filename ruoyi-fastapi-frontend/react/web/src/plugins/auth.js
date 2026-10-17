import { checkPermi, checkRole } from "@/utils/permission";
export default {
  // 验证用户是否具备指定权限。
  hasPermi: (permission) => !!permission && checkPermi([permission]),
  // 验证用户是否具备权限列表中的任意一项。
  hasPermiOr: (permissions) =>
    Array.isArray(permissions) && permissions.length > 0 && checkPermi(permissions),
  // 验证用户是否具备权限列表中的全部权限。
  hasPermiAnd: (permissions) =>
    Array.isArray(permissions) &&
    permissions.length > 0 &&
    permissions.every((permission) => checkPermi([permission])),
  // 验证用户是否具备指定角色。
  hasRole: (role) => !!role && checkRole([role]),
  // 验证用户是否具备角色列表中的任意一项。
  hasRoleOr: (roles) => Array.isArray(roles) && roles.length > 0 && checkRole(roles),
  // 验证用户是否具备角色列表中的全部角色。
  hasRoleAnd: (roles) =>
    Array.isArray(roles) && roles.length > 0 && roles.every((role) => checkRole([role])),
};
