import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarRequest } from '../database/entities/car-request.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(CarRequest)
    private requestsRepository: Repository<CarRequest>,
  ) {}

  async findAll(): Promise<CarRequest[]> {
    return this.requestsRepository.find({
      relations: ['requestType', 'carColor', 'carSpec', 'paymentMethod', 'seller', 'creator'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<CarRequest | null> {
    return this.requestsRepository.findOne({
      where: { id },
      relations: ['requestType', 'carColor', 'carSpec', 'paymentMethod', 'seller', 'creator'],
    });
  }

  async findByRequestNumber(requestNumber: string): Promise<CarRequest | null> {
    return this.requestsRepository.findOne({ where: { requestNumber } });
  }

  async create(createRequestDto: CreateRequestDto, userId: number): Promise<CarRequest> {
    const request = this.requestsRepository.create({
      ...createRequestDto,
      createdBy: userId,
    });
    return this.requestsRepository.save(request);
  }

  async update(id: number, updateRequestDto: UpdateRequestDto): Promise<CarRequest> {
    const request = await this.findById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    Object.assign(request, updateRequestDto);
    return this.requestsRepository.save(request);
  }
}
