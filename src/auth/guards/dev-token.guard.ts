import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../../tokens/token.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { AuthUserContext, AuthUserRole } from '../types/auth-user-context';
import { parseDevToken } from '../utils/parse-dev-token';

// Lightweight dev-only guard: parses a simple dev token and attaches it to the request.
export type DevTokenRole = AuthUserRole;

@Injectable()
export class DevTokenGuard implements CanActivate {
  private readonly logger = new Logger(DevTokenGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Authorization header missing');
    }

    const [scheme, rawToken] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !rawToken) {
      this.logger.warn('Invalid Authorization scheme');
      throw new UnauthorizedException('Bearer token required');
    }

    let authUser: AuthUserContext;
    try {
      authUser = parseDevToken(rawToken);
    } catch (error) {
      this.logger.warn({ error }, 'Dev token parsing failed');
      throw new UnauthorizedException('Invalid dev token format');
    }

    const tokenRecord = await this.tokenService.findActiveToken(rawToken);
    if (!tokenRecord) {
      this.logger.warn('Token not registered in store');
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (
      tokenRecord.user &&
      tokenRecord.user.id !== authUser.userId
    ) {
      this.logger.warn('Token does not belong to provided user');
      throw new UnauthorizedException('Token user mismatch');
    }

    request.authUser = authUser;
    this.logger.debug(
      `Accepted dev token for user ${authUser.userId} in tenant ${authUser.tenantId}`,
    );

    return true;
  }
}
