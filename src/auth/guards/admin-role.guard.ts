import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser = request.authUser;

    if (!authUser) {
      throw new ForbiddenException('Authentication required');
    }

    if (authUser.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}

