import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { User, UserRole } from '../database/entities/user.entity.js';
import { Department } from '../database/entities/department.entity.js';
import { Setting } from '../database/entities/setting.entity.js';
import { SettingOption } from '../database/entities/setting-option.entity.js';

config();

async function seed() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'byd_otd_desk',
    entities: [
      User,
      Department,
      Setting,
      SettingOption,
    ],
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected. Seeding data...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    // Seed Departments
    const departmentRepo = dataSource.getRepository(Department);
    const departments = [
      { name: 'Storage', slug: 'storage', pipelineOrder: 1 },
      { name: 'Accessories', slug: 'accessories', pipelineOrder: 2 },
      { name: 'PDI', slug: 'pdi', pipelineOrder: 3 },
      { name: 'Finance', slug: 'finance', pipelineOrder: 4 },
      { name: 'Delivery', slug: 'delivery', pipelineOrder: 5 },
    ];

    for (const dept of departments) {
      const existing = await departmentRepo.findOneBy({ slug: dept.slug });
      if (!existing) {
        await departmentRepo.save(departmentRepo.create(dept));
        console.log(`  Department created: ${dept.name}`);
      } else {
        console.log(`  Department already exists: ${dept.name}`);
      }
    }

    // Seed Settings
    const settingRepo = dataSource.getRepository(Setting);
    const optionRepo = dataSource.getRepository(SettingOption);

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
      let setting = await settingRepo.findOneBy({ key: settingData.key });
      if (!setting) {
        setting = settingRepo.create({ key: settingData.key, label: settingData.label });
        setting = await settingRepo.save(setting);
        console.log(`  Setting created: ${settingData.label}`);
      } else {
        console.log(`  Setting already exists: ${settingData.label}`);
      }

      for (const opt of settingData.options) {
        const existingOption = await optionRepo.findOneBy({
          settingId: setting.id,
          value: opt.value,
        });
        if (!existingOption) {
          await optionRepo.save(
            optionRepo.create({
              settingId: setting.id,
              label: opt.label,
              value: opt.value,
              sortOrder: opt.sortOrder,
            }),
          );
          console.log(`    Option created: ${opt.label}`);
        }
      }
    }

    // Seed Super Admin
    const userRepo = dataSource.getRepository(User);
    const existingAdmin = await userRepo.findOneBy({ username: 'superadmin' });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('Admin@123', salt);
      await userRepo.save(
        userRepo.create({
          username: 'superadmin',
          password: hashedPassword,
          fullName: 'Super Admin',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        }),
      );
      console.log('  Super Admin user created');
    } else {
      console.log('  Super Admin user already exists');
    }

    await queryRunner.commitTransaction();
    console.log('Seeding completed successfully.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
