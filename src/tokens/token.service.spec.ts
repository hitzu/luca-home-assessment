import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { TOKEN_TYPE } from '../common/types/token-type';
import { UserFactory } from '@factories/user/user.factory';
import { Token } from './entities/token.entity';
import { TokenService } from './token.service';
import { User } from '../users/entities/user.entity';

describe('TokenService', () => {
  let service: TokenService;
  let tokenRepo: Repository<Token>;
  let userRepo: Repository<User>;
  let userFactory: UserFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: getRepositoryToken(Token),
          useValue: TestDataSource.getRepository(Token),
        },
        {
          provide: getRepositoryToken(User),
          useValue: TestDataSource.getRepository(User),
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    tokenRepo = module.get<Repository<Token>>(getRepositoryToken(Token));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    userFactory = new UserFactory(TestDataSource);
  });

  describe('registerToken', () => {
    it('creates token and links user when userId is provided', async () => {
      // Arrange
      const user = await userRepo.save(await userFactory.make());
      const token = 'DEV.v1.1.1.ADMIN.1700000000';

      // Act
      const saved = await service.registerToken({
        token,
        type: TOKEN_TYPE.ACCESS,
        userId: user.id,
      });
      const persisted = await tokenRepo.findOne({
        where: { id: saved.id },
        relations: { user: true },
      });

      // Assert
      expect(saved.id).toBeDefined();
      expect(saved.token).toBe(token);
      expect(persisted?.user?.id).toBe(user.id);
    });

    it('creates token with null user when userId is not provided', async () => {
      // Arrange
      const token = 'DEV.v1.1.2.TEACHER.1700000001';

      // Act
      const saved = await service.registerToken({
        token,
        type: TOKEN_TYPE.ACCESS,
        userId: null,
      });
      const persisted = await tokenRepo.findOne({
        where: { id: saved.id },
        relations: { user: true },
      });

      // Assert
      expect(saved.id).toBeDefined();
      expect(persisted?.user).toBeNull();
    });
  });

  describe('findActiveToken', () => {
    it('returns token with user relation when present, otherwise null', async () => {
      // Arrange
      const user = await userRepo.save(await userFactory.make());
      const rawToken = 'DEV.v1.99.100.ADMIN.1700000002';
      await service.registerToken({
        token: rawToken,
        type: TOKEN_TYPE.ACCESS,
        userId: user.id,
      });

      // Act
      const found = await service.findActiveToken(rawToken);
      const missing = await service.findActiveToken('missing-token');

      // Assert
      expect(found).not.toBeNull();
      expect(found?.token).toBe(rawToken);
      expect(found?.user?.id).toBe(user.id);
      expect(missing).toBeNull();
    });
  });
});

