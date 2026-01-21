'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/request-password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || 'Failed to send password reset email';
        throw new Error(errorMessage);
      }

      if (data.success) {
        setIsSuccess(true);
        toast.success('Password reset link sent to your email!');
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Agora Logo */}
        <div className="flex items-center justify-center mb-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logos/agora_worded_white.png"
              alt="Agora"
              width={180}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Forgot Password?
              </CardTitle>
            </div>
            <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
              {isSuccess
                ? 'Check your email for a password reset link'
                : "Enter your email address and we'll send you a link to reset your password"}
            </p>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4">
                <Alert variant="success" className="mb-4">
                  <div>
                    <p className="font-semibold mb-2">Password reset email sent!</p>
                    <p className="text-sm">
                      If an account exists with this email, a password reset link has been sent. 
                      Please check your inbox (and spam folder) and follow the instructions.
                    </p>
                    <p className="text-sm mt-2 text-light-text-secondary dark:text-dark-text-secondary">
                      <strong>Note:</strong> If you have accounts at multiple schools, the email will 
                      include all your schools and Public IDs. You can log in with your email or any Public ID.
                    </p>
                  </div>
                </Alert>
                <div className="text-center space-y-2">
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Didn&apos;t receive the email? Check your spam folder or try again.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsSuccess(false);
                      setEmail('');
                    }}
                  >
                    Send Another Email
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Email Address *
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      required
                      placeholder="Enter your email address"
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isSubmitting}
                    disabled={isSubmitting || !email}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              </>
            )}

            <div className="mt-4 text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
