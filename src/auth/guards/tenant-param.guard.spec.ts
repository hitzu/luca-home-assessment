import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { TenantParamGuard } from './tenant-param.guard';

describe('TenantParamGuard', () => {
  let guard: TenantParamGuard;

  beforeEach(() => {
    guard = new TenantParamGuard();
  });

  const makeContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  it('allows when tenantId param matches authUser tenantId', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: { tenant: 'Tenant', tenantId: '1', userId: 1, role: 'ADMIN' },
      params: { tenantId: '1' },
    });

    // Act
    const allowed = await guard.canActivate(ctx);

    // Assert
    expect(allowed).toBe(true);
  });

  it('throws ForbiddenException when authUser is missing', async () => {
    // Arrange
    const ctx = makeContext({ params: { tenantId: '1' } });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when tenantId param is missing', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: { tenantId: 'Tenant1', userId: 1, role: 'ADMIN' },
      params: {},
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when tenantId param mismatches authUser tenantId', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: { tenantId: 'Tenant1', userId: 1, role: 'ADMIN' },
      params: { tenantId: '2' },
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

