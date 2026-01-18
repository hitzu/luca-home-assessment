import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const stage = process.env.NODE_ENV || 'local';
const isTest = stage === 'test';

const envPath = path.join(__dirname, '../../../', `.env.${stage}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const url = process.env.DB_URL;
const isProduction = stage === 'production' || stage === 'prod';
const schema = process.env.DB_SCHEMA || 'public';

const baseConfig = url
  ? {
    type: 'postgres' as const,
    url,
    schema,
    ssl: isProduction
      ? {
        rejectUnauthorized: false,
      }
      : false,
  }
  : {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isTest ? '57433' : '57432'), 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || (isTest ? 'luca_test' : 'luca_dev'),
    schema,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };

export const AppDataSource = new DataSource({
  ...baseConfig,
  synchronize: isTest,
  logging: false,
  dropSchema: isTest,

  entities: [path.join(__dirname, '../../**/entities/*.entity{.ts,.js}')],
  migrations: isTest
    ? []
    : [path.join(__dirname, '../../database/migrations/**/*{.ts,.js}')],
  subscribers: [path.join(__dirname, '../../subscribers/**/*{.ts,.js}')],

  poolSize: isProduction ? 20 : 5,

  extra: {
    max: isProduction ? 20 : 5,
    connectionTimeoutMillis: isProduction ? 10000 : 2000,
    idleTimeoutMillis: 30000,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    // Set PostgreSQL search_path to use the specified schema
    options: `-c search_path=${schema}`,
  },
});
