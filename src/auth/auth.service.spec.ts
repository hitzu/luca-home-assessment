import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserFactory } from '@factories/user/user.factory';
import { TOKEN_TYPE } from '../common/types/token-type';
import { USER_ROLES } from '../common/types/user-roles.type';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Token } from '../tokens/entities/token.entity';
import { TokenService } from '../tokens/token.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService (dev-only)', () => {
  let service: AuthService;
  let userRepo: Repository<User>;
  let tokenRepo: Repository<Token>;
  let userFactory: UserFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        UsersRepository,
        TokenService,
        {
          provide: getRepositoryToken(User),
          useValue: TestDataSource.getRepository(User),
        },
        {
          provide: getRepositoryToken(Token),
          useValue: TestDataSource.getRepository(Token),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    tokenRepo = module.get<Repository<Token>>(getRepositoryToken(Token));
    userFactory = new UserFactory(TestDataSource);
  });

  describe('signup', () => {
    it('creates user and registers issued ACCESS token', async () => {
      // Arrange
      const dto: CreateUserDto = {
        tenantId: 123,
        email: 'signup@school.edu',
        fullName: 'Signup User',
        role: USER_ROLES.ADMIN,
      };

      // Act
      const response = await service.signup(dto);
      const persistedUser = await userRepo.findOne({
        where: { id: response.userId },
      });
      const persistedToken = await tokenRepo.findOne({
        where: { token: response.token, type: TOKEN_TYPE.ACCESS },
        relations: { user: true },
      });

      // Assert
      expect(response.userId).toBeDefined();
      expect(response.tenantId).toBe(dto.tenantId);
      expect(response.role).toBe('ADMIN');
      expect(response.token).toContain(`.${response.userId}.ADMIN.`);
      expect(persistedUser).not.toBeNull();
      expect(persistedToken).not.toBeNull();
      expect(persistedToken?.user?.id).toBe(response.userId);
    });
  });

  describe('login', () => {
    it('logs in requested user and registers issued ACCESS token', async () => {
      // Arrange
      const user = await userRepo.save(
        await userFactory.make({
          tenantId: 77,
          role: USER_ROLES.PRINCIPAL,
        }),
      );

      // Act
      const response = await service.login({ userId: user.id });
      const persistedToken = await tokenRepo.findOne({
        where: { token: response.token, type: TOKEN_TYPE.ACCESS },
        relations: { user: true },
      });

      // Assert
      expect(response.userId).toBe(user.id);
      expect(response.tenantId).toBe(user.tenantId);
      expect(response.role).toBe('PRINCIPAL');
      expect(persistedToken?.user?.id).toBe(user.id);
    });

    it('when userId is omitted, picks a random existing user', async () => {
      // Arrange
      const userA = await userRepo.save(
        await userFactory.make({ tenantId: 1, role: USER_ROLES.TEACHER }),
      );
      const userB = await userRepo.save(
        await userFactory.make({ tenantId: 1, role: USER_ROLES.ADMIN }),
      );

      // Act
      const response = await service.login({});

      // Assert
      expect([userA.id, userB.id]).toContain(response.userId);
      expect(response.token).toContain(`.${response.userId}.`);
    });

    it('throws NotFoundException with USER_NOT_FOUND when no users exist', async () => {
      // Act / Assert
      await expect(service.login({})).rejects.toEqual(
        new NotFoundException(EXCEPTION_RESPONSE.USER_NOT_FOUND),
      );
    });
  });
});

