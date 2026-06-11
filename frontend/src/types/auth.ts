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
  department: string;
  role: UserRole;
}

export interface Department {
  id: number;
  name: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
