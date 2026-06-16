import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailTables1718800000000 implements MigrationInterface {
  name = 'AddEmailTables1718800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = async (table: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'
      `);
      return row?.cnt > 0;
    };

    // ── 1. Create email_config table ──
    if (!(await hasTable('email_config'))) {
      await queryRunner.query(`
        CREATE TABLE email_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          smtp_host VARCHAR(255) NULL,
          smtp_port INT NOT NULL DEFAULT 587,
          smtp_username VARCHAR(255) NULL,
          smtp_password VARCHAR(255) NULL,
          from_address VARCHAR(255) NULL,
          from_name VARCHAR(255) NULL,
          enabled TINYINT(1) NOT NULL DEFAULT 0,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert a default disabled row
      await queryRunner.query(`
        INSERT INTO email_config (smtp_host, smtp_port, smtp_username, smtp_password, from_address, from_name, enabled)
        VALUES ('', 587, '', '', '', 'OTD BYD Tracker', 0)
      `);
    }

    // ── 2. Create notification_log table ──
    if (!(await hasTable('notification_log'))) {
      await queryRunner.query(`
        CREATE TABLE notification_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NULL,
          event VARCHAR(100) NOT NULL,
          recipients TEXT NOT NULL,
          subject VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'sent',
          error TEXT NULL,
          sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES car_requests(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = async (table: string): Promise<boolean> => {
      const [row] = await queryRunner.query(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'
      `);
      return row?.cnt > 0;
    };

    if (await hasTable('notification_log')) {
      await queryRunner.query(`DROP TABLE notification_log`);
    }

    if (await hasTable('email_config')) {
      await queryRunner.query(`DROP TABLE email_config`);
    }
  }
}
