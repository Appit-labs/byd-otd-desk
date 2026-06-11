import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DepartmentsService } from './departments.service';
import { Department } from '../database/entities/department.entity';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockRepo: any;

  const mockDepartments = [
    { id: 1, name: 'Storage', slug: 'storage', pipelineOrder: 1, isActive: true },
    { id: 2, name: 'PDI', slug: 'pdi', pipelineOrder: 2, isActive: true },
  ];

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: getRepositoryToken(Department), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  describe('findAll', () => {
    it('should return all departments ordered by pipeline_order', async () => {
      mockRepo.find.mockResolvedValue(mockDepartments);
      const result = await service.findAll();
      expect(result).toEqual(mockDepartments);
      expect(mockRepo.find).toHaveBeenCalledWith({
        order: { pipelineOrder: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('should return a department by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockDepartments[0]);
      const result = await service.findById(1);
      expect(result).toEqual(mockDepartments[0]);
    });
  });

  describe('findBySlug', () => {
    it('should return a department by slug', async () => {
      mockRepo.findOne.mockResolvedValue(mockDepartments[0]);
      const result = await service.findBySlug('storage');
      expect(result).toEqual(mockDepartments[0]);
    });
  });
});
