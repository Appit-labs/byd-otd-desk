export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'nvs'
  | 'qc_nvs'
  | 'mechanical_check'
  | 'pdi'
  | 'accessories'
  | 'registration'
  | 'delivery'
  | 'viewer';

export interface LoginRequest {
  department: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  department?: string;
  department_id?: number;
  role: UserRole;
  isActive?: boolean;
}

// Department moved to request.ts — export from there

export interface ApiError {
  message: string;
  statusCode: number;
}
