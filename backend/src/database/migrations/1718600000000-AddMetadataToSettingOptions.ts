import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMetadataToSettingOptions1718600000000 implements MigrationInterface {
  name = 'AddMetadataToSettingOptions1718600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add metadata JSON column to setting_options if not present
    const [row] = await queryRunner.query(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setting_options' AND COLUMN_NAME = 'metadata'
    `);
    if (row?.cnt === 0) {
      await queryRunner.query(
        `ALTER TABLE setting_options ADD COLUMN metadata JSON NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE setting_options DROP COLUMN metadata`,
    );
  }
}
