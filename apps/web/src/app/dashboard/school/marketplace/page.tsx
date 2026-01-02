'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { SearchInput } from '@/components/ui/SearchInput';
import { motion } from 'framer-motion';
import { 
  Puzzle,
  Sparkles,
  Smartphone,
  CreditCard,
  BookOpen,
  CheckCircle2,
  XCircle,
  Star,
  Users,
  Shield,
  Settings,
  Eye
} from 'lucide-react';

// Mock data - will be replaced with API calls later
const allPlugins = [
  {
    id: '2',
    name: 'Socrates AI',
    subtitle: "The Teacher's Assistant",
    description: 'AI-powered lesson planning and grading assistant. Generate compliant lesson notes aligned with NERDC curriculum and perform OCR-based essay grading.',
    category: 'AI & Automation',
    icon: Sparkles,
    price: '₦5,000/teacher/month',
    pricingModel: 'Per teacher seat',
    features: [
      'NERDC curriculum alignment',
      'AI lesson plan generation',
      'OCR essay grading',
      'Grade suggestions',
      'Snap-to-grade functionality',
    ],
    isSubscribed: true,
    rating: 4.9,
    reviews: 89,
    installed: 342,
  },
  {
    id: '3',
    name: 'RollCall',
    subtitle: 'Attendance System',
    description: 'Biometric and card-based attendance tracking with automatic SMS alerts to parents when students are absent.',
    category: 'Attendance',
    icon: Smartphone,
    price: '₦50/SMS + Hardware',
    pricingModel: 'Pay per SMS + hardware sales',
    features: [
      'QR code ID card scanning',
      'Biometric attendance',
      'Automatic SMS alerts',
      'Real-time attendance tracking',
      'Parent notifications',
    ],
    isSubscribed: false,
    rating: 4.7,
    reviews: 67,
    installed: 198,
  },
  {
    id: '4',
    name: 'Bursary Pro',
    subtitle: 'School Finance',
    description: 'Comprehensive financial management for schools including payroll, expense tracking, and profit/loss dashboards.',
    category: 'Finance',
    icon: CreditCard,
    price: '₦25,000/month',
    pricingModel: 'Monthly subscription',
    features: [
      'Automated payroll',
      'Expense tracking',
      'Profit/Loss dashboard',
      'Bank integration',
      'Financial reports',
    ],
    isSubscribed: false,
    rating: 4.6,
    reviews: 45,
    installed: 123,
  },
  {
    id: '5',
    name: 'PrepMaster',
    subtitle: 'CBT Engine',
    description: 'Computer-Based Testing platform for exam preparation. Perfect for JAMB, WAEC, and other standardized test preparation.',
    category: 'Assessment',
    icon: BookOpen,
    price: '₦500/student/month',
    pricingModel: 'Per student or school-wide license',
    features: [
      'CBT exam creation',
      'Practice tests',
      'Performance analytics',
      'Question bank',
      'Auto-grading',
    ],
    isSubscribed: false,
    rating: 4.8,
    reviews: 112,
    installed: 267,
  },
];

