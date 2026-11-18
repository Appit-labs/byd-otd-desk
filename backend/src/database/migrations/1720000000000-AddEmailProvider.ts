import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailProvider1720000000000 implements MigrationInterface {
  name = 'AddEmailProvider1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasProvider = await queryRunner.hasColumn('email_config', 'provider');
    if (!hasProvider) {
      await queryRunner.addColumn('email_config', new TableColumn({
        name: 'provider',
        type: 'varchar',
        length: '20',
        default: "'resend'",
      }));
    }

    const hasApiKey = await queryRunner.hasColumn('email_config', 'api_key');
    if (!hasApiKey) {
      await queryRunner.addColumn('email_config', new TableColumn({
        name: 'api_key',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('email_config', 'api_key');
    await queryRunner.dropColumn('email_config', 'provider');
  }
}
