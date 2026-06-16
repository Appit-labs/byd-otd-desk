import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHasAccessories1719000000000 implements MigrationInterface {
  name = 'AddHasAccessories1719000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    if (!(await hasColumn('car_requests', 'has_accessories'))) {
      await queryRunner.query(`
        ALTER TABLE car_requests ADD COLUMN has_accessories TINYINT(1) NOT NULL DEFAULT 0
      `);
    }

    // Update has_gps default to 0 (was previously default 1)
    await queryRunner.query(`
      ALTER TABLE car_requests MODIFY COLUMN has_gps TINYINT(1) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
      `);
      return row?.cnt > 0;
    };

    if (await hasColumn('car_requests', 'has_accessories')) {
      await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN has_accessories`);
    }

    // Restore has_gps default to 1
    await queryRunner.query(`
      ALTER TABLE car_requests MODIFY COLUMN has_gps TINYINT(1) NOT NULL DEFAULT 1
    `);
  }
}
