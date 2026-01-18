import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUserContext } from '../types/auth-user-context';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Decorator to extract the authenticated user from the request.
 *
 * @param property - Optional property name to extract from the user object
 * @returns The full AuthUserContext or a specific property value
 *
 * @example
 * // Get the full user object
 * findAll(@User() user: AuthUserContext) { ... }
 *
 * @example
 * // Get a specific property
 * findAll(@User('id') userId: number) { ... }
 *
 * @example
 * // Get email
 * findAll(@User('email') email: string) { ... }
 */
export const AuthUser = createParamDecorator(
  <K extends keyof AuthUserContext>(
    data: K | undefined,
    context: ExecutionContext,
  ): AuthUserContext | AuthUserContext[K] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;

    if (!user) {
      return undefined as unknown as AuthUserContext | AuthUserContext[K];
    }

    return data ? user[data] : user;
  },
);
