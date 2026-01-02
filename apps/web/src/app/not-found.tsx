'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--light-bg)] dark:bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 404 Illustration */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <div className="relative inline-block">
              <div className="text-9xl font-bold text-blue-600 dark:text-blue-400 opacity-20">
                404
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <AlertCircle className="h-24 w-24 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </motion.div>

          {/* Error Message */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4"
          >
            Page Not Found
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-light-text-secondary dark:text-dark-text-secondary mb-8"
          >
            The page you're looking for doesn't exist or has been moved.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              variant="primary"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="ghost"
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Go to Home
              </Button>
            </Link>
          </motion.div>

          {/* Helpful Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 pt-8 border-t border-light-border dark:border-dark-border"
          >
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted mb-4">
              Common pages:
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
                Dashboard
              </Link>
              <Link href="/dashboard/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
                Profile
              </Link>
              <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                Login
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

