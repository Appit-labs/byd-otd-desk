import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../database/entities/user.entity';

import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;

  const mockUser = {
    id: 1,
    username: 'superadmin',
    password: '$2b$12$dummyhash', // bcrypt hash of 'Admin@123'
    fullName: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    departmentId: null,
    isActive: true,
  };

  beforeEach(async () => {
    usersService = {
      findByUsername: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should throw on invalid username', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      await expect(
        service.login({ username: 'nobody', password: 'test' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on inactive user', async () => {
      usersService.findByUsername.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      await expect(
        service.login({ username: 'superadmin', password: 'Admin@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return token and user on successful login', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      usersService.findByUsername.mockResolvedValue(mockUser);

      const result = await service.login({
        username: 'superadmin',
        password: 'Admin@123',
      });

      expect(result).toHaveProperty('access_token', 'test-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', 1);
      expect(result.user).toHaveProperty('full_name', 'Super Admin');
      expect(result.user).toHaveProperty('role', UserRole.SUPER_ADMIN);
      expect(result.user).toHaveProperty('department_id', null);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'superadmin',
        role: UserRole.SUPER_ADMIN,
        departmentId: null,
      });
    });
  });
});
