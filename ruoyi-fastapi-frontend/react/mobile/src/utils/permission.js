import { useUserStore } from "@/store";
export function checkPermi(values) {
  const { permissions } = useUserStore.getState();
  return (
    !!values?.length &&
    permissions.some((item) => item === "*:*:*" || values.includes(item))
  );
}
export function checkRole(values) {
  const { roles } = useUserStore.getState();
  return (
    !!values?.length &&
    roles.some((item) => item === "admin" || values.includes(item))
  );
}
