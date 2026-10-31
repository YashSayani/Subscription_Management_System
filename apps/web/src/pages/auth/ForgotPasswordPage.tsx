import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      setServerError(null);
      await apiClient.post('/api/auth/forgot-password', { email: values.email });
      setSubmittedEmail(values.email);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(
        errorObj.response?.data?.error?.message ||
          'Failed to process password reset request. Please try again.',
      );
    }
  };

  if (submittedEmail) {
    return (
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">Check your email</h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
          If an account exists for <span className="text-emerald-400 font-mono font-medium">{submittedEmail}</span>,
          we have sent an email with instructions and a link to reset your password.
        </p>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 max-w-xs mx-auto">
          The reset link will remain active for <span className="text-slate-200 font-medium">1 hour</span>.
        </div>

        <div className="pt-4">
          <Link to="/login">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Return to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Reset your password</h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter your registered email address and we will send you a password reset link.
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
          label="Account Email Address"
          type="email"
          placeholder="name@company.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" className="w-full mt-2" isLoading={isSubmitting}>
          Send Reset Link
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        Remember your password?{' '}
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
};
