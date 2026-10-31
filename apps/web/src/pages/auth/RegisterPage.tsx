import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Building, Eye, EyeOff, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const passwordSchema = z
  .string()
  .min(9, 'Password must be at least 9 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~/\\`[\]]/, 'Password must contain at least one special character');

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  companyName: z.string().trim().optional(),
  password: passwordSchema,
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerAuth, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      companyName: '',
      password: '',
    },
    mode: 'onChange',
  });

  const passwordValue = watch('password') || '';

  const passwordChecks = [
    { label: 'Minimum 9 characters', valid: passwordValue.length >= 9 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(passwordValue) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(passwordValue) },
    {
      label: 'At least one special character (!@#$%^&*)',
      valid: /[!@#$%^&*(),.?":{}|<>_\-+=~/\\`[\]]/.test(passwordValue),
    },
  ];

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/portal', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setServerError(null);
      await registerAuth({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        companyName: values.companyName || undefined,
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      const message =
        errorObj?.response?.data?.error?.message ||
        'Registration failed. Please review your details and try again.';
      setServerError(message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Create your Customer Account</h2>
        <p className="text-xs text-slate-400 mt-1">
          Sign up to manage subscription plans, review quotes, and pay invoices.
        </p>
      </div>

      {serverError && (
        <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <Input
          label="Full Name *"
          placeholder="Jane Doe"
          leftIcon={<User className="h-4 w-4" />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label="Email Address *"
          type="email"
          placeholder="jane@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Company Name (Optional)"
          placeholder="Acme Corporation"
          leftIcon={<Building className="h-4 w-4" />}
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        <div className="relative">
          <Input
            label="Password *"
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
        </div>

        {/* Live Password Strength Checklist */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-300 mb-1">Security Requirements:</p>
          {passwordChecks.map((check, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[11px]">
              {check.valid ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              )}
              <span className={check.valid ? 'text-emerald-300' : 'text-slate-400'}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        <Button type="submit" className="w-full mt-2" isLoading={isSubmitting}>
          Create Customer Account
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        Already registered?{' '}
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
          Sign In
        </Link>
      </div>
    </div>
  );
};
