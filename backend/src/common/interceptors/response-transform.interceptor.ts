import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  metadata?: {
    total: number;
    page: number;
    limit: number;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response is already in our envelope format, pass it through
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        // Extract pagination metadata if present
        let metadata: ApiResponse<T>['metadata'];
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'total' in data
        ) {
          const { items, total, page, limit, ...rest } = data as Record<
            string,
            unknown
          > & { items: T; total: number; page?: number; limit?: number };
          metadata = { total, page: page || 1, limit: limit || total };
          return {
            success: true,
            data: items,
            error: null,
            ...(metadata ? { metadata } : {}),
          };
        }

        return {
          success: true,
          data: data ?? null,
          error: null,
        };
      }),
    );
  }
}