type FilterCategory = 'all' | 'AI & Automation' | 'Attendance' | 'Finance' | 'Assessment';

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const filteredPlugins = allPlugins.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || plugin.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const subscribedPlugins = allPlugins.filter((p) => p.isSubscribed);
  const availablePlugins = allPlugins.filter((p) => !p.isSubscribed);

  const handleSubscribe = async (pluginId: string) => {
    setIsSubscribing(true);
    // TODO: API call to subscribe
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSubscribeModal(false);
      setSelectedPlugin(null);
      // Update plugin subscription status
    } catch (err) {
      // Handle error
    } finally {
      setIsSubscribing(false);
    }
  };

  const categories: FilterCategory[] = ['all', 'Customization', 'AI & Automation', 'Attendance', 'Finance', 'Assessment'];

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Plugin Marketplace
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Discover and subscribe to plugins to enhance your school's Agora experience
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search plugins..."
                containerClassName="flex-1"
                size="lg"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={filterCategory === category ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterCategory(category)}
                  >
                    {category === 'all' ? 'All' : category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscribed Plugins Section */}
        {subscribedPlugins.length > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
              Your Subscriptions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscribedPlugins
                .filter((p) => {
                  const matchesSearch =
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.description.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
                  return matchesSearch && matchesCategory;
                })
                .map((plugin, index) => {
                  const Icon = plugin.icon;
                  return (
                    <motion.div
                      key={plugin.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="h-full border-2 border-green-500 dark:border-green-400">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <Icon className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                  {plugin.name}
                                </CardTitle>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  {plugin.subtitle}
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded">
                              Active
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-2">
                            {plugin.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                {plugin.rating}
                              </span>
                              <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                ({plugin.reviews})
                              </span>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4 mr-1" />
                              Manage
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Available Plugins */}
        <div>
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
            Available Plugins
          </h2>
          {filteredPlugins.filter((p) => !p.isSubscribed).length === 0 ? (
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
              {filteredPlugins
                .filter((p) => !p.isSubscribed)
                .map((plugin, index) => {
                  const Icon = plugin.icon;
                  return (
                    <motion.div
                      key={plugin.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                  {plugin.name}
                                </CardTitle>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  {plugin.subtitle}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-dark-surface text-gray-800 dark:text-dark-text-primary text-xs font-medium rounded">
                              {plugin.category}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-2">
                            {plugin.description}
                          </p>
                          <div className="space-y-3 mb-4">
                            <div>
                              <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                                {plugin.price}
                              </p>
                              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                {plugin.pricingModel}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-light-text-muted dark:text-dark-text-muted">
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{plugin.rating}</span>
                                <span>({plugin.reviews})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{plugin.installed} installed</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              className="flex-1"
                              size="sm"
                              onClick={() => {
                                setSelectedPlugin(plugin.id);
                                setShowSubscribeModal(true);
                              }}
                            >
                              Subscribe
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPlugin(plugin.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Subscribe Modal */}
        {showSubscribeModal && selectedPlugin && (
          <Modal
            isOpen={showSubscribeModal}
            onClose={() => {
              setShowSubscribeModal(false);
              setSelectedPlugin(null);
            }}
            title="Subscribe to Plugin"
            size="md"
          >
            {(() => {
              const plugin = allPlugins.find((p) => p.id === selectedPlugin);
              if (!plugin) return null;
              const Icon = plugin.icon;
              return (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                        {plugin.name}
                      </h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {plugin.subtitle}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                      Pricing
                    </p>
                    <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                      {plugin.price}
                    </p>
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                      {plugin.pricingModel}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                      Features
                    </p>
                    <ul className="space-y-2">
                      {plugin.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => handleSubscribe(plugin.id)}
                      isLoading={isSubscribing}
                    >
                      Confirm Subscription
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowSubscribeModal(false);
                        setSelectedPlugin(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}

        {/* Plugin Detail Modal */}
        {selectedPlugin && !showSubscribeModal && (
          <Modal
            isOpen={!!selectedPlugin}
            onClose={() => setSelectedPlugin(null)}
            title="Plugin Details"
            size="lg"
          >
            {(() => {
              const plugin = allPlugins.find((p) => p.id === selectedPlugin);
              if (!plugin) return null;
              const Icon = plugin.icon;
              return (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                        {plugin.name}
                      </h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {plugin.subtitle}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {plugin.rating}
                          </span>
                          <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                            ({plugin.reviews} reviews)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                          <Users className="h-4 w-4" />
                          <span>{plugin.installed} schools using this</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                      Description
                    </p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      {plugin.description}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-3">
                      Features
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {plugin.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg">
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
                      Pricing
                    </p>
                    <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      {plugin.price}
                    </p>
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                      {plugin.pricingModel}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => {
                        setShowSubscribeModal(true);
                      }}
                    >
                      Subscribe Now
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedPlugin(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}

