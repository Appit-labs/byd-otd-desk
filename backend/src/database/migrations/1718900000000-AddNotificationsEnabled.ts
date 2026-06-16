import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsEnabled1718900000000 implements MigrationInterface {
  name = 'AddNotificationsEnabled1718900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    if (!(await hasColumn('users', 'notifications_enabled'))) {
      await queryRunner.query(`
        ALTER TABLE users ADD COLUMN notifications_enabled TINYINT(1) NOT NULL DEFAULT 0
      `);

      // Enable notifications for super_admin, admin, pdi, accessories roles
      await queryRunner.query(`
        UPDATE users SET notifications_enabled = 1
        WHERE role IN ('super_admin', 'admin', 'pdi', 'accessories')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    if (await hasColumn('users', 'notifications_enabled')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN notifications_enabled`);
    }
  }
}
