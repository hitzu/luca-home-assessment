import type { AuthUserContext, AuthUserRole } from '../types/auth-user-context';

const DEV_TOKEN_PREFIX = 'DEV';
const DEV_TOKEN_VERSION = 'v1';
const DEV_TOKEN_ROLES: AuthUserRole[] = ['ADMIN', 'PRINCIPAL', 'TEACHER'];

export function parseDevToken(rawToken: string): AuthUserContext {
  const parts = rawToken.split('.');
  if (parts.length !== 6) {
    throw new Error('Invalid dev token format');
  }

  const [prefix, version, tenantId, userId, role, timestamp] = parts;
  if (prefix !== DEV_TOKEN_PREFIX || version !== DEV_TOKEN_VERSION) {
    throw new Error('Invalid dev token prefix or version');
  }

  const parsedUserId = Number(userId);
  if (!Number.isFinite(parsedUserId)) {
    throw new Error('Invalid dev token userId');
  }

  if (!DEV_TOKEN_ROLES.includes(role as AuthUserRole)) {
    throw new Error('Invalid dev token role');
  }

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) {
    throw new Error('Invalid dev token timestamp');
  }

  if (!tenantId) {
    throw new Error('Invalid dev token tenantId');
  }

  return {
    tenantId,
    userId: parsedUserId,
    role: role as AuthUserRole,
  };
}

