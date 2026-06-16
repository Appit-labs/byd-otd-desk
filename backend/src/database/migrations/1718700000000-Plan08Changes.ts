import { MigrationInterface, QueryRunner } from 'typeorm';

export class Plan08Changes1718700000000 implements MigrationInterface {
  name = 'Plan08Changes1718700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Helpers ──
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

    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    const hasFK = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
          AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      return row?.cnt > 0;
    };

    // ── 1. Remove cut_id from car_requests (Issue 10) ──
    if (await hasColumn('car_requests', 'cut_id')) {
      await dropFK('car_requests', 'cut_id');
      await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN cut_id`);
    }

    // ── 2. Add exterior_color_id (Issue 8) ──
    if (!(await hasColumn('car_requests', 'exterior_color_id'))) {
      await queryRunner.query(`ALTER TABLE car_requests ADD COLUMN exterior_color_id INT NULL`);
    }
    if (!(await hasFK('car_requests', 'exterior_color_id'))) {
      await queryRunner.query(
        `ALTER TABLE car_requests ADD FOREIGN KEY (exterior_color_id) REFERENCES setting_options(id)`,
      );
    }

    // ── 3. Add interior_color_id (Issue 8) ──
    if (!(await hasColumn('car_requests', 'interior_color_id'))) {
      await queryRunner.query(`ALTER TABLE car_requests ADD COLUMN interior_color_id INT NULL`);
    }
    if (!(await hasFK('car_requests', 'interior_color_id'))) {
      await queryRunner.query(
        `ALTER TABLE car_requests ADD FOREIGN KEY (interior_color_id) REFERENCES setting_options(id)`,
      );
    }

    // ── 4. Add email column to users (Issue 11) ──
    if (!(await hasColumn('users', 'email'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL`);
      // Fill existing users with placeholder email
      await queryRunner.query(
        `UPDATE users SET email = CONCAT(username, '@placeholder.local') WHERE email IS NULL`,
      );
      // Add unique index
      await queryRunner.query(`ALTER TABLE users ADD UNIQUE INDEX IDX_users_email (email)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    // Remove email from users
    if (await hasColumn('users', 'email')) {
      await queryRunner.query(`ALTER TABLE users DROP INDEX IDX_users_email`);
      await queryRunner.query(`ALTER TABLE users DROP COLUMN email`);
    }

    // Remove interior_color_id
    await dropFK('car_requests', 'interior_color_id');
    if (await hasColumn('car_requests', 'interior_color_id')) {
      await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN interior_color_id`);
    }

    // Remove exterior_color_id
    await dropFK('car_requests', 'exterior_color_id');
    if (await hasColumn('car_requests', 'exterior_color_id')) {
      await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN exterior_color_id`);
    }

    // Re-add cut_id
    if (!(await hasColumn('car_requests', 'cut_id'))) {
      await queryRunner.query(`ALTER TABLE car_requests ADD COLUMN cut_id INT NULL`);
      await queryRunner.query(
        `ALTER TABLE car_requests ADD FOREIGN KEY (cut_id) REFERENCES setting_options(id)`,
      );
    }
  }
}
