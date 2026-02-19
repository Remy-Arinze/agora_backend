'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  ArrowLeft,
  Save,
  Eye,
  Upload,
  Type,
  Image as ImageIcon,
  Palette,
  CheckCircle2,
  X,
} from 'lucide-react';

interface EditableField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'color';
  value: string;
  placeholder: string;
  section: string;
}

const getTemplateFields = (templateId: string): EditableField[] => {
  const baseFields: EditableField[] = [
    {
      id: 'school-name',
      label: 'School Name',
      type: 'text',
      value: '',
      placeholder: 'Enter your school name',
      section: 'Header',
    },
    {
      id: 'school-logo',
      label: 'School Logo',
      type: 'image',
      value: '',
      placeholder: 'Upload your school logo',
      section: 'Header',
    },
    {
      id: 'hero-title',
      label: 'Hero Title',
      type: 'text',
      value: '',
      placeholder: 'Welcome to Our School',
      section: 'Hero',
    },
    {
      id: 'hero-subtitle',
      label: 'Hero Subtitle',
      type: 'textarea',
      value: '',
      placeholder: 'A brief description of your school',
      section: 'Hero',
    },
    {
      id: 'primary-color',
      label: 'Primary Color',
      type: 'color',
      value: '#3b82f6',
      placeholder: '#3b82f6',
      section: 'Branding',
    },
  ];

  if (templateId === 'modern') {
    return [
      ...baseFields,
      {
        id: 'about-title',
        label: 'About Section Title',
        type: 'text',
        value: '',
        placeholder: 'About Our School',
        section: 'About',
      },
      {
        id: 'about-content',
        label: 'About Content',
        type: 'textarea',
        value: '',
        placeholder: 'Tell visitors about your school',
        section: 'About',
      },
      {
        id: 'cta-text',
        label: 'Call-to-Action Text',
        type: 'text',
        value: '',
        placeholder: 'Apply Now',
        section: 'Call to Action',
      },
    ];
  }

  if (templateId === 'classic') {
    return [
      ...baseFields,
      {
        id: 'mission',
        label: 'Mission Statement',
        type: 'textarea',
        value: '',
        placeholder: 'Your school mission',
        section: 'Mission & Vision',
      },
      {
        id: 'vision',
        label: 'Vision Statement',
        type: 'textarea',
        value: '',
        placeholder: 'Your school vision',
        section: 'Mission & Vision',
      },
    ];
  }

  // Minimal template
  return [
    ...baseFields,
    {
      id: 'key-message',
      label: 'Key Message',
      type: 'textarea',
      value: '',
      placeholder: 'Your main message to visitors',
      section: 'Content',
    },
  ];
};

function SiteBuilderEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template') || 'modern';
  const [fields, setFields] = useState<EditableField[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    setFields(getTemplateFields(templateId));
  }, [templateId]);

  const handleFieldChange = (id: string, value: string) => {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, value } : field))
    );
  };

  const handleImageUpload = (id: string, file: File) => {
    // In a real app, this would upload to a server and return a URL
    const reader = new FileReader();
    reader.onloadend = () => {
      handleFieldChange(id, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Save to backend
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleCheckout = () => {
    setShowCheckout(true);
  };

  const groupedFields = fields.reduce((acc, field) => {
    if (!acc[field.section]) {
      acc[field.section] = [];
    }
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, EditableField[]>);

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/school/site-builder/templates')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
              <Button variant="primary" size="sm" onClick={handleCheckout}>
                Checkout
              </Button>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Site Builder
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Customize your website by editing the fields below. Changes are saved automatically.
          </p>
        </motion.div>

        {showPreview ? (
          /* Preview Mode */
          <Card>
            <CardContent className="pt-6">
              <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-8 text-center">
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                  Preview Mode
                </p>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                  Website preview will be displayed here. This is a placeholder for the actual preview.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Editor Mode */
          <div className="space-y-6">
            {Object.entries(groupedFields).map(([section, sectionFields]) => (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {section}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sectionFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                          {field.label}
                        </label>
                        {field.type === 'text' && (
                          <Input
                            value={field.value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                        {field.type === 'textarea' && (
                          <textarea
                            value={field.value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                            className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                        {field.type === 'image' && (
                          <div className="space-y-2">
                            {field.value ? (
                              <div className="relative">
                                <img
                                  src={field.value}
                                  alt={field.label}
                                  className="max-w-xs h-32 object-contain border border-light-border dark:border-dark-border rounded-md"
                                />
                                <button
                                  onClick={() => handleFieldChange(field.id, '')}
                                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-light-border dark:border-dark-border rounded-lg cursor-pointer hover:bg-light-bg dark:hover:bg-dark-surface">
                                <Upload className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mb-2" />
                                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  Click to upload or drag and drop
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(field.id, file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}
                        {field.type === 'color' && (
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={field.value}
                              onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              className="h-10 w-20 border border-light-border dark:border-dark-border rounded cursor-pointer"
                            />
                            <Input
                              value={field.value}
                              onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder}
                              className="flex-1"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Checkout
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
                    <div>
                      <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                        Site Builder Subscription
                      </p>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Monthly subscription
                      </p>
                    </div>
                    <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      ₦15,000
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                      What&apos;s included:
                    </p>
                    <ul className="space-y-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      <li className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                        Custom landing page
                      </li>
                      <li className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                        Logo and branding
                      </li>
                      <li className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                        Custom domain support
                      </li>
                      <li className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                        SEO optimization
                      </li>
                    </ul>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCheckout(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        // TODO: Process payment
                        setShowCheckout(false);
                        router.push('/dashboard/school/overview');
                      }}
                      className="flex-1"
                    >
                      Subscribe
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function SiteBuilderEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light-text-secondary dark:text-dark-text-secondary">Loading...</div>
      </div>
    }>
      <SiteBuilderEditorContent />
    </Suspense>
  );
}

