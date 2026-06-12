import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../database/entities/user.entity';
import { Department } from '../database/entities/department.entity';
import { Setting } from '../database/entities/setting.entity';
import { SettingOption } from '../database/entities/setting-option.entity';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Department)
    private deptRepo: Repository<Department>,
    @InjectRepository(Setting)
    private settingRepo: Repository<Setting>,
    @InjectRepository(SettingOption)
    private optionRepo: Repository<SettingOption>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    this.logger.log('Checking seed data...');

    await this.seedDepartments();
    await this.seedSettings();
    await this.seedSuperAdmin();

    this.logger.log('Seed check complete.');
  }

  private async seedDepartments() {
    const departments = [
      { name: 'Storage', slug: 'storage', pipelineOrder: 1 },
      { name: 'Accessories', slug: 'accessories', pipelineOrder: 2 },
      { name: 'PDI', slug: 'pdi', pipelineOrder: 3 },
      { name: 'Finance', slug: 'finance', pipelineOrder: 4 },
      { name: 'Delivery', slug: 'delivery', pipelineOrder: 5 },
    ];

    for (const dept of departments) {
      const existing = await this.deptRepo.findOneBy({ slug: dept.slug });
      if (!existing) {
        await this.deptRepo.save(this.deptRepo.create(dept));
        this.logger.log(`Department created: ${dept.name}`);
      }
    }
  }

  private async seedSettings() {
    const settingsData = [
      {
        key: 'request_type',
        label: 'Request Type',
        options: [
          { label: 'New Sale', value: 'new_sale', sortOrder: 1 },
          { label: 'Transfer', value: 'transfer', sortOrder: 2 },
          { label: 'Exchange', value: 'exchange', sortOrder: 3 },
        ],
      },
      {
        key: 'car_color',
        label: 'Car Color',
        options: [
          { label: 'Polar White', value: 'polar_white', sortOrder: 1 },
          { label: 'Jet Black', value: 'jet_black', sortOrder: 2 },
          { label: 'Silver Metallic', value: 'silver_metallic', sortOrder: 3 },
          { label: 'Deep Blue', value: 'deep_blue', sortOrder: 4 },
          { label: 'Crimson Red', value: 'crimson_red', sortOrder: 5 },
        ],
      },
      {
        key: 'car_spec',
        label: 'Car Specification',
        options: [
          { label: 'Standard', value: 'standard', sortOrder: 1 },
          { label: 'Luxury', value: 'luxury', sortOrder: 2 },
          { label: 'Premium', value: 'premium', sortOrder: 3 },
          { label: 'Performance', value: 'performance', sortOrder: 4 },
        ],
      },
      {
        key: 'payment_method',
        label: 'Payment Method',
        options: [
          { label: 'Cash', value: 'cash', sortOrder: 1 },
          { label: 'Finance', value: 'finance', sortOrder: 2 },
          { label: 'Lease', value: 'lease', sortOrder: 3 },
          { label: 'Corporate', value: 'corporate', sortOrder: 4 },
        ],
      },
    ];

    for (const settingData of settingsData) {
      let setting = await this.settingRepo.findOneBy({ key: settingData.key });
      if (!setting) {
        setting = this.settingRepo.create({
          key: settingData.key,
          label: settingData.label,
        });
        setting = await this.settingRepo.save(setting);
        this.logger.log(`Setting created: ${settingData.label}`);
      }

      for (const opt of settingData.options) {
        const existing = await this.optionRepo.findOneBy({
          settingId: setting.id,
          value: opt.value,
        });
        if (!existing) {
          await this.optionRepo.save(
            this.optionRepo.create({
              settingId: setting.id,
              label: opt.label,
              value: opt.value,
              sortOrder: opt.sortOrder,
            }),
          );
          this.logger.log(`Option created: ${opt.label} (${settingData.key})`);
        }
      }
    }
  }

  private async seedSuperAdmin() {
    const existing = await this.usersRepo.findOneBy({ username: 'superadmin' });
    if (!existing) {
      const adminPassword =
        process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(adminPassword, salt);
      await this.usersRepo.save(
        this.usersRepo.create({
          username: 'superadmin',
          password: hashed,
          fullName: 'Super Admin',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        }),
      );
      this.logger.log('Super Admin user created');
    }
  }
}
