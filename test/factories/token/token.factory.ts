import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { Factory } from '@jorgebodega/typeorm-factory';
import { Token } from '../../../src/tokens/entities/token.entity';
import { TOKEN_TYPE } from '../../../src/common/types/token-type';
import type { User } from '../../../src/users/entities/user.entity';

export class TokenFactory extends Factory<Token> {
  protected entity = Token;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<Token> {
    return {
      token: faker.string.alphanumeric(100),
      type: faker.helpers.arrayElement<TOKEN_TYPE>(Object.values(TOKEN_TYPE)),
      // user should be provided via makeForUser/createForUser
    };
  }

  /**
   * Creates a token with a specific user (in-memory only)
   */
  async makeForUser(user: User, type?: TOKEN_TYPE): Promise<Token> {
    return this.make({
      user,
      type:
        type ||
        faker.helpers.arrayElement<TOKEN_TYPE>(Object.values(TOKEN_TYPE)),
    });
  }

  /**
   * Creates and persists a token for a specific user
   */
  async createForUser(user: User, type?: TOKEN_TYPE): Promise<Token> {
    const token = await this.makeForUser(user, type);
    return this.dataSource.getRepository(Token).save(token);
  }

  /**
   * Backwards-compatible alias (older tests may still call these).
   */
  async makeForOperator(operator: User, type?: TOKEN_TYPE): Promise<Token> {
    return this.makeForUser(operator, type);
  }
  async createForOperator(operator: User, type?: TOKEN_TYPE): Promise<Token> {
    return this.createForUser(operator, type);
  }
}
