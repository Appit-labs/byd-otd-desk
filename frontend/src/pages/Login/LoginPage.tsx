import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import fullLogo from '@/assets/logos/BYD-OTP-DESK_full-logo.png';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/services/api';
import type { Department } from '@/types';
import styles from './LoginPage.module.css';

const loginSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      department: '',
      username: '',
      password: '',
    },
  });

  // Fetch departments on mount
  useEffect(() => {
    api
      .get<Department[]>('/v1/departments')
      .then((res) => {
        const deptOptions = res.data.map((d) => ({
          value: d.name,
          label: d.name,
        }));
        // Add admin/super_admin as non-department options
        deptOptions.push(
          { value: 'Admin', label: 'Admin' },
          { value: 'Super Admin', label: 'Super Admin' }
        );
        setDepartments(deptOptions);
      })
      .catch(() => {
        // Fallback if API not available
        setDepartments([
          { value: 'Admin', label: 'Admin' },
          { value: 'Super Admin', label: 'Super Admin' },
          { value: 'Sales', label: 'Sales' },
          { value: 'Logistics', label: 'Logistics' },
          { value: 'Production', label: 'Production' },
          { value: 'Delivery', label: 'Delivery' },
        ]);
      });
  }, []);

  // Restore previously selected department
  useEffect(() => {
    const saved = localStorage.getItem('login_department');
    if (saved) {
      setValue('department', saved);
    }
  }, [setValue, departments]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRoleBasedDefaultPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setLoginError(null);
      try {
        localStorage.setItem('login_department', data.department);
        await login(data.department, data.username, data.password);
        setIsLeaving(true);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Invalid credentials';
        setLoginError(msg);
      }
    },
    [login, navigate]
  );

  const formFilled = isValid;

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.meshBg}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        className={`${styles.card} ${loginError ? styles.shake : ''} ${isLeaving ? styles.cardLeave : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <img
            src={fullLogo}
            alt="BYD OTD Desk"
            style={{ height: 40, margin: '0 auto 16px', filter: 'brightness(0) invert(1)' }}
          />
          <h1 className={styles.title}>BYD OTD Desk</h1>
          <p className={styles.subtitle}>Sign in to your account</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <Select
                label="Department"
                placeholder="Select department..."
                value={field.value}
                onValueChange={field.onChange}
                options={departments}
                error={errors.department?.message}
              />
            )}
          />

          <Controller
            name="username"
            control={control}
            render={({ field }) => (
              <Input
                label="Username"
                placeholder="Enter your username"
                error={errors.username?.message}
                autoComplete="username"
                {...field}
              />
            )}
          />

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                error={errors.password?.message}
                autoComplete="current-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...field}
              />
            )}
          />

          {loginError && <p className={styles.errorMsg}>{loginError}</p>}

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            disabled={!formFilled}
          >
            Sign In
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
