'use client';

import { motion } from 'framer-motion';
import { LandingNavbar } from '@/components/layout/LandingNavbar';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Our Mission',
  description: 'Learn about Agora’s mission to build the digital infrastructure for African education. We are creating a lifelong Chain-of-Trust for student records.',
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
      staggerChildren: 0.1,
    },
  },
};

const teamMembers = [
  {
    name: 'Leadership Team',
    role: 'Building the future of African education',
    description: 'A passionate team of educators, engineers, and entrepreneurs dedicated to transforming how education records are managed across Africa.',
  },
];

const coreFeatures = [
  {
    icon: '🎓',
    title: 'Student Management',
    description: 'Complete student lifecycle management from admission to graduation.',
  },
  {
    icon: '👨‍🏫',
    title: 'Teacher Portal',
    description: 'Streamlined tools for attendance, grading, and classroom management.',
  },
  {
    icon: '📊',
    title: 'Analytics Dashboard',
    description: 'Real-time insights into school performance and student progress.',
  },
  {
    icon: '🔄',
    title: 'Seamless Transfers',
    description: 'One-click student transfers with complete academic history.',
  },
  {
    icon: '🔐',
    title: 'Chain-of-Trust',
    description: 'Cryptographically secured records that cannot be tampered with.',
  },
];

const milestones = [
  { year: '2024', title: 'Founded', description: 'Agora was born from the vision of creating a unified digital identity for every African student.' },
  { year: '2024', title: 'First Schools', description: 'Launched pilot program with select schools in Lagos, Nigeria.' },
  { year: '2025', title: 'Expansion', description: 'Growing our network across Nigeria and preparing for Pan-African expansion.' },
];

export default function AboutPage() {
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
              About <span className="text-blue-600 dark:text-blue-400">Agora</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              We&apos;re on a mission to give every African student a permanent, verifiable digital education identity 
              that follows them from their first day of primary school to university graduation and beyond.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white dark:bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                To build the digital infrastructure that connects every stage of African education—creating 
                a Chain-of-Trust Registry where schools verify teachers, teachers verify data, and parents 
                claim their children&apos;s identities forever. No more lost records. No more fraudulent certificates. 
                Just truth, verified and immutable.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                A future where every child in Africa has a digital passport for education—one that opens doors 
                to opportunities, validates achievements, and creates a seamless journey from classroom to career. 
                We envision an Africa where educational credentials are universally trusted and instantly verifiable.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Platform */}
      <section className="py-20 bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-4">
              Core Platform
            </span>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Agora Education Platform
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              The foundation of everything we do—a complete school management system with 
              built-in Chain-of-Trust technology.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {coreFeatures.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow bg-[var(--light-card)] dark:bg-[var(--dark-surface)] border-gray-200 dark:border-gray-800">
                  <CardContent className="p-6">
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* The Problem We Solve */}
      <section className="py-20 bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">The Problem We Solve</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Africa&apos;s education system faces critical challenges that Agora is designed to address
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="h-full bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">📂</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Lost Records</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Millions of student records are lost every year due to paper-based systems, fires, floods, 
                    and administrative chaos. A student&apos;s academic history shouldn&apos;t disappear with their old school.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="h-full bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">🎭</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Identity Fraud</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Ghost students, fake certificates, and identity theft plague the education sector. 
                    Without a trusted verification system, fraud thrives and legitimate achievements are devalued.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="h-full bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">🔀</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transfer Chaos</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Moving between schools is a nightmare of paperwork, lost transcripts, and unverified claims. 
                    Parents spend weeks chasing documents that should transfer instantly.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-white dark:bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Our Journey</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Building the future of African education, one milestone at a time
            </p>
          </motion.div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full hidden md:block" />
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`flex items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                >
                  <div className={`w-full md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                    <Card className="inline-block bg-[var(--light-card)] dark:bg-[var(--dark-surface)]">
                      <CardContent className="p-6">
                        <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-3">
                          {milestone.year}
                        </span>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{milestone.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300">{milestone.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="hidden md:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center z-10 shadow-lg">
                    <div className="w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="hidden md:block w-1/2" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">Join the Movement</h2>
            <p className="text-xl text-blue-100 mb-8">
              Be part of the revolution transforming African education
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-xl"
            >
              Get Started Today
            </Link>
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

