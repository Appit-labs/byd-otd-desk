import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRolesEnum1718300000000 implements MigrationInterface {
  name = 'UpdateRolesEnum1718300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate existing department_user records to nvs (Storage team) before altering enum
    await queryRunner.query(`
      UPDATE users SET role = 'nvs' WHERE role = 'department_user'
    `);

    // Alter the role ENUM to include all 10 roles
    await queryRunner.query(`
      ALTER TABLE users MODIFY COLUMN role ENUM(
        'super_admin',
        'admin',
        'nvs',
        'qc_nvs',
        'mechanical_check',
        'pdi',
        'accessories',
        'registration',
        'delivery',
        'viewer'
      ) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert nvs back to department_user before altering enum
    await queryRunner.query(`
      UPDATE users SET role = 'department_user' WHERE role IN (
        'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE users MODIFY COLUMN role ENUM(
        'super_admin',
        'admin',
        'department_user',
        'viewer'
      ) NOT NULL
    `);
  }
}
