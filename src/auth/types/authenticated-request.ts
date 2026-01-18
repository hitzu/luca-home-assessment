import type { Request } from 'express';

import type { AuthUserContext } from './auth-user-context';

export type AuthenticatedRequest = Request & { authUser?: AuthUserContext };

