import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { AdminRoleGuard } from './admin-role.guard';

describe('AdminRoleGuard', () => {
  let guard: AdminRoleGuard;

  beforeEach(() => {
    guard = new AdminRoleGuard();
  });

  const makeContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  it('allows when authUser role is ADMIN', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: { tenantId: 'Tenant1', userId: 1, role: 'ADMIN' },
    });

    // Act
    const allowed = await guard.canActivate(ctx);

    // Assert
    expect(allowed).toBe(true);
  });

  it('throws ForbiddenException when authUser is missing', async () => {
    // Arrange
    const ctx = makeContext({});

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when role is not ADMIN', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: { tenantId: 'Tenant1', userId: 1, role: 'TEACHER' },
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

