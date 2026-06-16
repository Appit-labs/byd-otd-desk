import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPipelineFields1718500000000 implements MigrationInterface {
  name = 'AddPipelineFields1718500000000';

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

    // ── 1. Add pipeline timestamp columns ──
    const timestamps = [
      'storage_at DATETIME NULL',
      'vehicle_received_at DATETIME NULL',
      'mechanical_check_started_at DATETIME NULL',
      'mechanical_check_completed_at DATETIME NULL',
      'pdi_started_at DATETIME NULL',
      'pdi_completed_at DATETIME NULL',
      'sent_to_accessories_at DATETIME NULL',
      'accessories_started_at DATETIME NULL',
      'accessories_completed_at DATETIME NULL',
      'final_inspection_at DATETIME NULL',
      'gps_confirmed_at DATETIME NULL',
      'registered_at DATETIME NULL',
      'delivered_at DATETIME NULL',
    ];
    for (const col of timestamps) {
      await addColIfMissing('car_requests', col);
    }

    // ── 2. Add duration columns (in seconds) ──
    await addColIfMissing('car_requests', 'mechanical_check_duration INT NULL');
    await addColIfMissing('car_requests', 'pdi_duration INT NULL');
    await addColIfMissing('car_requests', 'accessories_duration INT NULL');

    // ── 3. Add final inspection outcome & remarks ──
    await addColIfMissing('car_requests', 'final_inspection_outcome VARCHAR(100) NULL');
    await addColIfMissing('car_requests', 'final_inspection_remarks TEXT NULL');

    // ── 4. Add delivery remarks ──
    await addColIfMissing('car_requests', 'delivery_remarks TEXT NULL');

    // ── 5. Add showroom_id (FK to setting_options) ──
    const [showroomRow] = await queryRunner.query(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_requests' AND COLUMN_NAME = 'showroom_id'
    `);
    if (showroomRow?.cnt === 0) {
      await queryRunner.query(`ALTER TABLE car_requests ADD COLUMN showroom_id INT NULL`);
      await queryRunner.query(
        `ALTER TABLE car_requests ADD FOREIGN KEY (showroom_id) REFERENCES setting_options(id)`,
      );
    }

    // ── 6. Change status enum from (not_started/pending/on_hold/completed)
    //       to (active/cancelled/archived_manual/archived_qc) ──
    // Idempotent: check current column type first
    const [statusType] = await queryRunner.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_requests' AND COLUMN_NAME = 'status'
    `);
    const currentType = (statusType?.COLUMN_TYPE || '') as string;
    if (!currentType.includes('active')) {
      // First, expand the enum to accept both old and new values
      await queryRunner.query(`
        ALTER TABLE car_requests
        MODIFY COLUMN status ENUM('not_started','pending','on_hold','completed','active','cancelled','archived_manual','archived_qc')
        NOT NULL DEFAULT 'not_started'
      `);
      // Now update old values to new values
      await queryRunner.query(`
        UPDATE car_requests
        SET status = CASE
          WHEN status = 'not_started' THEN 'active'
          WHEN status = 'pending' THEN 'active'
          WHEN status = 'on_hold' THEN 'active'
          WHEN status = 'completed' THEN 'active'
          ELSE 'active'
        END
      `);
      // Finally, shrink enum to only new values
      await queryRunner.query(`
        ALTER TABLE car_requests
        MODIFY COLUMN status ENUM('active','cancelled','archived_manual','archived_qc')
        NOT NULL DEFAULT 'active'
      `);
    }
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

    // ── 1. Revert status enum ──
    await queryRunner.query(`
      UPDATE car_requests
      SET status = CASE
        WHEN status = 'active' THEN 'not_started'
        WHEN status = 'cancelled' THEN 'cancelled'
        ELSE 'not_started'
      END
    `);
    await queryRunner.query(`
      ALTER TABLE car_requests
      MODIFY COLUMN status ENUM('not_started','pending','on_hold','completed')
      NOT NULL DEFAULT 'not_started'
    `);

    // ── 2. Drop showroom FK + column ──
    await dropFK('car_requests', 'showroom_id');
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN showroom_id`);

    // ── 3. Drop delivery remarks ──
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN delivery_remarks`);

    // ── 4. Drop final inspection columns ──
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN final_inspection_remarks`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN final_inspection_outcome`);

    // ── 5. Drop duration columns ──
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN accessories_duration`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN pdi_duration`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN mechanical_check_duration`);

    // ── 6. Drop pipeline timestamp columns ──
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN delivered_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN registered_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN gps_confirmed_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN final_inspection_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN accessories_completed_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN accessories_started_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN sent_to_accessories_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN pdi_completed_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN pdi_started_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN mechanical_check_completed_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN mechanical_check_started_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN vehicle_received_at`);
    await queryRunner.query(`ALTER TABLE car_requests DROP COLUMN storage_at`);
  }
}
