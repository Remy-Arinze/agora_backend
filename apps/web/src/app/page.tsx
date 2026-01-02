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
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center"
          >
            {/* Logo and Brand */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex items-center justify-center gap-3 mb-10"
            >
              <div className="h-16 w-20 bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 shadow-2xl" />
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white drop-shadow-2xl tracking-tight">
                Agora
              </h1>
            </motion.div>
            
            {/* Main Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-2xl md:text-3xl lg:text-4xl text-white font-bold drop-shadow-xl"
            >
              One Student. One ID. A Lifelong Journey.
            </motion.p>
            
            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-lg md:text-xl text-white/95 max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg"
            >
Stop leaving student history behind. Connect every school, every grade, and every result in one unbreakable chain.            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <Button 
                size="md" 
                onClick={handleGetStarted}
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
              <Link href="#how-it-works">
                <Button 
                  variant="outline" 
                  size="md"
                  className="border-2 border-white/80 text-white hover:bg-white/10 backdrop-blur-sm shadow-xl"
                >
                  Learn More
                </Button>
              </Link>
            </motion.div>
            
            {/* Trust Indicators / Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-16"
            >
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stats ? formatNumber(stats.totalSchools) : '0+'}
                </div>
                <div className="text-white/80 text-sm md:text-base">Schools</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stats ? formatNumber(stats.totalStudents) : '0+'}
                </div>
                <div className="text-white/80 text-sm md:text-base">Students</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stats ? formatNumber(stats.totalRecords) : '0+'}
                </div>
                <div className="text-white/80 text-sm md:text-base">Records</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">100%</div>
                <div className="text-white/80 text-sm md:text-base">Secure</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Scroll Indicator - Positioned at bottom center of hero section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
        >
          <Link href="#how-it-works" className="flex flex-col items-center text-white/80 hover:text-white transition-colors">
            <span className="text-sm mb-2">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </Link>
        </motion.div>
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
              <span className="font-semibold text-blue-600 dark:text-blue-400">Agora is the Chain-of-Trust Registry</span> connecting the African education ecosystem.
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
              We are moving beyond standard Learning Management Systems. Agora creates a secure digital handshake where Schools verify Teachers, Teachers verify Data, and Parents claim their children's identities forever.
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">The "Forever" Passport</CardTitle>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Lifelong Identity</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Every student receives a Universal ID (UID) that stays with them from Primary 1 to University.
                    </p>
                  </div>
                  <div className="bg-blue-100/50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Grades, vaccinations, and awards from every school they've ever attended are secured in one unbreakable digital timeline. <span className="font-semibold text-blue-600 dark:text-blue-400">No more lost files.</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pillar 2: The Chain-of-Trust */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">The Chain-of-Trust</CardTitle>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Verification</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Every grade and academic record is signed by verified teachers. Schools verify teachers, teachers verify data through their digital signatures on assessments.
                    </p>
                  </div>
                  <div className="bg-emerald-100/50 dark:bg-emerald-900/20 rounded-xl p-4 border-l-4 border-emerald-500">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Academic records carry verified provenance. <span className="font-semibold text-emerald-600 dark:text-emerald-400">When students transfer, their complete academic history—every grade, every term—travels with them, verified and immutable.</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pillar 3: Seamless Transfers */}
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                <CardHeader className="pb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <CardTitle className="text-2xl dark:text-white mb-2">Seamless Transfers</CardTitle>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Mobility</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">The Concept</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Students transfer between schools using secure Transfer Access Codes (TAC). Their complete academic history—all grades, enrollments, and records—moves with them automatically.
                    </p>
                  </div>
                  <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-xl p-4 border-l-4 border-amber-500">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">The Benefit</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      No more lost transcripts or manual record transfers. <span className="font-semibold text-amber-600 dark:text-amber-400">Schools can view historical records of transferred students, ensuring continuity and transparency across the education ecosystem.</span>
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
              className="flex gap-6 p-6 rounded-2xl hover:bg-[var(--light-card)] dark:hover:bg-[var(--dark-surface)] transition-colors group"
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Multi-Tenant Architecture
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Each school gets its own white-label portal with complete data isolation.
                  Perfect for school districts, private networks, and government systems.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-6 rounded-2xl hover:bg-[var(--light-card)] dark:hover:bg-[var(--dark-surface)] transition-colors group"
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Secure & Immutable
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Once a parent claims a student profile, it becomes locked and immutable.
                  Prevents identity fraud and ensures academic records remain trustworthy.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-6 rounded-2xl hover:bg-[var(--light-card)] dark:hover:bg-[var(--dark-surface)] transition-colors group"
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Seamless Transfers
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Transfer students between schools with complete academic history.
                  Debt checking ensures clean transfers, and all records remain
                  signed by the original school.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-6 p-6 rounded-2xl hover:bg-[var(--light-card)] dark:hover:bg-[var(--dark-surface)] transition-colors group"
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Offline-First
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Works offline with local data persistence. Sync when connection
                  is restored. Perfect for areas with unreliable internet connectivity.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-20">
            <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Ready to Transform Education in Africa?
            </h2>
            <p className="text-xl text-blue-50 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join schools, parents, and students building the future of
              digital education identity.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl hover:shadow-white/50 transition-all duration-300 text-lg px-10 py-6 font-semibold hover:scale-105"
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
              <Link href="/auth/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/90 text-white hover:bg-white/10 backdrop-blur-sm shadow-xl text-lg px-10 py-6 font-semibold hover:scale-105 transition-all duration-300"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-xl font-bold mb-4">Agora</h3>
              <p className="text-gray-400">
                Digital Education Identity Platform for Africa
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#how-it-works" className="hover:text-white">Features</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/auth/login" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/auth/login" className="hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
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
