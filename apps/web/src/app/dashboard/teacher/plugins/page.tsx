'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  Puzzle,
  Sparkles,
  Smartphone,
  CreditCard,
  BookOpen,
  Search,
  CheckCircle2,
  Star,
  Zap,
  Eye,
} from 'lucide-react';

// Mock data - plugins paid for by the school
// In a real app, this would be fetched based on the teacher's current school
const schoolPlugins = [
  {
    id: '2',
    name: 'Socrates AI',
    subtitle: "The Teacher's Assistant",
    description: 'AI-powered lesson planning and grading assistant. Generate compliant lesson notes aligned with NERDC curriculum and perform OCR-based essay grading.',
    category: 'AI & Automation',
    icon: Sparkles,
    price: '₦5,000/teacher/month',
    rating: 4.9,
    reviews: 89,
    isActive: true,
    features: [
      'NERDC curriculum alignment',
      'AI lesson plan generation',
      'OCR essay grading',
      'Grade suggestions',
      'Snap-to-grade functionality',
    ],
  },
  {
    id: '3',
    name: 'RollCall',
    subtitle: 'Attendance System',
    description: 'Biometric and card-based attendance tracking with automatic SMS alerts to parents when students are absent.',
    category: 'Attendance',
    icon: Smartphone,
    price: '₦50/SMS + Hardware',
    rating: 4.7,
    reviews: 67,
    isActive: true,
    features: [
      'QR code ID card scanning',
      'Biometric attendance',
      'Automatic SMS alerts',
      'Real-time attendance tracking',
      'Parent notifications',
    ],
  },
  {
    id: '5',
    name: 'PrepMaster',
    subtitle: 'CBT Engine',
    description: 'Computer-Based Testing platform for exam preparation. Perfect for JAMB, WAEC, and other standardized test preparation.',
    category: 'Assessment',
    icon: BookOpen,
    price: '₦500/student/month',
    rating: 4.8,
    reviews: 112,
    isActive: true,
    features: [
      'CBT exam creation',
      'Practice tests',
      'Performance analytics',
      'Question bank',
      'Auto-grading',
    ],
  },
];

export default function TeacherPluginsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const filteredPlugins = schoolPlugins.filter((plugin) =>
    plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plugin.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Available Plugins
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Plugins paid for by your school. Access and use these tools to enhance your teaching.
          </p>
        </motion.div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
              <Input
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Plugins Grid */}
        {filteredPlugins.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Puzzle className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  No plugins found matching your search.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.map((plugin, index) => {
              const Icon = plugin.icon;
              return (
                <motion.div
                  key={plugin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow border-l-4 border-l-green-500 dark:border-l-green-400">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Icon className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {plugin.name}
                          </h3>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {plugin.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-dark-surface/50 text-light-text-secondary dark:text-dark-text-secondary rounded-full text-xs font-medium">
                          {plugin.category}
                        </span>
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-full text-xs font-medium flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" /> {plugin.rating} ({plugin.reviews})
                        </span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </div>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-3">
                        {plugin.description}
                      </p>
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary">
                          Key Features:
                        </p>
                        <ul className="text-xs text-light-text-secondary dark:text-dark-text-secondary space-y-1">
                          {plugin.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Zap className="h-3 w-3 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-light-border dark:border-dark-border">
                        <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                          Paid by school
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSelectedPlugin(plugin.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Access Plugin
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Puzzle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    About School-Paid Plugins
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    These plugins have been subscribed to by your school. You can access and use them 
                    at no additional cost. If you need a plugin that&apos;s not listed here, contact your 
                    school administrator to request a subscription.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

