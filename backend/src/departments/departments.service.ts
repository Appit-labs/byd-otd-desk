import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../database/entities/department.entity.js';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  async findAll(): Promise<Department[]> {
    return this.departmentsRepository.find({
      order: { pipelineOrder: 'ASC' },
    });
  }

  async findById(id: number): Promise<Department | null> {
    return this.departmentsRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Department | null> {
    return this.departmentsRepository.findOne({ where: { slug } });
  }
}
