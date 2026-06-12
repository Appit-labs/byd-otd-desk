export type UserRole = 'super_admin' | 'admin' | 'department_user' | 'viewer';

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
  department?: string;
  department_id?: number;
  role: UserRole;
  is_active?: boolean;
}

// Department moved to request.ts — export from there

export interface ApiError {
  message: string;
  statusCode: number;
}
