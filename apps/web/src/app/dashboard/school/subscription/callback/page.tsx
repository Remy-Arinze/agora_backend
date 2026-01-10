'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLazyVerifyPaymentQuery } from '@/lib/store/api/paymentsApi';
import Link from 'next/link';

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'error';

export default function SubscriptionCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');
  
  const [verifyPayment] = useLazyVerifyPaymentQuery();

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    
    if (!reference) {
      setStatus('error');
      setMessage('No payment reference found. Please contact support.');
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyPayment(reference).unwrap();
        
        if (result.success && result.data.success) {
          setStatus('success');
          setMessage('Payment successful! Your subscription has been upgraded.');
          
          // Redirect to subscription page after 3 seconds
          setTimeout(() => {
            router.push('/dashboard/school/subscription');
          }, 3000);
        } else {
          setStatus('failed');
          setMessage('Payment could not be verified. If you were charged, please contact support.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while verifying your payment. Please contact support.');
      }
    };

    verify();
  }, [searchParams, verifyPayment, router]);

  const statusConfig = {
    verifying: {
      icon: (
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ),
      title: 'Processing Payment',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    success: {
      icon: (
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ),
      title: 'Payment Successful!',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    failed: {
      icon: (
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
      title: 'Payment Failed',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
    },
    error: {
      icon: (
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      ),
      title: 'Something Went Wrong',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={`${config.bgColor} rounded-2xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center`}>
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {config.icon}
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-bold ${config.color} mb-2`}>
          {config.title}
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>

        {/* Actions */}
        {status === 'success' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Redirecting to your subscription page...
          </p>
        )}

        {(status === 'failed' || status === 'error') && (
          <div className="space-y-3">
            <Link
              href="/dashboard/school/subscription"
              className="block w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Back to Subscription
            </Link>
            <a
              href="mailto:support@agora.ng?subject=Payment%20Issue"
              className="block w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Contact Support
            </a>
          </div>
        )}

        {status === 'verifying' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please wait while we confirm your payment...
          </p>
        )}
      </div>
    </div>
  );
}

















