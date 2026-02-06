'use client';

import { motion } from 'framer-motion';
import { LandingNavbar } from '@/components/layout/LandingNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Products | AI-Powered School Management Tools',
  description: 'Explore Agora’s suite of products: Socrates AI, PrepMaster, GradeForge, RollCall, and Bursary Pro. Transforming every aspect of African school management.',
};

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const products = [
  {
    id: 'socrates-ai',
    icon: '🤖',
    name: 'Socrates AI',
    tagline: "The Teacher's Copilot",
    description: 'Generate NERDC-compliant lesson plans and grade handwritten essays in seconds.',
    features: [
      'AI-powered lesson plan generation',
      'NERDC curriculum alignment',
      'Handwritten essay grading',
      'Personalized feedback generation',
      'Multi-subject support',
      'Time-saving automation',
    ],
    color: 'from-violet-500 to-purple-600',
    bgColor: 'from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50',
    borderColor: 'border-violet-200 dark:border-violet-900',
    accentColor: 'text-violet-600 dark:text-violet-400',
    status: 'Coming Soon',
  },
  {
    id: 'prepmaster',
    icon: '🧠',
    name: 'PrepMaster',
    tagline: 'Study Smarter, Not Harder',
    description: 'AI-powered study companion that generates flashcards, summaries, and quizzes based on your weekly curriculum—so students always stay ahead.',
    features: [
      'AI-generated flashcards by subject',
      'Weekly curriculum-based summaries',
      'Smart revision schedules',
      'Interactive quiz generation',
      'Progress tracking & insights',
      'Spaced repetition learning',
    ],
    color: 'from-cyan-500 to-blue-600',
    bgColor: 'from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50',
    borderColor: 'border-cyan-200 dark:border-cyan-900',
    accentColor: 'text-cyan-600 dark:text-cyan-400',
    status: 'Coming Soon',
  },
  {
    id: 'gradeforge',
    icon: '📝',
    name: 'GradeForge',
    tagline: 'Assessments Made Easy',
    description: 'Generate curriculum-aligned tests, assignments, and exams in minutes—then let AI help you grade them with detailed feedback.',
    features: [
      'AI test & exam generation',
      'Curriculum-aligned questions',
      'Assignment builder',
      'Automated grading assistance',
      'Rubric-based scoring',
      'Detailed feedback generation',
    ],
    color: 'from-rose-500 to-pink-600',
    bgColor: 'from-rose-50 to-pink-50 dark:from-rose-950/50 dark:to-pink-950/50',
    borderColor: 'border-rose-200 dark:border-rose-900',
    accentColor: 'text-rose-600 dark:text-rose-400',
    status: 'Coming Soon',
  },
  {
    id: 'rollcall',
    icon: '📍',
    name: 'RollCall',
    tagline: 'Safety First',
    description: 'Biometric gate attendance that sends an instant SMS to parents when their child walks in safely.',
    features: [
      'Biometric identification',
      'Instant parent SMS alerts',
      'Real-time attendance tracking',
      'Late arrival notifications',
      'Absence pattern detection',
      'Emergency contact system',
    ],
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50',
    borderColor: 'border-emerald-200 dark:border-emerald-900',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    status: 'Coming Soon',
  },
  {
    id: 'bursary-pro',
    icon: '💸',
    name: 'Bursary Pro',
    tagline: 'Stop the Leakage',
    description: 'Track every Naira from tuition to diesel costs with an accountant-grade financial engine.',
    features: [
      'Complete fee management',
      'Expense tracking & reporting',
      'Payment gateway integration',
      'Debtor management',
      'Financial analytics dashboard',
      'Audit-ready reports',
    ],
    color: 'from-amber-500 to-orange-600',
    bgColor: 'from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
    borderColor: 'border-amber-200 dark:border-amber-900',
    accentColor: 'text-amber-600 dark:text-amber-400',
    status: 'Coming Soon',
  },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Our <span className="text-blue-600 dark:text-blue-400">Products</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              A suite of powerful tools designed to transform every aspect of school management. 
              From AI-powered teaching assistants to bulletproof financial tracking.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plugin Products */}
      <section className="py-20 bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 text-violet-600 dark:text-violet-400 rounded-full text-sm font-semibold mb-4">
              Powerful Add-ons
            </span>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Supercharge Your School
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Optional plugins that extend the power of Agora to solve specific challenges
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="space-y-8"
          >
            {products.map((product, index) => (
              <motion.div key={product.id} variants={fadeInUp}>
                <Card className={`overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br ${product.bgColor}`}>
                  <div className={`h-2 bg-gradient-to-r ${product.color}`} />
                  <div className="p-8 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Left: Product Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`w-16 h-16 bg-gradient-to-br ${product.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                            <span className="text-3xl">{product.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {product.name}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${product.accentColor} bg-white/50 dark:bg-white/10`}>
                                {product.status}
                              </span>
                            </div>
                            <p className={`text-lg font-medium ${product.accentColor}`}>
                              {product.tagline}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                          {product.description}
                        </p>
                        <Button
                          variant="outline"
                          className={`${product.borderColor} hover:bg-white/50 dark:hover:bg-white/10`}
                          disabled
                        >
                          Join Waitlist
                        </Button>
                      </div>

                      {/* Right: Features */}
                      <div className="lg:w-80">
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                          Key Features
                        </h4>
                        <ul className="space-y-3">
                          {product.features.map((feature, fIndex) => (
                            <li key={fIndex} className="flex items-center gap-3">
                              <svg className={`w-5 h-5 ${product.accentColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 bg-white dark:bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Everything Works Together
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                All our products are built on the same platform, sharing data seamlessly. 
                When a student checks in with RollCall, their attendance feeds into analytics. 
                PrepMaster pulls from the curriculum to generate study materials, while GradeForge 
                creates assessments aligned with what&apos;s being taught.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                One platform. Infinite possibilities.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">🤖</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Socrates AI</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">📍</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">RollCall</p>
                  </div>
                </div>
                <div className="space-y-3 mt-6">
                  <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">🧠</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">PrepMaster</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/50 dark:to-pink-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">📝</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">GradeForge</p>
                  </div>
                </div>
                <div className="space-y-3 mt-12">
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">💸</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Bursary Pro</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-2xl">
                    <div className="text-2xl mb-1">📊</div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Analytics</p>
                  </div>
                </div>
              </div>
              {/* Connection lines visualization */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl z-10">
                  <span className="text-white font-bold">Agora</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Your School?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Start with the core platform and add plugins as you grow
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/login"
                className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-xl"
              >
                Get Started Free
              </Link>
              <Link
                href="/about"
                className="inline-block px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 Agora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

