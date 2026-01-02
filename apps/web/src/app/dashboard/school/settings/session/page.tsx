'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { SessionWizardInfoModal } from '@/components/modals';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ArrowRight, CheckCircle, Loader2, AlertCircle, XCircle, GraduationCap, AlertTriangle } from 'lucide-react';
import {
  useGetMySchoolQuery,
  useGetActiveSessionQuery,
  useStartNewTermMutation,
  useEndSessionMutation,
  useEndTermMutation,
  useReactivateTermMutation,
  useGetSessionsQuery,
  type SessionType,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'danger' | 'warning';
  isLoading?: boolean;
}

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = 'danger',
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-surface rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
        >
          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              confirmVariant === 'danger' 
                ? 'bg-red-100 dark:bg-red-900/30' 
                : 'bg-orange-100 dark:bg-orange-900/30'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                confirmVariant === 'danger' 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-orange-600 dark:text-orange-400'
              }`} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-center text-light-text-primary dark:text-dark-text-primary mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 ${
                  confirmVariant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  confirmText
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

type Step = 1 | 2 | 3;

// Helper to get display label for school type
const getSchoolTypeLabel = (type: string) => {
  switch (type) {
    case 'PRIMARY': return 'Primary School';
    case 'SECONDARY': return 'Secondary School';
    case 'TERTIARY': return 'University/Polytechnic';
    default: return type;
  }
};

// Helper to get term/semester label based on school type
const getTermLabel = (schoolType?: string) => {
  return schoolType === 'TERTIARY' ? 'Semester' : 'Term';
};

export default function SessionWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [sessionType, setSessionType] = useState<SessionType>('NEW_TERM');
  const [sessionName, setSessionName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfTermStart, setHalfTermStart] = useState('');
  const [halfTermEnd, setHalfTermEnd] = useState('');
  const [carryOver, setCarryOver] = useState<boolean>(false); // Default to promote for new sessions
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Confirmation modal states
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [showEndTermModal, setShowEndTermModal] = useState(false);

  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  // Use the current school type from the navbar selector
  const { currentType, isMixed } = useSchoolType();

  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId || !currentType }
  );

  const { data: sessionsResponse, isLoading: isLoadingSessions } = useGetSessionsQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId || !currentType }
  );

  const [startNewTerm, { isLoading: isStarting }] = useStartNewTermMutation();
  const [reactivateTerm, { isLoading: isReactivating }] = useReactivateTermMutation();
  const [endSession, { isLoading: isEndingSession }] = useEndSessionMutation();
  const [endTerm, { isLoading: isEndingTerm }] = useEndTermMutation();

  const activeSession = activeSessionResponse?.data;
  const sessions = sessionsResponse?.data || [];
  const termLabel = getTermLabel(currentType);
  
  // Check if there's an active term
  const hasActiveTerm = !!activeSession?.term;

  // Filter to show:
  // 1. DRAFT terms (can be started)
  // 2. COMPLETED terms whose endDate hasn't passed (can be continued)
  const availableTerms = useMemo(() => {
    const terms: { id: string; name: string; sessionName: string; status: string; endDate?: string; canContinue?: boolean }[] = [];
    const now = new Date();
    
    sessions.forEach((session) => {
      if (session.terms) {
        session.terms.forEach((term) => {
          // Include DRAFT terms (not activated yet)
          if (term.status === 'DRAFT') {
            terms.push({
              id: term.id,
              name: term.name,
              sessionName: session.name,
              status: term.status,
              endDate: term.endDate,
              canContinue: false,
            });
          }
          // Include COMPLETED terms whose endDate hasn't passed (can be continued)
          else if (term.status === 'COMPLETED' && term.endDate) {
            const termEndDate = new Date(term.endDate);
            if (termEndDate > now) {
              terms.push({
                id: term.id,
                name: term.name,
                sessionName: session.name,
                status: term.status,
                endDate: term.endDate,
                canContinue: true,
              });
            }
          }
        });
      }
    });
    
    // Sort: continuable terms first, then by term number
    return terms.sort((a, b) => {
      if (a.canContinue && !b.canContinue) return -1;
      if (!a.canContinue && b.canContinue) return 1;
      return 0;
    });
  }, [sessions]);

  // Show info modal when page loads if no active session
  useEffect(() => {
    if (activeSessionResponse && !activeSessionResponse.isLoading) {
      if (!activeSession?.session) {
        setShowInfoModal(true);
      }
    }
  }, [activeSessionResponse, activeSession]);

  // Validate session dates (must be at least 10 months)
  const validateSessionDates = (start: string, end: string): string | null => {
    if (!start || !end) return null;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                       (endDate.getMonth() - startDate.getMonth());
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (monthsDiff < 10 || daysDiff < 300) {
      return 'An academic session must span at least 10 months (approximately one year).';
    }
    return null;
  };

  const sessionDateError = sessionType === 'NEW_SESSION' 
    ? validateSessionDates(startDate, endDate) 
    : null;

  const handleNext = () => {
    // If continuing a term (reactivation), skip dates step - go directly to submit from step 1
    if (currentStep === 1 && isReactivation) {
      handleSubmit();
      return;
    }
    if (currentStep === 2 && !shouldShowMigrationStep) {
      // Skip step 3 for NEW_TERM on PRIMARY/SECONDARY - go directly to submit
      handleSubmit();
      return;
    }
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleEndSession = async () => {
    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    try {
      await endSession({ schoolId, schoolType: currentType }).unwrap();
      setShowEndSessionModal(false);
      toast.success(`Session ended successfully for ${getSchoolTypeLabel(currentType)}! You can now start a new session.`);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to end session');
    }
  };

  const handleEndTerm = async () => {
    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    try {
      await endTerm({ schoolId, schoolType: currentType }).unwrap();
      setShowEndTermModal(false);
      toast.success(`${termLabel} ended successfully for ${getSchoolTypeLabel(currentType)}! You can now start a new ${termLabel.toLowerCase()}.`);
    } catch (error: any) {
      toast.error(error?.data?.message || `Failed to end ${termLabel.toLowerCase()}`);
    }
  };

  // Check if selected term is a "continue" (reactivation) scenario
  const selectedTermData = availableTerms.find(t => t.id === selectedTermId);
  const isReactivation = selectedTermData?.canContinue === true;

  const handleSubmit = async () => {
    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    try {
      // If continuing a completed term, use reactivateTerm
      if (sessionType === 'NEW_TERM' && isReactivation && selectedTermId) {
        await reactivateTerm({
          schoolId,
          termId: selectedTermId,
          schoolType: currentType || undefined,
        }).unwrap();

        toast.success(
          `${termLabel} continued successfully for ${getSchoolTypeLabel(currentType)}!`
        );
        router.push('/dashboard/school/overview');
        return;
      }

      // Otherwise, start a new term normally
      const result = await startNewTerm({
        schoolId,
        data: {
          name: sessionName,
          startDate,
          endDate,
          type: sessionType,
          schoolType: currentType,
          ...(sessionType === 'NEW_TERM' && selectedTermId && { termId: selectedTermId }),
        },
      }).unwrap();

      toast.success(
        `${termLabel} started successfully for ${getSchoolTypeLabel(currentType)}! ${result.data.migratedCount} students migrated.`
      );
      router.push('/dashboard/school/overview');
    } catch (error: any) {
      toast.error(error?.data?.message || `Failed to ${isReactivation ? 'continue' : 'start'} ${termLabel.toLowerCase()}`);
    }
  };

  // For Step 1: NEW_SESSION only needs sessionName (and no active session), NEW_TERM needs selectedTermId (and no active term)
  const canProceedStep1 = sessionType && 
    (sessionType === 'NEW_SESSION' 
      ? sessionName.trim().length > 0 && !activeSession?.session 
      : selectedTermId.trim().length > 0 && availableTerms.length > 0 && !hasActiveTerm);
  const canProceedStep2 = startDate && endDate && !sessionDateError;
  const canProceedStep3 = true; // Logic gate is just a question

  // For NEW_TERM on PRIMARY/SECONDARY, skip step 3 (migration options)
  // because student promotion only happens per session, not per term
  const shouldShowMigrationStep = sessionType === 'NEW_SESSION' || currentType === 'TERTIARY';

  // When continuing a term (reactivation), skip the dates step - term already has dates
  const shouldShowDatesStep = !isReactivation;

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      {/* Info Modal */}
      <SessionWizardInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />

      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Start New {termLabel}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Transition your school from "Holiday" to "Active {termLabel}"
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {(() => {
            // Determine which steps to show
            let steps: number[];
            if (isReactivation) {
              // Continuing a term: only 1 step (select term)
              steps = [1];
            } else if (shouldShowMigrationStep) {
              // New session or tertiary: 3 steps
              steps = [1, 2, 3];
            } else {
              // New term for primary/secondary: 2 steps
              steps = [1, 2];
            }
            
            return steps.map((step, idx, arr) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep >= step
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {currentStep > step ? <CheckCircle className="h-5 w-5" /> : idx + 1}
                  </div>
                  <p className="text-xs mt-2 text-center text-light-text-secondary dark:text-dark-text-secondary">
                    {step === 1 
                      ? (isReactivation ? 'Continue Term' : 'Session & Term') 
                      : step === 2 ? 'Dates' : 'Migration'}
                  </p>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ));
          })()}
        </div>

        {/* Step 1: Select Session & Term */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Session & {termLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Show current school type for mixed schools */}
              {isMixed && (
                <Alert>
                  <GraduationCap className="h-4 w-4" />
                  <div>
                    <strong>Managing:</strong> {getSchoolTypeLabel(currentType)}
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      Each school type has independent sessions and {termLabel.toLowerCase()}s.
                    </p>
                  </div>
                </Alert>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSessionType('NEW_SESSION')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      sessionType === 'NEW_SESSION'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold mb-1">New Session</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      September - Start new academic year (Promotes students)
                    </p>
                  </button>
                  <button
                    onClick={() => setSessionType('NEW_TERM')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      sessionType === 'NEW_TERM'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold mb-1">New {termLabel}</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      {currentType === 'TERTIARY' 
                        ? 'Start new semester (Carries over students)'
                        : 'January/April - Start new term (Carries over students)'}
                    </p>
                  </button>
                </div>
              </div>

              {sessionType === 'NEW_SESSION' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                      Session Name (e.g., "2025/2026")
                    </label>
                    <Input
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="2025/2026"
                      disabled={!!activeSession?.session}
                    />
                  </div>
                  {activeSession?.session && (
                    <div className="p-4 border-2 border-orange-300 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                            Active Session: {activeSession.session.name}
                            {activeSession.term && ` - ${activeSession.term.name}`}
                          </p>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                            You must end the current session before creating a new one. 
                            This will mark all {termLabel.toLowerCase()}s as completed.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => setShowEndSessionModal(true)}
                            className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:border-orange-400 dark:text-orange-300 dark:hover:bg-orange-900/40"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            End Current Session
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sessionType === 'NEW_TERM' && (
                <div className="space-y-4">
                  {/* Show active term warning with End Term button */}
                  {hasActiveTerm && (
                    <div className="p-4 border-2 border-blue-300 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                            Active {termLabel}: {activeSession?.term?.name}
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                            You must end the current {termLabel.toLowerCase()} before starting a new one.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => setShowEndTermModal(true)}
                            className="border-blue-500 text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/40"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            End Current {termLabel}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                      Select {termLabel} to Activate
                    </label>
                    {isLoadingSessions ? (
                      <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-surface flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          Loading sessions...
                        </p>
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="p-4 border border-yellow-300 dark:border-yellow-700 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          <strong>No sessions found{isMixed ? ` for ${getSchoolTypeLabel(currentType)}` : ''}.</strong> Please select "New Session" to start a new academic year first.
                        </p>
                      </div>
                    ) : availableTerms.length === 0 ? (
                      <div className="p-4 border border-yellow-300 dark:border-yellow-700 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          <strong>No available {termLabel.toLowerCase()}s.</strong> All {termLabel.toLowerCase()}s in the current session have been activated or completed. 
                          You may need to start a new academic session.
                        </p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedTermId}
                          onChange={(e) => setSelectedTermId(e.target.value)}
                          disabled={hasActiveTerm}
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary ${
                            hasActiveTerm ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="">Select a {termLabel.toLowerCase()}...</option>
                          {availableTerms.map((term) => {
                            const daysRemaining = term.endDate 
                              ? Math.ceil((new Date(term.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                              : 0;
                            return (
                              <option key={term.id} value={term.id}>
                                {term.canContinue ? '↩ Continue' : '▶ Start'} {term.sessionName} - {term.name}
                                {term.canContinue && daysRemaining > 0 ? ` (${daysRemaining} days left)` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {hasActiveTerm 
                            ? `End the current ${termLabel.toLowerCase()} to select a new one.`
                            : availableTerms.some(t => t.canContinue)
                              ? `You can continue a ${termLabel.toLowerCase()} that was ended early, or start a new one.`
                              : `Only ${termLabel.toLowerCase()}s that haven't been activated yet are shown.`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeSession?.session && sessionType === 'NEW_TERM' && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <div>
                    <strong>Current:</strong> {activeSession.session.name}
                    {activeSession.term && ` - ${activeSession.term.name} (Active)`}
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      Starting a new {termLabel.toLowerCase()} will carry over students and clone timetables from the current {termLabel.toLowerCase()}.
                    </p>
                  </div>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button onClick={handleNext} disabled={!canProceedStep1 || isReactivating}>
                  {isReactivation ? (
                    isReactivating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Continuing {termLabel}...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Continue {termLabel}
                      </>
                    )
                  ) : (
                    <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date Pickers */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Set Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                  />
                  {sessionDateError && (
                    <Alert variant="error" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">{sessionDateError}</p>
                    </Alert>
                  )}
                  {startDate && endDate && !sessionDateError && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Session duration is valid (at least 10 months)
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                    Half-Term Start (Optional)
                  </label>
                  <Input
                    type="date"
                    value={halfTermStart}
                    onChange={(e) => setHalfTermStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
                    Half-Term End (Optional)
                  </label>
                  <Input
                    type="date"
                    value={halfTermEnd}
                    onChange={(e) => setHalfTermEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceedStep2 || isStarting || isReactivating}>
                  {shouldShowMigrationStep ? (
                    <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
                  ) : (isStarting || isReactivating) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isReactivation ? 'Continuing' : 'Starting'} {termLabel}...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {isReactivation ? 'Continue' : 'Start'} {termLabel}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Logic Gate - Only shown for NEW_SESSION or TERTIARY schools */}
        {currentStep === 3 && shouldShowMigrationStep && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Student Migration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-4 text-light-text-primary dark:text-dark-text-primary">
                  Do you want to carry over students from the last {termLabel.toLowerCase()}?
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setCarryOver(true)}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      carryOver
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold mb-1">Yes - Carry Over</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      Keep students in the same class/level
                    </p>
                  </button>
                  <button
                    onClick={() => setCarryOver(false)}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      !carryOver
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold mb-1">No - Promote</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      {currentType === 'TERTIARY' 
                        ? 'Move students to next level (100L → 200L)'
                        : 'Move students to next level (JSS1 → JSS2)'}
                    </p>
                  </button>
                </div>
              </div>

              <Alert>
                <Calendar className="h-4 w-4" />
                <div>
                  <strong>Note:</strong>{' '}
                  {carryOver
                    ? `Students will remain in their current class for the new ${termLabel.toLowerCase()}.`
                    : currentType === 'TERTIARY'
                      ? 'Students will be promoted to the next level. Final year students will be marked as ALUMNI.'
                      : 'Students will be promoted to the next level. SS3 students will be marked as ALUMNI.'}
                </div>
              </Alert>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isStarting}
                  className="flex items-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting {termLabel}...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Start {termLabel}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* End Session Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEndSessionModal}
        onClose={() => setShowEndSessionModal(false)}
        onConfirm={handleEndSession}
        title="End Current Session?"
        message={`Are you sure you want to end the session "${activeSession?.session?.name}" for ${getSchoolTypeLabel(currentType)}? This will mark all ${termLabel.toLowerCase()}s as completed and cannot be undone.`}
        confirmText="End Session"
        confirmVariant="danger"
        isLoading={isEndingSession}
      />

      {/* End Term Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEndTermModal}
        onClose={() => setShowEndTermModal(false)}
        onConfirm={handleEndTerm}
        title={(() => {
          const termEndDate = activeSession?.term?.endDate;
          const isEarly = termEndDate && new Date(termEndDate) > new Date();
          return isEarly ? `End ${termLabel} Early?` : `End Current ${termLabel}?`;
        })()}
        message={(() => {
          const termEndDate = activeSession?.term?.endDate;
          const isEarly = termEndDate && new Date(termEndDate) > new Date();
          const daysRemaining = termEndDate 
            ? Math.ceil((new Date(termEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 0;
          
          let msg = `Are you sure you want to end "${activeSession?.term?.name}" for ${getSchoolTypeLabel(currentType)}?`;
          
          if (isEarly) {
            msg += `\n\n⚠️ WARNING: You are ending this ${termLabel.toLowerCase()} ${daysRemaining} days before its scheduled end date. You can continue it later from this wizard.`;
          }
          
          msg += `\n\nYou will then be able to start a new ${termLabel.toLowerCase()}.`;
          return msg;
        })()}
        confirmText={(() => {
          const termEndDate = activeSession?.term?.endDate;
          const isEarly = termEndDate && new Date(termEndDate) > new Date();
          return isEarly ? `End ${termLabel} Early` : `End ${termLabel}`;
        })()}
        confirmVariant={(() => {
          const termEndDate = activeSession?.term?.endDate;
          const isEarly = termEndDate && new Date(termEndDate) > new Date();
          return isEarly ? 'danger' : 'warning';
        })()}
        isLoading={isEndingTerm}
      />
    </ProtectedRoute>
  );
}

