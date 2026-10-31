import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const resetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(9, 'Password must be at least 9 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~/\\`[\]]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password', '');

  // Password requirements checklist
  const requirements = [
    { label: 'At least 9 characters', met: passwordValue.length >= 9 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(passwordValue) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(passwordValue) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>_\-+=~/\\`[\]]/.test(passwordValue) },
  ];

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      setServerError(null);
      await apiClient.post('/api/auth/reset-password', {
        token,
        newPassword: values.password,
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(
        errorObj.response?.data?.error?.message ||
          'Failed to reset password. The link may have expired.',
      );
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Invalid Reset Link</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto">
          This password reset link is invalid or incomplete because the security token is missing.
        </p>
        <div className="pt-2">
          <Link to="/forgot-password">
            <Button variant="primary" size="sm">
              Request a New Link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Password Reset Complete</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto">
          Your password has been securely updated and all prior active login sessions have been invalidated.
        </p>
        <div className="pt-4">
          <Link to="/login">
            <Button variant="primary" size="sm" className="w-full justify-center">
              Sign In with New Password
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Create a new password</h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter and confirm your new secure password below.
        </p>
      </div>

      {serverError && (
        <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••••••"
          leftIcon={<Lock className="h-4 w-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-200 transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Real-time Requirements Checklist */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">
            Password requirements:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {requirements.map((req, idx) => (
              <div
                key={idx}
                className={`text-[11px] flex items-center gap-1.5 ${
                  req.met ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {req.met ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <X className="h-3 w-3 shrink-0" />
                )}
                <span>{req.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Input
          label="Confirm New Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="••••••••••••"
          leftIcon={<Lock className="h-4 w-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-slate-400 hover:text-slate-200 transition"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" className="w-full mt-2" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
          Cancel and return to sign in
        </Link>
      </div>
    </div>
  );
};
