import { ResponseTransformInterceptor } from './response-transform.interceptor';
import { Observable, of } from 'rxjs';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  it('should wrap plain data in API envelope', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
    const mockCallHandler = {
      handle: () => of({ id: 1, name: 'test' }),
    };

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    result$.subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'test' },
        error: null,
      });
      done();
    });
  });

  it('should pass through already enveloped data', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
    const mockCallHandler = {
      handle: () =>
        of({
          success: false,
          data: null,
          error: 'Something went wrong',
        }),
    };

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    result$.subscribe((result) => {
      expect(result).toEqual({
        success: false,
        data: null,
        error: 'Something went wrong',
      });
      done();
    });
  });

  it('should handle null data', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
    const mockCallHandler = {
      handle: () => of(null),
    };

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    result$.subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: null,
        error: null,
      });
      done();
    });
  });

  it('should extract paginated data correctly', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
    const paginatedData = {
      items: [{ id: 1 }, { id: 2 }],
      total: 10,
      page: 1,
      limit: 2,
    };
    const mockCallHandler = {
      handle: () => of(paginatedData),
    };

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    result$.subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: [{ id: 1 }, { id: 2 }],
        error: null,
        metadata: { total: 10, page: 1, limit: 2 },
      });
      done();
    });
  });
});
