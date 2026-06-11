import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1718200000000 implements MigrationInterface {
  name = 'InitialSchema1718200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create departments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        pipeline_order INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        role ENUM('super_admin','admin','department_user','viewer') NOT NULL,
        department_id INT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        key VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(200) NOT NULL,
        description TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create setting_options table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS setting_options (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_id INT NOT NULL,
        label VARCHAR(200) NOT NULL,
        value VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (setting_id) REFERENCES settings(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create car_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS car_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_number VARCHAR(50) UNIQUE NOT NULL,
        request_type_id INT NOT NULL,
        car_number VARCHAR(100) NOT NULL,
        body_number VARCHAR(100) NULL,
        car_color_id INT NULL,
        car_spec_id INT NULL,
        client_name VARCHAR(200) NOT NULL,
        client_tel VARCHAR(50) NOT NULL,
        payment_method_id INT NOT NULL,
        seller_id INT NOT NULL,
        remarks TEXT NULL,
        status ENUM('not_started','pending','on_hold','completed') DEFAULT 'not_started',
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        FOREIGN KEY (request_type_id) REFERENCES setting_options(id),
        FOREIGN KEY (car_color_id) REFERENCES setting_options(id),
        FOREIGN KEY (car_spec_id) REFERENCES setting_options(id),
        FOREIGN KEY (payment_method_id) REFERENCES setting_options(id),
        FOREIGN KEY (seller_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create request_stage_transitions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS request_stage_transitions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_id INT NOT NULL,
        department_id INT NOT NULL,
        action ENUM('started','completed') NOT NULL,
        actioned_by INT NOT NULL,
        actioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_request_dept_action (request_id, department_id, action),
        FOREIGN KEY (request_id) REFERENCES car_requests(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (actioned_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS request_stage_transitions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS car_requests;`);
    await queryRunner.query(`DROP TABLE IF EXISTS setting_options;`);
    await queryRunner.query(`DROP TABLE IF EXISTS settings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments;`);
  }
}
