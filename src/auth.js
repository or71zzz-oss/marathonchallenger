export function isAdminUser(user) {
  return user?.role === 'admin' || user?.name === '관리자';
}
