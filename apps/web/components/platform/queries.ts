/** Query keys for the platform console pages owned by the schools/users/settings module. */
export const platformKeys = {
  schools: ['platform', 'schools'] as const,
  schoolList: (q: string) => ['platform', 'schools', 'list', q] as const,
  school: (id: string) => ['platform', 'schools', 'detail', id] as const,
  admins: (id: string) => ['platform', 'schools', 'admins', id] as const,
  view: (id: string, view: string, q: string, page: number) => ['platform', 'schools', 'view', id, view, q, page] as const,
  activity: (id: string) => ['platform', 'schools', 'activity', id] as const,
  users: (q: string) => ['platform', 'users', q] as const,
  settings: ['platform', 'settings'] as const,
  me: ['platform', 'me'] as const,
};
