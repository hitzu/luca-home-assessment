import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import { Factory } from '@jorgebodega/typeorm-factory';
import { DataSource } from 'typeorm';

import { USER_ROLES } from '../../../src/common/types/user-roles.type';
import { USER_STATUS } from '../../../src/common/types/user-status.type';
import { User } from '../../../src/users/entities/user.entity';

/**
 * Factory for `User` records.
 *
 * Note: This file previously exported `OperatorFactory` but the current domain
 * uses `User`. We keep `OperatorFactory` as a backwards-compatible alias.
 */
export class UserFactory extends Factory<User> {
  protected entity = User;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<User> {
    return {
      tenantId: faker.number.int({ min: 1, max: 10_000 }),
      email: faker.internet.email({ provider: 'school.edu' }).toLowerCase(),
      fullName: faker.person.fullName(),
      role: faker.helpers.arrayElement<USER_ROLES>(
        Object.values(USER_ROLES),
      ),
      status: USER_STATUS.ACTIVE,
      scopes: null,
      lastLoginAt: null,
    };
  }

  async createForTenant(
    tenantId: number,
    overrides?: Partial<FactorizedAttrs<User>>,
  ): Promise<User> {
    return this.create({
      tenantId,
      ...overrides,
    });
  }
}
