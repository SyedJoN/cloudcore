const rolePermissions = {
  admin: ["*"],
  manager: ["read:all_files", "read:users"],
  user: ["read:own_files", "write:own_files", "delete:own_files"],
};
