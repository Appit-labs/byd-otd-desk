import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'byd_otd_desk',
  entities: [join(__dirname, '../database/entities/**/*.entity.js')],
  migrations: [join(__dirname, '../database/migrations/**/*.js')],
  logging: process.env.DB_LOGGING === 'true',
});
