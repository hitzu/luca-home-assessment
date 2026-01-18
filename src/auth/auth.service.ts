import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EXCEPTION_RESPONSE } from 'src/config/errors/exception-response.config';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { DevLoginResponseDto } from './dto/dev-login-response.dto';
import type { DevTokenRole } from './guards/dev-token.guard';
import { USER_ROLES } from '../common/types/user-roles.type';
import { TokenService } from '../tokens/token.service';
import type { User } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { TOKEN_TYPE } from '../common/types/token-type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Dev-only auth service. Do not use this implementation in production.
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) { }

  public async signup(
    createUserDto: CreateUserDto,
  ): Promise<DevLoginResponseDto> {
    const user = await this.usersService.createUser(createUserDto);
    const response = this.buildDevLoginResponse(user);
    await this.tokenService.registerToken({
      token: response.token,
      type: TOKEN_TYPE.ACCESS,
      userId: user.id,
    });
    return response;
  }

  public async login(loginDto: LoginDto): Promise<DevLoginResponseDto> {
    const { userId } = loginDto;
    this.logger.log({ userId }, 'Dev login requested (test-only)');

    const user = userId
      ? await this.usersService.getUserById(userId)
      : await this.pickRandomUser();

    const response = this.buildDevLoginResponse(user);
    await this.tokenService.registerToken({
      token: response.token,
      type: TOKEN_TYPE.ACCESS,
      userId: user.id,
    });

    this.logger.log(
      {
        requestedUserId: userId,
        chosenUserId: response.userId,
      },
      'Dev login completed',
    );

    return response;
  }

  private async pickRandomUser(): Promise<User> {
    const users = await this.usersService.findAllUsers();
    if (!users.length) {
      this.logger.error('No users available for dev login');
      throw new NotFoundException(EXCEPTION_RESPONSE.USER_NOT_FOUND);
    }

    const randomIndex = Math.floor(Math.random() * users.length);
    return users[randomIndex];
  }

  private buildDevLoginResponse(user: User): DevLoginResponseDto {
    const role = this.mapUserRoleToDevRole(user.role);
    const tenantId = this.buildTenantId(user);
    const userId = user.id;
    const timestamp = Math.floor(Date.now() / 1000);

    const token = `DEV.v1.Tenant${tenantId}.${userId}.${role}.${timestamp}`;

    return {
      token,
      userId,
      tenantId,
      role,
    };
  }

  private mapUserRoleToDevRole(userRole: USER_ROLES): DevTokenRole {
    if (userRole === USER_ROLES.ADMIN) {
      return 'ADMIN';
    }

    if (userRole === USER_ROLES.PRINCIPAL) {
      return 'PRINCIPAL';
    }

    return 'TEACHER';
  }

  private buildTenantId(user: User): number {
    return user.tenantId;
  }

}
