'use client';

import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { RootState } from '@/lib/store/store';
import { LandingNavbar } from '@/components/layout/LandingNavbar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import Image from 'next/image';
import { useGetPublicSchoolsQuery, useGetPlatformStatsQuery } from '@/lib/store/api/publicApi';
import { useState, useEffect } from 'react';

const fadeInUp = {
  initial: { opacity: 0, y: 60 },
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

// Helper to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M+';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K+';
  }
  return num.toString() + '+';
};

export default function Home() {
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // Ensure component is mounted before using persisted auth state
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Fetch real platform data
  const { data: stats, error: statsError, isLoading: statsLoading } = useGetPlatformStatsQuery();
  const { data: schools, error: schoolsError, isLoading: schoolsLoading } = useGetPublicSchoolsQuery();
  
  // Debug: log errors in development
  if (process.env.NODE_ENV === 'development') {
    if (statsError) console.error('Stats API error:', statsError);
    if (schoolsError) console.error('Schools API error:', schoolsError);
  }
  
  // Only use user state after hydration to avoid mismatch
  const isLoggedIn = isMounted && !!user;

  const handleGetStarted = () => {
    if (isLoggedIn && user) {
      const roleMap: Record<string, string> = {
        SUPER_ADMIN: '/dashboard/super-admin',
        SCHOOL_ADMIN: '/dashboard/school',
        TEACHER: '/dashboard/teacher',
        STUDENT: '/dashboard/student',
      };
      router.push(roleMap[user.role] || '/dashboard');
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
      <LandingNavbar />

      {/* Hero Section - Full Viewport with Video */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center">
        {/* Video Background */}
        <div className="absolute inset-0 w-full h-full z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover scale-105"
            style={{ minHeight: '100%', minWidth: '100%' }}
            onError={(e) => {
              const video = e.currentTarget;
              video.style.display = 'none';
            }}
          >
            <source src="/course-video.mp4" type="video/mp4" />
          </video>
          {/* Gradient Overlay - More sophisticated */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-indigo-900/30" />
        </div>
        
        {/* Floating Particles/Shapes for Depth */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20">
          <div className="max-w-3xl">
            {/* Minimalist Live Badge */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mb-8 flex items-center gap-3"
            >
              <span className="flex h-2 w-2 rounded-full bg-agora-success shadow-[0_0_10px_#36FE96]"></span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/50">
                Agora
              </span>
            </motion.div>
            
            {/* Clean, Impactful Typography */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-8 tracking-tight"
            >
              The digital <br />
              Chain-of-Trust <br />
              for education.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-white/60 mb-10 leading-relaxed max-w-xl"
            >
              One student identity, verified across every institution. 
              Agora connects the African education ecosystem through a secure, lifelong registry.
            </motion.p>
            
            {/* Refined CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <Button 
                size="lg" 
                variant="primary"
                onClick={handleGetStarted}
                className="px-8 py-4 text-lg rounded-full transform hover:-translate-y-1 transition-all duration-300 font-bold"
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
              <Link href="#how-it-works">
                <Button 
                  variant="white" 
                  size="lg"
                  className="px-8 py-4 text-base rounded-full transform hover:-translate-y-1 transition-all duration-300 font-bold"
                >
                  How it works
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What is Agora Section */}
      <section id="how-it-works" data-navbar-light="true" className="py-24 bg-[var(--light-bg)] dark:bg-[var(--dark-bg)] relative overflow-hidden">
        {/* Decorative gradient elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 dark:bg-blue-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-100/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        </div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }} />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Infrastructure, Not Just Software
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed mb-4">
              <span className="font-semibold text-agora-blue">Agora is the Chain-of-Trust Registry</span> connecting the African education ecosystem.
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
              We are moving beyond standard Learning Management Systems. Agora creates a secure digital handshake where Schools verify Teachers, Teachers verify Data, and Parents claim their children&apos;s identities forever.
            </p>
          </motion.div>

          {/* The Three Pillars Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold">
              The Three Pillars
            </span>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Pillar 1: The "Forever" Passport */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agora-blue to-indigo-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-agora-blue to-indigo-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">The &quot;Forever&quot; Passport</CardTitle>
                  <p className="text-sm font-medium text-agora-blue">Lifelong Identity</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 font-sans">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Every student receives a Universal ID (UID) that stays with them from Primary 1 to University.
                    </p>
                  </div>
                  <div className="bg-blue-100/50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-agora-blue">
                    <p className="text-xs font-semibold text-agora-blue uppercase tracking-wider mb-2 font-sans">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                      Grades, vaccinations, and awards are secured in one digital timeline. <span className="text-agora-accent underline decoration-agora-accent/30 underline-offset-4">No more lost files.</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pillar 2: The Chain-of-Trust */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agora-success to-teal-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-agora-success to-teal-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">The Chain-of-Trust</CardTitle>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Verification</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 font-sans">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Every grade is signed by verified teachers. Schools verify teachers, and teachers verify data via digital signatures.
                    </p>
                  </div>
                  <div className="bg-emerald-100/50 dark:bg-emerald-900/20 rounded-xl p-4 border-l-4 border-agora-success">
                    <p className="text-xs font-semibold text-agora-success uppercase tracking-wider mb-2 font-sans">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                      Immutable academic provenance. <span className="text-agora-accent">Records are verified</span> and travel with students wherever they go.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pillar 3: Seamless Transfers */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agora-accent to-orange-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-agora-accent to-orange-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">Seamless Transfers</CardTitle>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Mobility</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 font-sans">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Transfer between schools using Transfer Access Codes (TAC). Data moves automatically.
                    </p>
                  </div>
                  <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-xl p-4 border-l-4 border-agora-accent">
                    <p className="text-xs font-semibold text-agora-accent uppercase tracking-wider mb-2 font-sans">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                      No more manual record transfers. <span className="text-agora-blue"> Continuity is guaranteed</span> across the entire ecosystem.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Schools Using Agora Section */}
      <section data-navbar-light="true" className="py-24 bg-[var(--light-bg] dark:bg-dark-surface relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-4">
              Trusted Partners
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Schools Using Agora
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Join the growing network of forward-thinking institutions
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative overflow-hidden"
          >
            {/* First carousel - scrolling right to left */}
            <div className="relative py-8">
              {/* Gradient fade edges */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, var(--light-bg), transparent)',
                }}
              />
              <div 
                className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none dark:hidden"
                style={{
                  background: 'linear-gradient(to left, var(--light-bg), transparent)',
                }}
              />
              <div 
                className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none hidden dark:block"
                style={{
                  background: 'linear-gradient(to left, var(--dark-surface), transparent)',
                }}
              />
              <div 
                className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none hidden dark:block"
                style={{
                  background: 'linear-gradient(to right, var(--dark-surface), transparent)',
                }}
              />
              
              {schools && schools.length > 0 ? (
                <div className="flex gap-12 md:gap-16 animate-scroll">
                  {/* First set of logos */}
                  {schools.map((school) => (
                    <div
                      key={school.id}
                      className="flex-shrink-0 flex items-center justify-center group"
                    >
                      {school.logo ? (
                        <Image
                          src={school.logo}
                          alt={school.name}
                          width={128}
                          height={128}
                          className="w-32 h-32 md:w-40 md:h-40 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                          <span className="text-white text-4xl md:text-5xl font-bold">
                            {school.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Duplicate set for seamless loop */}
                  {schools.map((school) => (
                    <div
                      key={`${school.id}-duplicate`}
                      className="flex-shrink-0 flex items-center justify-center group"
                    >
                      {school.logo ? (
                        <Image
                          src={school.logo}
                          alt={school.name}
                          width={128}
                          height={128}
                          className="w-32 h-32 md:w-40 md:h-40 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                          <span className="text-white text-4xl md:text-5xl font-bold">
                            {school.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Show placeholder when no schools or loading
                <div className="flex gap-12 md:gap-16">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center opacity-40 border border-dashed border-gray-300 dark:border-gray-600"
                    >
                      <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Second carousel - scrolling left to right */}
            <div className="relative py-8">
              {/* Gradient fade edges */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, var(--light-bg), transparent)',
                }}
              />
              <div 
                className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none dark:hidden"
                style={{
                  background: 'linear-gradient(to left, var(--light-bg), transparent)',
                }}
              />
              <div 
                className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none hidden dark:block"
                style={{
                  background: 'linear-gradient(to left, var(--dark-surface), transparent)',
                }}
              />
              <div 
                className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none hidden dark:block"
                style={{
                  background: 'linear-gradient(to right, var(--dark-surface), transparent)',
                }}
              />
              
              {schools && schools.length > 0 ? (
                <div className="flex gap-12 md:gap-16 animate-scroll-reverse">
                  {/* First set of logos */}
                  {schools.map((school) => (
                    <div
                      key={`reverse-${school.id}`}
                      className="flex-shrink-0 flex items-center justify-center group"
                    >
                      {school.logo ? (
                        <Image
                          src={school.logo}
                          alt={school.name}
                          width={128}
                          height={128}
                          className="w-32 h-32 md:w-40 md:h-40 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                          <span className="text-white text-4xl md:text-5xl font-bold">
                            {school.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Duplicate set for seamless loop */}
                  {schools.map((school) => (
                    <div
                      key={`reverse-${school.id}-duplicate`}
                      className="flex-shrink-0 flex items-center justify-center group"
                    >
                      {school.logo ? (
                        <Image
                          src={school.logo}
                          alt={school.name}
                          width={128}
                          height={128}
                          className="w-32 h-32 md:w-40 md:h-40 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                          <span className="text-white text-4xl md:text-5xl font-bold">
                            {school.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Show placeholder when no schools or loading
                <div className="flex gap-12 md:gap-16">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center opacity-40 border border-dashed border-gray-300 dark:border-gray-600"
                    >
                      <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Key Features Section */}
      <section data-navbar-light="true" className="py-24 bg-[var(--light-bg)] dark:bg-[var(--dark-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Key Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to manage and verify education identities
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-8 rounded-3xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-agora-blue/20 transition-all duration-300 group shadow-sm hover:shadow-xl"
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-agora-blue/10 rounded-2xl flex items-center justify-center group-hover:bg-agora-blue transition-colors duration-300">
                  <svg className="w-8 h-8 text-agora-blue group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-agora-text dark:text-white mb-3">
                  Multi-Tenant Architecture
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Each school gets a white-label portal with total isolation. Perfect for districts, networks, and government systems.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-8 rounded-3xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-agora-success/20 transition-all duration-300 group shadow-sm hover:shadow-xl"
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-agora-success/10 rounded-2xl flex items-center justify-center group-hover:bg-agora-success transition-colors duration-300">
                  <svg className="w-8 h-8 text-agora-success group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-agora-text dark:text-white mb-3">
                  Secure & Immutable
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Once a parent claims a profile, it becomes locked. We prevent identity fraud and ensure academic trust.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-8 rounded-3xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-agora-accent/20 transition-all duration-300 group shadow-sm hover:shadow-xl"
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-agora-accent/10 rounded-2xl flex items-center justify-center group-hover:bg-agora-accent transition-colors duration-300">
                  <svg className="w-8 h-8 text-agora-accent group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-agora-text dark:text-white mb-3">
                  Seamless Transfers
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Move between schools with complete academic history. Debt checking ensures clean transfers for institutions.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-8 rounded-3xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-agora-blue/20 transition-all duration-300 group shadow-sm hover:shadow-xl"
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-agora-blue/10 rounded-2xl flex items-center justify-center group-hover:bg-agora-blue transition-colors duration-300">
                  <svg className="w-8 h-8 text-agora-blue group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-agora-text dark:text-white mb-3">
                  Offline-First
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Works offline with local persistence. Perfect for areas with unreliable internet connectivity.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-agora-text relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-20 left-20 w-64 h-64 bg-agora-blue rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-agora-accent rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-agora-blue mb-6 leading-tight">
              Ready to Transform Education in Africa?
            </h2>
            <p className="text-xl text-agora-blue/80 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join schools, parents, and students building the future of
              digital education identity.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-agora-accent hover:bg-orange-600 text-white shadow-[0_10px_30px_rgba(255,83,42,0.3)] hover:shadow-[0_15px_40px_rgba(255,83,42,0.5)] transition-all duration-300 text-lg px-12 py-8 font-bold hover:scale-105 rounded-2xl"
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
              <Link href="/auth/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm shadow-xl text-lg px-12 py-8 font-bold hover:scale-105 transition-all duration-300 rounded-2xl"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-agora-text text-gray-400 py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-1">
              <Image
                src="/assets/logos/agora_worded_white.png"
                alt="Agora"
                width={140}
                height={38}
                className="h-8 w-auto mb-6 opacity-90"
              />
              <p className="text-sm leading-relaxed text-gray-500">
                The Chain-of-Trust Registry for the African education ecosystem. Securing academic identities forever.
              </p>
            </div>
            <div>
              <h4 className="text-agora-blue font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#how-it-works" className="hover:text-white">Features</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-agora-blue font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/auth/login" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/auth/login" className="hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-agora-blue font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                <li><Link href="#" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 Agora. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
