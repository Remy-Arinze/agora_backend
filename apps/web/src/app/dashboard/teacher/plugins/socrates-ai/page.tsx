'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { Sparkles, FileText, Image, CheckCircle2, Wand2 } from 'lucide-react';
import { useState } from 'react';

export default function SocratesAIPage() {
  const [lessonPlanPrompt, setLessonPlanPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  const handleGenerateLessonPlan = async () => {
    setIsGenerating(true);
    // TODO: API call to generate lesson plan
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setGeneratedPlan('Generated lesson plan content will appear here...');
    setIsGenerating(false);
  };

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Socrates AI
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                AI-powered lesson planning and grading assistant
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lesson Plan Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generate Lesson Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                    Lesson Plan Prompt
                  </label>
                  <textarea
                    value={lessonPlanPrompt}
                    onChange={(e) => setLessonPlanPrompt(e.target.value)}
                    placeholder="e.g., Generate a lesson plan for JSS2 Integrated Science on Living Things"
                    rows={4}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                    Aligned with NERDC curriculum
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={handleGenerateLessonPlan}
                  isLoading={isGenerating}
                  disabled={!lessonPlanPrompt.trim()}
                  className="w-full"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Lesson Plan
                </Button>
                {generatedPlan && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-surface rounded-lg">
                    <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                      Generated Lesson Plan:
                    </h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap">
                      {generatedPlan}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Snap-to-Grade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <Image className="h-5 w-5" />
                Snap-to-Grade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg text-center">
                  <Image className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-2" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Upload a photo of a student&apos;s handwritten essay
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="essay-upload"
                  />
                  <label htmlFor="essay-upload">
                    <Button variant="ghost" asChild>
                      <span>Choose Image</span>
                    </Button>
                  </label>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary">
                    Features:
                  </p>
                  <ul className="text-xs text-light-text-secondary dark:text-dark-text-secondary space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      OCR (Optical Character Recognition)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      Grammar and relevance checks
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      Automated grade suggestions
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

