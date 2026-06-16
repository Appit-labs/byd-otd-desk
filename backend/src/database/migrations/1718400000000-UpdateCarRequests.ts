import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCarRequests1718400000000 implements MigrationInterface {
  name = 'UpdateCarRequests1718400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Helper: drop a foreign key by column name ──
    const dropFK = async (table: string, column: string): Promise<void> => {
      const [row] = await queryRunner.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
          AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      if (row?.CONSTRAINT_NAME) {
        await queryRunner.query(
          `ALTER TABLE ${table} DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
        );
      }
    };

    // ── Helper: add column if not already present ──
    const addColIfMissing = async (table: string, colDef: string): Promise<void> => {
      const colName = colDef.split(' ')[0];
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${colName}'
      `);
      if (row?.cnt === 0) {
        await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      }
    };

    // ── 1. Add parent_id to setting_options (for hierarchical options: models→brand, variants→model) ──
    const [parentIdRow] = await queryRunner.query(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setting_options' AND COLUMN_NAME = 'parent_id'
    `);
    if (parentIdRow?.cnt === 0) {
      await queryRunner.query(`
        ALTER TABLE setting_options
        ADD COLUMN parent_id INT NULL,
        ADD FOREIGN KEY (parent_id) REFERENCES setting_options(id)
      `);
    }

    // ── 2. Drop old foreign keys on car_requests ──
    await dropFK('car_requests', 'car_color_id');
    await dropFK('car_requests', 'car_spec_id');
    await dropFK('car_requests', 'payment_method_id');
    await dropFK('car_requests', 'seller_id');

    // ── 3. Rename existing columns (idempotent — only if old name still exists) ──
    const renameColIfExists = async (table: string, oldName: string, newName: string, colType: string): Promise<void> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${oldName}'
      `);
      if (row?.cnt > 0) {
        await queryRunner.query(
          `ALTER TABLE ${table} CHANGE COLUMN \`${oldName}\` \`${newName}\` ${colType}`,
        );
      }
    };
    await renameColIfExists('car_requests', 'car_number', 'chassis_number', 'VARCHAR(100) NOT NULL');
    await renameColIfExists('car_requests', 'client_name', 'customer_name', 'VARCHAR(200) NOT NULL');
    await renameColIfExists('car_requests', 'client_tel', 'customer_phone', 'VARCHAR(50) NOT NULL');
    await renameColIfExists('car_requests', 'seller_id', 'sales_consultant_id', 'INT NOT NULL');

    // ── 4. Drop old columns that are no longer needed (if they exist) ──
    const dropColIfExists = async (table: string, colName: string): Promise<void> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${colName}'
      `);
      if (row?.cnt > 0) {
        await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN \`${colName}\``);
      }
    };
    await dropColIfExists('car_requests', 'body_number');
    await dropColIfExists('car_requests', 'car_color_id');
    await dropColIfExists('car_requests', 'car_spec_id');
    await dropColIfExists('car_requests', 'payment_method_id');

    // ── 5. Add new columns (if not already present) ──
    await addColIfMissing('car_requests', 'brand_id INT NULL');
    await addColIfMissing('car_requests', 'model_id INT NULL');
    await addColIfMissing('car_requests', 'variant_id INT NULL');
    await addColIfMissing('car_requests', 'cut_id INT NULL');
    await addColIfMissing('car_requests', 'vehicle_location VARCHAR(200) NULL');
    await addColIfMissing('car_requests', 'sales_type_id INT NULL');
    await addColIfMissing('car_requests', 'accessories JSON NULL');
    await addColIfMissing('car_requests', 'has_gps BOOLEAN DEFAULT FALSE');
    await addColIfMissing('car_requests', 'promise_date DATETIME NULL');

    // ── 6. Add new foreign keys (if not already present) ──
    const addFKIfMissing = async (table: string, column: string, refTable: string, refColumn: string): Promise<void> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME = '${refTable}'
      `);
      if (row?.cnt === 0) {
        await queryRunner.query(
          `ALTER TABLE ${table} ADD FOREIGN KEY (\`${column}\`) REFERENCES ${refTable}(\`${refColumn}\`)`,
        );
      }
    };
    await addFKIfMissing('car_requests', 'brand_id', 'setting_options', 'id');
    await addFKIfMissing('car_requests', 'model_id', 'setting_options', 'id');
    await addFKIfMissing('car_requests', 'variant_id', 'setting_options', 'id');
    await addFKIfMissing('car_requests', 'cut_id', 'setting_options', 'id');
    await addFKIfMissing('car_requests', 'sales_consultant_id', 'setting_options', 'id');
    await addFKIfMissing('car_requests', 'sales_type_id', 'setting_options', 'id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Helper ──
    const dropFK = async (table: string, column: string): Promise<void> => {
      const [row] = await queryRunner.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
          AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      if (row?.CONSTRAINT_NAME) {
        await queryRunner.query(
          `ALTER TABLE ${table} DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
        );
      }
    };

    // ── 1. Drop new foreign keys ──
    await dropFK('car_requests', 'brand_id');
    await dropFK('car_requests', 'model_id');
    await dropFK('car_requests', 'variant_id');
    await dropFK('car_requests', 'cut_id');
    await dropFK('car_requests', 'sales_consultant_id');
    await dropFK('car_requests', 'sales_type_id');

    // ── 2. Drop new columns ──
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN promise_date`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN has_gps`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN accessories`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN sales_type_id`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN vehicle_location`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN cut_id`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN variant_id`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN model_id`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN brand_id`);

    // ── 3. Restore old columns ──
    await queryRunner.query(
      `ALTER TABLE car_requests ADD COLUMN payment_method_id INT NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD COLUMN car_spec_id INT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD COLUMN car_color_id INT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD COLUMN body_number VARCHAR(100) NULL`,
    );

    // ── 4. Rename columns back ──
    await queryRunner.query(
      `ALTER TABLE car_requests CHANGE COLUMN sales_consultant_id seller_id INT NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests CHANGE COLUMN customer_phone client_tel VARCHAR(50) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests CHANGE COLUMN customer_name client_name VARCHAR(200) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests CHANGE COLUMN chassis_number car_number VARCHAR(100) NOT NULL`,
    );

    // ── 5. Restore old foreign keys ──
    await queryRunner.query(
      `ALTER TABLE car_requests ADD FOREIGN KEY (car_color_id) REFERENCES setting_options(id)`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD FOREIGN KEY (car_spec_id) REFERENCES setting_options(id)`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD FOREIGN KEY (payment_method_id) REFERENCES setting_options(id)`,
    );
    await queryRunner.query(
      `ALTER TABLE car_requests ADD FOREIGN KEY (seller_id) REFERENCES setting_options(id)`,
    );

    // ── 6. Drop parent_id from setting_options ──
    await dropFK('setting_options', 'parent_id');
    await queryRunner.query(`ALTER TABLE setting_options DROP COLUMN parent_id`);
  }
}
