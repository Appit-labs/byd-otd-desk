import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarRequest } from '../database/entities/car-request.entity.js';

// ── Response types ──────────────────────────────────────────────────────

export interface AvgDurationPoint {
  period: string;
  avgDurationSeconds: number;
  count: number;
}

export interface BrandCountPoint {
  period: string;
  brand: string;
  count: number;
}

export interface GroupedCount {
  name: string;
  count: number;
}

export interface SummaryResult {
  totalRequests: number;
  avgPdiDurationSeconds: number;
  avgAccessoriesDurationSeconds: number;
}

/**
 * Number of seconds in 7 calendar days.
 * Used as the threshold for flagging PDI / Accessories durations
 * that exceed the 7-working-day target.
 */
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604800

// ── Service ─────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(CarRequest)
    private readonly requestsRepo: Repository<CarRequest>,
  ) {}

  // ── Summary ───────────────────────────────────────────────────────────

  async getSummary(month?: string): Promise<SummaryResult> {
    const targetMonth = month ?? this.currentMonth();
    const [year, mon] = targetMonth.split('-').map(Number);

    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59, 999);

    const result = await this.requestsRepo
      .createQueryBuilder('r')
      .select('COUNT(r.id)', 'totalRequests')
      .addSelect(
        'AVG(CASE WHEN r.pdi_completed_at IS NOT NULL THEN COALESCE(r.pdi_duration, TIMESTAMPDIFF(SECOND, r.pdi_started_at, r.pdi_completed_at)) END)',
        'avgPdiDuration',
      )
      .addSelect(
        'AVG(CASE WHEN r.accessories_completed_at IS NOT NULL THEN COALESCE(r.accessories_duration, TIMESTAMPDIFF(SECOND, r.accessories_started_at, r.accessories_completed_at)) END)',
        'avgAccessoriesDuration',
      )
      .where('r.created_at >= :start', { start })
      .andWhere('r.created_at <= :end', { end })
      .getRawOne<{
        totalRequests: string;
        avgPdiDuration: string | null;
        avgAccessoriesDuration: string | null;
      }>();

    return {
      totalRequests: parseInt(result?.totalRequests ?? '0', 10) || 0,
      avgPdiDurationSeconds: Math.round(
        parseFloat(result?.avgPdiDuration ?? '0') || 0,
      ),
      avgAccessoriesDurationSeconds: Math.round(
        parseFloat(result?.avgAccessoriesDuration ?? '0') || 0,
      ),
    };
  }

  // ── PDI avg duration ──────────────────────────────────────────────────

  async getPdiAvgDuration(
    period: 'monthly' | 'daily',
  ): Promise<AvgDurationPoint[]> {
    const format =
      period === 'monthly'
        ? "DATE_FORMAT(r.pdi_completed_at, '%Y-%m')"
        : "DATE_FORMAT(r.pdi_completed_at, '%Y-%m-%d')";

    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select(format, 'period')
      .addSelect('AVG(COALESCE(r.pdi_duration, TIMESTAMPDIFF(SECOND, r.pdi_started_at, r.pdi_completed_at)))', 'avgDuration')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.pdi_completed_at IS NOT NULL')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; avgDuration: string; count: string }>();

    return rows.map((row) => ({
      period: row.period,
      avgDurationSeconds: Math.round(parseFloat(row.avgDuration) || 0),
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Accessories avg duration ──────────────────────────────────────────

  async getAccessoriesAvgDuration(
    period: 'monthly' | 'daily',
  ): Promise<AvgDurationPoint[]> {
    const format =
      period === 'monthly'
        ? "DATE_FORMAT(r.accessories_completed_at, '%Y-%m')"
        : "DATE_FORMAT(r.accessories_completed_at, '%Y-%m-%d')";

    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select(format, 'period')
      .addSelect('AVG(COALESCE(r.accessories_duration, TIMESTAMPDIFF(SECOND, r.accessories_started_at, r.accessories_completed_at)))', 'avgDuration')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.accessories_completed_at IS NOT NULL')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; avgDuration: string; count: string }>();

    return rows.map((row) => ({
      period: row.period,
      avgDurationSeconds: Math.round(parseFloat(row.avgDuration) || 0),
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Requests by Brand ─────────────────────────────────────────────────

  async getRequestsByBrand(
    granularity: 'monthly' | 'daily',
  ): Promise<BrandCountPoint[]> {
    const format =
      granularity === 'monthly'
        ? "DATE_FORMAT(r.created_at, '%Y-%m')"
        : 'DATE(r.created_at)';

    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select(format, 'period')
      .addSelect('so.label', 'brand')
      .addSelect('COUNT(r.id)', 'count')
      .innerJoin('r.brand', 'so')
      .groupBy('period')
      .addGroupBy('so.label')
      .orderBy('period', 'ASC')
      .addOrderBy('count', 'DESC')
      .getRawMany<{ period: string; brand: string; count: string }>();

    return rows.map((row) => ({
      period: row.period,
      brand: row.brand,
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Requests by Type ──────────────────────────────────────────────────

  async getRequestsByType(): Promise<GroupedCount[]> {
    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select('so.label', 'name')
      .addSelect('COUNT(r.id)', 'count')
      .innerJoin('r.requestType', 'so')
      .groupBy('so.label')
      .orderBy('count', 'DESC')
      .getRawMany<{ name: string; count: string }>();

    return rows.map((row) => ({
      name: row.name,
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Requests by Model ─────────────────────────────────────────────────

  async getRequestsByModel(): Promise<GroupedCount[]> {
    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select('so.label', 'name')
      .addSelect('COUNT(r.id)', 'count')
      .innerJoin('r.model', 'so')
      .groupBy('so.label')
      .orderBy('count', 'DESC')
      .getRawMany<{ name: string; count: string }>();

    return rows.map((row) => ({
      name: row.name,
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Requests by Sales Consultant ──────────────────────────────────────

  async getRequestsByConsultant(): Promise<GroupedCount[]> {
    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .select('so.label', 'name')
      .addSelect('COUNT(r.id)', 'count')
      .innerJoin('r.salesConsultant', 'so')
      .groupBy('so.label')
      .orderBy('count', 'DESC')
      .getRawMany<{ name: string; count: string }>();

    return rows.map((row) => ({
      name: row.name,
      count: parseInt(row.count, 10) || 0,
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private currentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
