'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { ArrowLeft, Check, Layout, Palette, Sparkles } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  preview: string;
  icon: React.ElementType;
  features: string[];
  color: string;
}

const templates: Template[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean and contemporary design perfect for modern schools. Features bold typography and vibrant colors.',
    preview: '/templates/modern-preview.jpg',
    icon: Sparkles,
    features: [
      'Hero section with call-to-action',
      'About section',
      'Programs showcase',
      'Testimonials',
      'Contact form',
      'Social media integration',
    ],
    color: 'blue',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional and professional design ideal for established institutions. Elegant and timeless.',
    preview: '/templates/classic-preview.jpg',
    icon: Layout,
    features: [
      'Header with navigation',
      'Mission and vision',
      'Academic programs',
      'Faculty highlights',
      'News and updates',
      'Footer with links',
    ],
    color: 'green',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and focused design that puts your content first. Perfect for schools that value clarity.',
    preview: '/templates/minimal-preview.jpg',
    icon: Palette,
    features: [
      'Minimalist hero',
      'Key information sections',
      'Image galleries',
      'Simple navigation',
      'Clean typography',
      'Mobile-first design',
    ],
    color: 'purple',
  },
];

export default function TemplateSelectionPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleContinue = () => {
    if (selectedTemplate) {
      router.push(`/dashboard/school/site-builder/editor?template=${selectedTemplate}`);
    }
  };

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/school/overview')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Choose a Template
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Select a template to start building your school&apos;s website. You can customize everything later.
          </p>
        </motion.div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {templates.map((template, index) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;

            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-blue-600 dark:ring-blue-500 shadow-lg'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  <CardContent className="pt-6">
                    {/* Preview Placeholder */}
                    <div
                      className={`w-full h-48 rounded-lg mb-4 flex items-center justify-center ${
                        template.color === 'blue'
                          ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                          : template.color === 'green'
                          ? 'bg-gradient-to-br from-green-400 to-green-600'
                          : 'bg-gradient-to-br from-purple-400 to-purple-600'
                      }`}
                    >
                      <Icon className="h-16 w-16 text-white opacity-80" />
                    </div>

                    {/* Template Info */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                          {template.name}
                        </h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {template.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 ml-4">
                          <div className="h-6 w-6 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-4">
                      {template.features.slice(0, 3).map((feature, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center"
                        >
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {template.features.length > 3 && (
                        <li className="text-sm text-light-text-muted dark:text-dark-text-muted">
                          +{template.features.length - 3} more features
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleContinue}
            disabled={!selectedTemplate}
            className="min-w-[150px]"
          >
            Continue with Template
          </Button>
        </div>
      </div>
    </ProtectedRoute>
  );
}

