import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SettingsService } from './settings.service';
import { Setting } from '../database/entities/setting.entity';
import { SettingOption } from '../database/entities/setting-option.entity';

/** Create a minimal mock SettingOption with all required fields */
function mockOption(overrides: Partial<SettingOption> = {}): SettingOption {
  return {
    id: 1,
    settingId: 1,
    parentId: null,
    label: 'Red',
    value: 'red',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    setting: undefined as any,
    parent: undefined as any,
    children: [],
    ...overrides,
  } as SettingOption;
}

describe('SettingsService', () => {
  let service: SettingsService;
  let settingsRepo: any;
  let optionsRepo: any;
  let dataSource: any;

  const mockSetting: Setting = {
    id: 1,
    key: 'car_color',
    label: 'Car Color',
    description: 'Available car colors',
    options: [
      mockOption({ id: 1, label: 'Red', value: 'red', sortOrder: 0 }),
      mockOption({ id: 2, label: 'Blue', value: 'blue', sortOrder: 1 }),
    ],
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    settingsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    optionsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    // Reset query runner mocks between tests
    mockQueryRunner.connect.mockReset();
    mockQueryRunner.startTransaction.mockReset();
    mockQueryRunner.commitTransaction.mockReset();
    mockQueryRunner.rollbackTransaction.mockReset();
    mockQueryRunner.release.mockReset();
    mockQueryRunner.manager.findOne.mockReset();
    mockQueryRunner.manager.save.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(Setting),
          useValue: settingsRepo,
        },
        {
          provide: getRepositoryToken(SettingOption),
          useValue: optionsRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('getAll', () => {
    it('should return all settings with options sorted by sort_order', async () => {
      settingsRepo.find.mockResolvedValue([mockSetting]);

      const result = await service.getAll();

      expect(result).toEqual([mockSetting]);
      expect(settingsRepo.find).toHaveBeenCalledWith({
        relations: { options: true },
        order: { options: { sortOrder: 'ASC' } },
      });
    });
  });

  describe('getByKey', () => {
    it('should return a single setting with sorted options', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);

      const result = await service.getByKey('car_color');

      expect(result).toEqual(mockSetting);
      expect(result.options[0].sortOrder).toBe(0);
      expect(result.options[1].sortOrder).toBe(1);
      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { key: 'car_color' },
        relations: { options: true },
      });
    });

    it('should throw NotFoundException for unknown key', async () => {
      settingsRepo.findOne.mockResolvedValue(null);

      await expect(service.getByKey('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addOption', () => {
    it('should create a new option with auto sort_order (max + 1)', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      optionsRepo.findOne.mockResolvedValue(
        mockOption({ id: 2, sortOrder: 1 }),
      );

      const dto = { label: 'Green', value: 'green' };
      const createdOption = mockOption({ label: 'Green', value: 'green', sortOrder: 2 });
      optionsRepo.create.mockReturnValue(createdOption);
      optionsRepo.save.mockResolvedValue({ ...createdOption, id: 3 });

      const result = await service.addOption('car_color', dto);

      expect(optionsRepo.create).toHaveBeenCalledWith({
        settingId: 1,
        label: 'Green',
        value: 'green',
        sortOrder: 2,
      });
      expect(optionsRepo.save).toHaveBeenCalledWith(createdOption);
      expect(result).toEqual({ ...createdOption, id: 3 });
    });

    it('should use provided sort_order when given', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);

      const dto = { label: 'Green', value: 'green', sortOrder: 5 };
      const createdOption = mockOption({ label: 'Green', value: 'green', sortOrder: 5 });
      optionsRepo.create.mockReturnValue(createdOption);
      optionsRepo.save.mockResolvedValue({ ...createdOption, id: 3 });

      const result = await service.addOption('car_color', dto);

      expect(optionsRepo.create).toHaveBeenCalledWith({
        settingId: 1,
        label: 'Green',
        value: 'green',
        sortOrder: 5,
      });
      expect(result.sortOrder).toBe(5);
    });

    it('should throw NotFoundException if setting key is invalid', async () => {
      settingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addOption('nonexistent', { label: 'X', value: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('editOption', () => {
    it('should update label and value', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      const existingOption = mockOption({ id: 1, label: 'Red', value: 'red' });
      optionsRepo.findOne.mockResolvedValue(existingOption);
      optionsRepo.save.mockResolvedValue(
        mockOption({ id: 1, label: 'Crimson Red', value: 'crimson_red' }),
      );

      const result = await service.editOption('car_color', 1, {
        label: 'Crimson Red',
        value: 'crimson_red',
      });

      expect(result.label).toBe('Crimson Red');
      expect(result.value).toBe('crimson_red');
    });

    it('should update sort_order when provided', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      const existingOption = mockOption({ id: 1 });
      optionsRepo.findOne.mockResolvedValue(existingOption);
      optionsRepo.save.mockResolvedValue(mockOption({ id: 1, sortOrder: 5 }));

      const result = await service.editOption('car_color', 1, {
        sortOrder: 5,
      });

      expect(result.sortOrder).toBe(5);
    });

    it('should throw NotFoundException if option does not exist', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      optionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.editOption('car_color', 999, { label: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deprecateOption', () => {
    it('should set isActive to false', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      const existingOption = mockOption({ id: 1, isActive: true });
      optionsRepo.findOne.mockResolvedValue(existingOption);
      optionsRepo.save.mockResolvedValue(mockOption({ id: 1, isActive: false }));

      const result = await service.deprecateOption('car_color', 1);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if option does not exist', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      optionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deprecateOption('car_color', 999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreOption', () => {
    it('should set isActive to true', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      const existingOption = mockOption({ id: 1, isActive: false });
      optionsRepo.findOne.mockResolvedValue(existingOption);
      optionsRepo.save.mockResolvedValue(mockOption({ id: 1, isActive: true }));

      const result = await service.restoreOption('car_color', 1);

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if option does not exist', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      optionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.restoreOption('car_color', 999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderOptions', () => {
    it('should update sort_order for multiple options in a transaction', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 1, sortOrder: 0 })
        .mockResolvedValueOnce({ id: 2, sortOrder: 1 });
      mockQueryRunner.manager.save.mockResolvedValue(undefined);

      const dto = {
        orders: [
          { id: 1, sortOrder: 2 },
          { id: 2, sortOrder: 1 },
        ],
      };

      await service.reorderOptions('car_color', dto);

      expect(dataSource.createQueryRunner).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if an option is not found', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSetting);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 1, sortOrder: 0 })
        .mockResolvedValueOnce(null);

      const dto = {
        orders: [
          { id: 1, sortOrder: 0 },
          { id: 999, sortOrder: 1 },
        ],
      };

      await expect(
        service.reorderOptions('car_color', dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
