/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';

export const getLoggerConfigs = (): Params => {
  const isProduction = process.env.NODE_ENV === 'prod';
  const isDevelopment = process.env.NODE_ENV === 'local';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      genReqId: (req) => req.headers['x-request-id'] || randomUUID(),

      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,

      serializers: {
        req: (req: any) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode as number,
        }),
      },

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'token',
          'secret',
          'creditCard',
        ],
        censor: '[REDACTED]',
      },

      base: {
        env: process.env.NODE_ENV,
        service: 'bookandsign-api',
      },
    },
  };
};
