export type AuthUserRole = 'ADMIN' | 'PRINCIPAL' | 'TEACHER';

export interface AuthUserContext {
  tenantId: string;
  userId: number;
  role: AuthUserRole;
}

