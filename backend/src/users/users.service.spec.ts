import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from '../database/entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: any;

  const mockUser = {
    id: 1,
    username: 'testuser',
    password: '$2b$12$hashedpassword',
    fullName: 'Test User',
    role: UserRole.DEPARTMENT_USER,
    departmentId: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(async () => {
    mockRepo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findById(1);
      expect(result).toEqual(mockUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should return null if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findByUsername('testuser');
      expect(result).toEqual(mockUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createDto = {
        username: 'newuser',
        password: 'Password123',
        fullName: 'New User',
        role: UserRole.DEPARTMENT_USER,
        departmentId: 1,
      };

      mockRepo.findOne.mockResolvedValue(null); // no existing user
      mockRepo.create.mockReturnValue({ ...createDto, id: 2 });
      mockRepo.save.mockResolvedValue({ ...createDto, id: 2 });

      const result = await service.create(createDto);
      expect(result).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw if username exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.create({
          username: 'testuser',
          password: 'Password123',
          fullName: 'Test',
          role: UserRole.VIEWER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.save.mockResolvedValue({ ...mockUser, fullName: 'Updated' });

      const result = await service.update(1, { fullName: 'Updated' });
      expect(result.fullName).toBe('Updated');
    });

    it('should throw if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, { fullName: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.save.mockResolvedValue({ ...mockUser, isActive: false });

      await service.deactivate(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate(999)).rejects.toThrow(NotFoundException);
    });
  });
});
