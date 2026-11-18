import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config();

// In the Docker container, compiled JS is under dist/ — TS sources don't exist.
// Detect the runtime environment so both local dev and Docker work.
const isCompiled = existsSync(join(__dirname, '..', '..', 'dist'));

const entities = isCompiled
  ? ['dist/database/entities/**/*.entity.js']
  : ['src/database/entities/**/*.entity.ts'];

const migrations = isCompiled
  ? ['dist/database/migrations/**/*.js']
  : ['src/database/migrations/**/*.ts'];

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'byd_otd_desk',
  entities,
  migrations,
  logging: process.env.DB_LOGGING === 'true',
});
