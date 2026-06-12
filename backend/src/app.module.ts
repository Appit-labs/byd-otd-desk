import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { User } from './database/entities/user.entity.js';
import { Department } from './database/entities/department.entity.js';
import { CarRequest } from './database/entities/car-request.entity.js';
import { RequestStageTransition } from './database/entities/request-stage-transition.entity.js';
import { Setting } from './database/entities/setting.entity.js';
import { SettingOption } from './database/entities/setting-option.entity.js';
import { SeederService } from './common/seeder.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'byd_otd_desk'),
        entities: [
          User,
          Department,
          CarRequest,
          RequestStageTransition,
          Setting,
          SettingOption,
        ],
        synchronize: configService.get('DB_SYNC', 'false') === 'true',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Department,
      CarRequest,
      RequestStageTransition,
      Setting,
      SettingOption,
    ]),
    AuthModule,
    UsersModule,
    DepartmentsModule,
    RequestsModule,
    SettingsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeederService],
})
export class AppModule {}
