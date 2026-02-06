'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import { setCredentials } from '@/lib/store/slices/authSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';
import Image from 'next/image';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OtpVerification } from '@/components/auth/OtpVerification';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    emailOrPublicId: '',
    password: '',
  });
  const sessionExpired = searchParams?.get('expired') === 'true';

  useEffect(() => {
    if (sessionExpired) {
      setError('Your session has expired. Please log in again to continue.');
    }
  }, [sessionExpired]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Include credentials to receive httpOnly cookie from server
          credentials: 'include',
          body: JSON.stringify({
            emailOrPublicId: formData.emailOrPublicId,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      // Debug logging
      console.log('Login response:', {
        ok: response.ok,
        status: response.status,
        data,
        requiresOtp: data?.data?.requiresOtp,
        sessionId: data?.data?.sessionId,
        email: data?.data?.email,
      });

      if (!response.ok) {
        // Handle validation errors from backend
        const errorMessage = data.message || 
          (data.error && typeof data.error === 'string' ? data.error : null) ||
          (data.error && Array.isArray(data.error) ? data.error.join(', ') : null) ||
          'Login failed';
        throw new Error(errorMessage);
      }

      // Backend returns ResponseDto<T> structure: { success, message, data, timestamp }
      if (data.success && data.data) {
        // Check if OTP is required
        if (data.data.requiresOtp && data.data.sessionId) {
          console.log('OTP required, showing OTP screen');
          setRequiresOtp(true);
          setOtpSessionId(data.data.sessionId);
          setOtpEmail(data.data.email || formData.emailOrPublicId);
          setError(null);
          return;
        }

        // Legacy flow (should not happen with new implementation)
        if (data.data.accessToken && data.data.user) {
          console.warn('Legacy login flow detected - OTP was bypassed!', data.data);
          dispatch(
            setCredentials({
              accessToken: data.data.accessToken,
              refreshToken: data.data.refreshToken,
              user: data.data.user,
            })
          );

          if (data.data.user.schoolId) {
            localStorage.setItem('currentSchoolId', data.data.user.schoolId);
          }

          const roleMap: Record<string, string> = {
            SUPER_ADMIN: '/dashboard/super-admin',
            SCHOOL_ADMIN: '/dashboard/school',
            TEACHER: '/dashboard/teacher',
            STUDENT: '/dashboard/student',
          };

          router.push(roleMap[data.data.user.role] || '/dashboard');
        } else {
          console.error('Unexpected login response structure:', data);
          setError('Unexpected response from server. Please try again.');
        }
      } else {
        console.error('Login response missing success or data:', data);
        setError('Invalid response from server. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (code: string) => {
    if (!otpSessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/verify-login-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: otpSessionId,
            code,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || 
          (data.error && typeof data.error === 'string' ? data.error : null) ||
          (data.error && Array.isArray(data.error) ? data.error.join(', ') : null) ||
          'OTP verification failed';
        throw new Error(errorMessage);
      }

      if (data.success && data.data) {
        dispatch(
          setCredentials({
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            user: data.data.user,
          })
        );

        if (data.data.user.schoolId) {
          localStorage.setItem('currentSchoolId', data.data.user.schoolId);
        }

        const roleMap: Record<string, string> = {
          SUPER_ADMIN: '/dashboard/super-admin',
          SCHOOL_ADMIN: '/dashboard/school',
          TEACHER: '/dashboard/teacher',
          STUDENT: '/dashboard/student',
        };

        router.push(roleMap[data.data.user.role] || '/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    // Re-submit login to get new OTP
    if (!formData.emailOrPublicId || !formData.password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            emailOrPublicId: formData.emailOrPublicId,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend OTP');
      }

      if (data.success && data.data && data.data.sessionId) {
        setOtpSessionId(data.data.sessionId);
        setOtpEmail(data.data.email || formData.emailOrPublicId);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequiresOtp(false);
    setOtpSessionId(null);
    setOtpEmail(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--light-bg)] dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logos/agora_word_blue.png"
              alt="Agora"
              width={180}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </Link>
        </div>

        {requiresOtp && otpSessionId && otpEmail ? (
          <>
            <OtpVerification
              email={otpEmail}
              sessionId={otpSessionId}
              onVerify={handleOtpVerify}
              onResend={handleResendOtp}
              isLoading={isLoading}
              error={error}
            />
            <div className="mt-4 text-center">
              <button
                onClick={handleBackToLogin}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to login
              </button>
            </div>
          </>
        ) : (
          <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign in to your account</CardTitle>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {sessionExpired && (
              <Alert variant="warning">
                <div>
                  <p className="font-semibold">Session Expired</p>
                  <p className="text-sm mt-1">Your session has expired for security reasons. Please log in again to continue.</p>
                </div>
              </Alert>
            )}
            {error && !sessionExpired && (
              <Alert variant="error">{error}</Alert>
            )}

            <Input
              label="Email or Public ID"
              type="text"
              placeholder="superadmin@agora.com or AG-SCHL-A3B5C7"
              value={formData.emailOrPublicId}
              onChange={(e) =>
                setFormData({ ...formData, emailOrPublicId: e.target.value })
              }
              required
            />

            <div className="w-full">
              <label
                htmlFor="password-input"
                className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={8}
                  className="w-full px-4 py-2 pr-10 border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder-light-text-muted dark:placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors border-light-border dark:border-dark-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={
                !formData.password || 
                formData.password.length < 8 ||
                !formData.emailOrPublicId
              }
            >
              Sign In
            </Button>

            <div className="text-center space-y-2 text-sm">
              <p>
                <Link href="/auth/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Forgot your password?
                </Link>
              </p>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Need to claim your account?{' '}
                <Link href="/auth/verify-otp" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Verify with OTP
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--light-bg)] dark:bg-dark-bg">
        <LoadingSpinner />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

