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
    // ── Seed Departments ──
    const departmentRepo = dataSource.getRepository(Department);
    const departments = [
      { name: 'Storage', slug: 'storage', pipelineOrder: 1 },
      { name: 'Accessories', slug: 'accessories', pipelineOrder: 2 },
      { name: 'PDI', slug: 'pdi', pipelineOrder: 3 },
      { name: 'Finance', slug: 'finance', pipelineOrder: 4 },
      { name: 'Delivery', slug: 'delivery', pipelineOrder: 5 },
      { name: 'QC', slug: 'qc', pipelineOrder: 6 },
      { name: 'Mechanical Check', slug: 'mechanical_check', pipelineOrder: 7 },
      { name: 'Registration', slug: 'registration', pipelineOrder: 8 },
      { name: 'Final Inspection', slug: 'final_inspection', pipelineOrder: 9 },
      { name: 'GPS', slug: 'gps', pipelineOrder: 10 },
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

    // ── Seed Settings & Options ──
    const settingRepo = dataSource.getRepository(Setting);
    const optionRepo = dataSource.getRepository(SettingOption);

    const ensureSetting = async (key: string, label: string, description?: string): Promise<Setting> => {
      let setting = await settingRepo.findOneBy({ key });
      if (!setting) {
        setting = settingRepo.create({ key, label, description });
        setting = await settingRepo.save(setting);
        console.log(`  Setting created: ${label}`);
      } else {
        console.log(`  Setting already exists: ${label}`);
      }
      return setting;
    };

    const ensureOption = async (
      settingId: number,
      value: string,
      label: string,
      sortOrder: number,
      parentId?: number,
      metadata?: Record<string, any>,
    ): Promise<SettingOption> => {
      const existing = await optionRepo.findOneBy({ settingId, value });
      if (!existing) {
        const saved = await optionRepo.save({
          settingId,
          label,
          value,
          sortOrder,
          parentId: parentId ?? undefined,
          metadata: metadata ?? null,
        } as SettingOption);
        console.log(`    Option created: ${label}`);
        return saved;
      }
      console.log(`    Option already exists: ${label}`);
      return existing;
    };

    const replaceAllOptions = async (
      settingId: number,
      newOptions: { value: string; label: string; sortOrder: number; metadata?: Record<string, any> }[],
    ): Promise<void> => {
      const existing = await optionRepo.find({ where: { settingId } });
      const newValues = new Set(newOptions.map((o) => o.value));
      for (const opt of existing) {
        if (!newValues.has(opt.value) && opt.isActive) {
          opt.isActive = false;
          await optionRepo.save(opt);
          console.log(`    Deprecated old option: ${opt.label} (${opt.value})`);
        }
      }
      for (const opt of newOptions) {
        const found = existing.find((e) => e.value === opt.value);
        if (found) {
          if (!found.isActive) {
            found.isActive = true;
            found.label = opt.label;
            found.sortOrder = opt.sortOrder;
            await optionRepo.save(found);
            console.log(`    Re-activated option: ${opt.label}`);
          }
        } else {
          await optionRepo.save({
            settingId,
            label: opt.label,
            value: opt.value,
            sortOrder: opt.sortOrder,
            metadata: opt.metadata ?? null,
          } as SettingOption);
          console.log(`    Created new option: ${opt.label}`);
        }
      }
      console.log(`    Replaced options for setting ${settingId}: ${newOptions.length} active`);
    };

    // ── 1. Request Type ──
    const rtSetting = await ensureSetting(
      'request_type',
      'Request Type',
      'PDI (7 days + accessories), Re-PDI (2 days), No PDI (2 days)',
    );
    await ensureOption(rtSetting.id, 'pdi', 'PDI', 1, undefined, {
      working_days: 7,
      allows_accessories: true,
    });
    await ensureOption(rtSetting.id, 're_pdi', 'Re-PDI', 2, undefined, {
      working_days: 2,
      allows_accessories: false,
    });
    await ensureOption(rtSetting.id, 'no_pdi', 'No PDI', 3, undefined, {
      working_days: 2,
      allows_accessories: false,
    });

    // Deprecate any request_type options not in the allowed set
    const allowedRequestTypes = ['pdi', 're_pdi', 'no_pdi'];
    const allRtOptions = await optionRepo.find({ where: { settingId: rtSetting.id } });
    for (const opt of allRtOptions) {
      if (!allowedRequestTypes.includes(opt.value) && opt.isActive) {
        opt.isActive = false;
        await optionRepo.save(opt);
        console.log(`    Deprecated extra request type: ${opt.label} (${opt.value})`);
      }
      if (allowedRequestTypes.includes(opt.value) && !opt.isActive) {
        opt.isActive = true;
        await optionRepo.save(opt);
        console.log(`    Re-activated request type: ${opt.label} (${opt.value})`);
      }
    }

    // ── 2. Brand ──
    const brandSetting = await ensureSetting('brand', 'Brand');
    const brandByd = await ensureOption(brandSetting.id, 'byd', 'BYD', 1);
    await ensureOption(brandSetting.id, 'denza', 'Denza', 2);
    await ensureOption(brandSetting.id, 'yang_wang', 'Yang Wang', 3);

    // ── 3. Model (parent = brand) ──
    const modelSetting = await ensureSetting('model', 'Model');
    // All 14 models under BYD
    await ensureOption(modelSetting.id, 'atto3', 'ATTO3', 1, brandByd.id);
    await ensureOption(modelSetting.id, 'atto8', 'ATTO8', 2, brandByd.id);
    await ensureOption(modelSetting.id, 'b5', 'B5', 3, brandByd.id);
    await ensureOption(modelSetting.id, 'b8', 'B8', 4, brandByd.id);
    await ensureOption(modelSetting.id, 'han', 'HAN', 5, brandByd.id);
    await ensureOption(modelSetting.id, 'qinplus', 'QINPLUS', 6, brandByd.id);
    await ensureOption(modelSetting.id, 'seal', 'SEAL', 7, brandByd.id);
    await ensureOption(modelSetting.id, 'seal7', 'SEAL7', 8, brandByd.id);
    await ensureOption(modelSetting.id, 'sealion5', 'SEALION5', 9, brandByd.id);
    await ensureOption(modelSetting.id, 'sealion7', 'SEALION7', 10, brandByd.id);
    await ensureOption(modelSetting.id, 'shark', 'SHARK', 11, brandByd.id);
    await ensureOption(modelSetting.id, 'songplus', 'SONGPLUS', 12, brandByd.id);
    await ensureOption(modelSetting.id, 'ti7', 'Ti7', 13, brandByd.id);
    await ensureOption(modelSetting.id, 'u8', 'U8', 14, brandByd.id);

    // ── 4. Variant (flat list, no parent) ──
    const variantSetting = await ensureSetting('variant', 'Variant');
    await ensureOption(variantSetting.id, 'seal7-lux', 'SEAL7-LUX', 1);
    await ensureOption(variantSetting.id, 'seal7-flag', 'SEAL7-FLAG', 2);
    await ensureOption(variantSetting.id, 'b8-flag', 'B8-FLAG', 3);
    await ensureOption(variantSetting.id, 'atto8-lux', 'ATTO8-LUX', 4);
    await ensureOption(variantSetting.id, 'b5-delu', 'B5-DELU', 5);
    await ensureOption(variantSetting.id, 'qin70-lux', 'QIN70-LUX', 6);
    await ensureOption(variantSetting.id, 'qin120-flag', 'QIN120-FLAG', 7);
    await ensureOption(variantSetting.id, 'atto3-lux', 'ATTO3-LUX', 8);
    await ensureOption(variantSetting.id, 'atto3-flag', 'ATTO3-FLAG', 9);
    await ensureOption(variantSetting.id, 'han-flag', 'HAN-FLAG', 10);
    await ensureOption(variantSetting.id, 'b8-delu', 'B8-DELU', 11);
    await ensureOption(variantSetting.id, 'b5-flag', 'B5-FLAG', 12);
    await ensureOption(variantSetting.id, 'atto8-flag', 'ATTO8-FLAG', 13);
    await ensureOption(variantSetting.id, 'qin70-comf', 'QIN70-COMF', 14);
    await ensureOption(variantSetting.id, 'seal-flag', 'SEAL-FLAG', 15);
    await ensureOption(variantSetting.id, 'seali5-flag', 'SEALI5-FLAG', 16);
    await ensureOption(variantSetting.id, 'seali5-lux', 'SEALI5-LUX', 17);
    await ensureOption(variantSetting.id, 'seali-flag', 'SEALI-FLAG', 18);
    await ensureOption(variantSetting.id, 'seali-lux', 'SEALI-LUX', 19);
    await ensureOption(variantSetting.id, 'seal-lux', 'SEAL-LUX', 20);
    await ensureOption(variantSetting.id, 'seal-prem', 'SEAL-PREM', 21);
    await ensureOption(variantSetting.id, 'shark-prem', 'SHARK-PREM', 22);
    await ensureOption(variantSetting.id, 'songp-40', 'SONGP-40', 23);
    await ensureOption(variantSetting.id, 'songp-flag', 'SONGP-FLAG', 24);
    await ensureOption(variantSetting.id, 'songp-lux', 'SONGP-LUX', 25);
    await ensureOption(variantSetting.id, 'songp-prem', 'SONGP-PREM', 26);
    await ensureOption(variantSetting.id, 'ti7-lux', 'TI7-LUX', 27);
    await ensureOption(variantSetting.id, 'ti7-prem', 'TI7-PREM', 28);
    await ensureOption(variantSetting.id, 'u8-lux', 'U8-LUX', 29);

    // ── 5. Exterior Color ──
    const extColorSetting = await ensureSetting('exterior_color', 'Exterior Color');
    const exteriorColors = [
      'Peek Grey',
      'Light Yellow',
      'Jungle Green',
      'Urdo Cream Grey Green',
      'Vatnajokull Ice Blue',
      'Deep Black',
      'Snow White',
      'Wind Grass Green',
      'Obsidian Black & Snowy White',
      'Ink Bamboo Green',
      'Titanium Metallic Grey',
      'Shadow Black',
      'Star & Moon Silver',
      'Grey',
      'Sunrise Gold',
      'Emerald Green',
      'Time Grey',
      'Starry Grey',
      'White',
      'Lost Atlantis',
      'Golden Dawn',
      'Rosemary Grey',
      'Dolomiti Green',
      'North Ice Blue',
      'Smoke Grey',
      'Delan Black',
      'Moonlight Silver',
      'Atlantis Grey',
      'Black',
      'Atlantis Grey (Alt)',
      'Sky Purple',
      'Aurora White',
      'Sky Black',
      'Ski White',
      'Boulder Grey',
      'Surf Blue',
      'Sea Blue',
      'Deep Blue',
    ];
    for (let i = 0; i < exteriorColors.length; i++) {
      const slug = exteriorColors[i]
        .toLowerCase()
        .replace(/&/g, '')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      await ensureOption(extColorSetting.id, slug, exteriorColors[i], i + 1);
    }

    // ── 6. Interior Color ──
    const intColorSetting = await ensureSetting('interior_color', 'Interior Color');
    const interiorColors = [
      'Eclipse Blue',
      'Red and White',
      'Blue and Grey',
      'Grey and Brown',
      'Desert Beige',
      'Brown',
      'Wheat Yellow',
      'Shallow Green',
      'Beige and Brown',
      'Orange',
      'Black and Orange',
      'Dark Black',
      'Black and Blue',
      'Cyan',
      'Blue',
      'Black and Grey',
      'Black',
      'Black and Brown',
      'Grey and White',
    ];
    for (let i = 0; i < interiorColors.length; i++) {
      const slug = interiorColors[i]
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      await ensureOption(intColorSetting.id, slug, interiorColors[i], i + 1);
    }

    // ── 7. Accessory ──
    const accSetting = await ensureSetting('accessory', 'Accessory');
    const accessories = [
      'Window Tinting',
      'Seat Covers',
      'Floor Mats',
      'Dash Camera',
      'Parking Sensors',
      'Reverse Camera',
      'Remote Start',
      'Roof Rack',
      'Side Steps',
      'LED Lighting Kit',
      'Paint Protection Film',
      'Ceramic Coating',
      'Chrome Delete',
      'Body Kit',
      'Spoiler',
      'Tow Bar',
      'Cargo Liner',
      'Wireless Charger Upgrade',
      'Head-Up Display',
      'Navigation SD Card',
    ];
    for (let i = 0; i < accessories.length; i++) {
      const slug = accessories[i]
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      await ensureOption(accSetting.id, slug, accessories[i], i + 1);
    }

    // Reactivate any deprecated accessories
    const allAccOptions = await optionRepo.find({ where: { settingId: accSetting.id } });
    for (const opt of allAccOptions) {
      if (!opt.isActive) {
        opt.isActive = true;
        await optionRepo.save(opt);
        console.log(`    Re-activated accessory: ${opt.label}`);
      }
    }

    // ── 8. Sales Consultant ──
    const scSetting = await ensureSetting('sales_consultant', 'Sales Consultant');
    const salesConsultants = [
      'Abdulaziz Alhouti',
      'Abdallah Alawneh',
      'Mostafa Mohamed',
      'Mohamad Saad',
      'Ayad Taha',
      'Mohammed Abdulaziz',
      'Mark Zaki',
      'Ahmad Haidar',
      'Bashayer AlNejadah',
      'Hasan Abushouk',
      'Mounir Dargham',
      'Mohamad Tamer',
      'Mirvet El bayaa',
      'Fatemah Ali',
      'Richard Hanna',
      'Ahmed Hussein',
      'Yahya Elshenawy',
      'Issam Chamma',
      'Mohamed Elyamani',
      'Ali AlSayegh',
      'Khalil Hassan',
      'Ali Hussain',
      'Omar Tahat',
      'Deeb Aboulokme',
      'Martina Awad',
      'Eslam Syed Mohamed',
      'Fouad Kassis',
      'Amr Ahmed Nabil Rashed Abdelmagid',
      'Retaj Alsaraf',
      'Elias Zoghbi',
    ];
    for (let i = 0; i < salesConsultants.length; i++) {
      const slug = salesConsultants[i]
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      await ensureOption(scSetting.id, slug, salesConsultants[i], i + 1);
    }

    // ── 9. Sales Type ──
    const stSetting = await ensureSetting('sales_type', 'Sales Type');
    await ensureOption(stSetting.id, 'cash', 'Cash', 1);
    await ensureOption(stSetting.id, 'finance', 'Finance', 2);
    await ensureOption(stSetting.id, 'lease', 'Lease', 3);
    await ensureOption(stSetting.id, 'corporate', 'Corporate', 4);

    // ── 10. Vehicle Location ──
    const locSetting = await ensureSetting('vehicle_location', 'Vehicle Location');
    await replaceAllOptions(locSetting.id, [
      { value: 'kuwait_city', label: 'Kuwait City', sortOrder: 1 },
      { value: 'salmiya', label: 'Salmiya', sortOrder: 2 },
      { value: 'hawally', label: 'Hawally', sortOrder: 3 },
      { value: 'farwaniya', label: 'Farwaniya', sortOrder: 4 },
      { value: 'al_rai', label: 'Al-Rai', sortOrder: 5 },
      { value: 'shuwaikh_industrial', label: 'Shuwaikh Industrial', sortOrder: 6 },
      { value: 'shuwaikh_commercial', label: 'Shuwaikh Commercial', sortOrder: 7 },
      { value: 'jahra', label: 'Jahra', sortOrder: 8 },
      { value: 'fahaheel', label: 'Fahaheel', sortOrder: 9 },
      { value: 'ahmadi', label: 'Ahmadi', sortOrder: 10 },
      { value: 'sabah_al_salem', label: 'Sabah Al-Salem', sortOrder: 11 },
      { value: 'jabriya', label: 'Jabriya', sortOrder: 12 },
      { value: 'khaitan', label: 'Khaitan', sortOrder: 13 },
      { value: 'mishref', label: 'Mishref', sortOrder: 14 },
      { value: 'bayan', label: 'Bayan', sortOrder: 15 },
      { value: 'al_khiran', label: 'Al Khiran', sortOrder: 16 },
      { value: 'mahboula', label: 'Mahboula', sortOrder: 17 },
      { value: 'mangaf', label: 'Mangaf', sortOrder: 18 },
      { value: 'fintas', label: 'Fintas', sortOrder: 19 },
      { value: 'qortuba', label: 'Qortuba', sortOrder: 20 },
      { value: 'yarmouk', label: 'Yarmouk', sortOrder: 21 },
      { value: 'khaldiya', label: 'Khaldiya', sortOrder: 22 },
      { value: 'rawda', label: 'Rawda', sortOrder: 23 },
      { value: 'surra', label: 'Surra', sortOrder: 24 },
      { value: 'adailiya', label: 'Adailiya', sortOrder: 25 },
      { value: 'nuzha', label: 'Nuzha', sortOrder: 26 },
      { value: 'kaifan', label: 'Kaifan', sortOrder: 27 },
      { value: 'shamiya', label: 'Shamiya', sortOrder: 28 },
      { value: 'dasman', label: 'Dasman', sortOrder: 29 },
      { value: 'sharq', label: 'Sharq', sortOrder: 30 },
      { value: 'mirqab', label: 'Mirqab', sortOrder: 31 },
      { value: 'qibla', label: 'Qibla', sortOrder: 32 },
      { value: 'bneid_al_gar', label: 'Bneid Al-Gar', sortOrder: 33 },
      { value: 'shaab', label: 'Shaab', sortOrder: 34 },
      { value: 'salwa', label: 'Salwa', sortOrder: 35 },
      { value: 'rumaithiya', label: 'Rumaithiya', sortOrder: 36 },
      { value: 'jaber_al_ali', label: 'Jaber Al-Ali', sortOrder: 37 },
      { value: 'sabah_al_ahmad', label: 'Sabah Al-Ahmad', sortOrder: 38 },
      { value: 'saad_al_abdullah', label: 'Saad Al-Abdullah', sortOrder: 39 },
      { value: 'jaber_al_ahmad', label: 'Jaber Al-Ahmad', sortOrder: 40 },
    ]);

    // ── 11. Showroom ──
    const showroomSetting = await ensureSetting('showroom', 'Showroom');
    await replaceAllOptions(showroomSetting.id, [
      { value: 'al_rai_mall', label: 'Al Rai (Safat Alghanim Mall)', sortOrder: 1 },
      { value: 'shuwaikh_industrial', label: 'Shuwaikh Industrial', sortOrder: 2 },
      { value: 'fahaheel', label: 'Fahaheel', sortOrder: 3 },
      { value: 'khairan', label: 'Khairan', sortOrder: 4 },
      { value: 'shuwaikh_main', label: 'Shuwaikh Main Showroom (Airport Road)', sortOrder: 5 },
      { value: 'al_jahra', label: 'Al Jahra', sortOrder: 6 },
      { value: 'mall_360', label: '360 Mall', sortOrder: 7 },
    ]);

    // ── 12. Final Inspection ──
    const fiSetting = await ensureSetting('final_inspection', 'Final Inspection Option');
    await ensureOption(fiSetting.id, 'good_condition', 'Good condition', 1, undefined, { outcome_behavior: 'done' });
    await ensureOption(fiSetting.id, 'release_as_is', 'Release as is', 2, undefined, { outcome_behavior: 'done' });
    await ensureOption(fiSetting.id, 'sales_team_check', 'Sales team / manager to check', 3, undefined, { outcome_behavior: 'done' });
    await ensureOption(fiSetting.id, 'return_to_fin', 'Return to fin', 4, undefined, { outcome_behavior: 'archive' });
    await ensureOption(fiSetting.id, 'return_the_car', 'Return the car (take time)', 5, undefined, { outcome_behavior: 'archive' });

    // ── Seed Users ──
    const userRepo = dataSource.getRepository(User);
    const defaultPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

    const seedUsers = [
      { username: 'superadmin', fullName: 'Super Admin', role: UserRole.SUPER_ADMIN, email: 'superadmin@byd-otd.local' },
      { username: 'admin', fullName: 'Admin User', role: UserRole.ADMIN, email: 'admin@byd-otd.local' },
      { username: 'nvs', fullName: 'NVS Storage User', role: UserRole.NVS, email: 'nvs@byd-otd.local' },
      { username: 'qcnvs', fullName: 'QC NVS User', role: UserRole.QC_NVS, email: 'qcnvs@byd-otd.local' },
      { username: 'mechcheck', fullName: 'Mechanical Check User', role: UserRole.MECHANICAL_CHECK, email: 'mechcheck@byd-otd.local' },
      { username: 'pdi', fullName: 'PDI User', role: UserRole.PDI, email: 'pdi@byd-otd.local' },
      { username: 'accessories', fullName: 'Accessories User', role: UserRole.ACCESSORIES, email: 'accessories@byd-otd.local' },
      { username: 'registration', fullName: 'Registration User', role: UserRole.REGISTRATION, email: 'registration@byd-otd.local' },
      { username: 'delivery', fullName: 'Delivery User', role: UserRole.DELIVERY, email: 'delivery@byd-otd.local' },
      { username: 'viewer', fullName: 'Viewer User', role: UserRole.VIEWER, email: 'viewer@byd-otd.local' },
    ];

    for (const seedUser of seedUsers) {
      const existing = await userRepo.findOneBy({ username: seedUser.username });
      if (!existing) {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);
        await userRepo.save(
          userRepo.create({
            username: seedUser.username,
            password: hashedPassword,
            fullName: seedUser.fullName,
            email: seedUser.email,
            role: seedUser.role,
            isActive: true,
          }),
        );
        console.log(`  User created: ${seedUser.fullName} (${seedUser.username})`);
      } else {
        console.log(`  User already exists: ${seedUser.fullName} (${seedUser.username})`);
      }
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
