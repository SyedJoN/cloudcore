const ROLE_PRIORITY = {
  superuser: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

const canAccess = (currentRole, targetRole) =>
  ROLE_PRIORITY[currentRole] > ROLE_PRIORITY[targetRole];

export default canAccess