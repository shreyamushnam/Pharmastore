export function hasAdminRole(profile: { role: string } | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'admin';
}

export function isSuperAdmin(profile: { role: string } | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin';
}

export function isManager(profile: { role: string } | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'manager';
}
