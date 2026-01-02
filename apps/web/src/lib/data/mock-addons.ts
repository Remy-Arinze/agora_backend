import { Sparkles, Smartphone, CreditCard, BookOpen, LucideIcon } from 'lucide-react';

export interface Addon {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  monetization: string;
  status: 'active' | 'inactive';
  icon: LucideIcon;
}

export const getAddonsData = (schoolId: string): Addon[] => {
  // This would be an API call: fetch(`/api/schools/${schoolId}/addons`)
  return [
    {
      id: '1',
      name: 'Socrates AI',
      subtitle: "The Teacher's Assistant",
      description: 'AI-powered lesson planning and grading assistant',
      features: [
        'Curriculum Alignment: Ingests the NERDC (Nigerian Curriculum). A teacher types: "Generate a lesson plan for JSS2 Integrated Science on Living Things." The AI outputs a compliant lesson note.',
        'Snap-to-Grade: Teacher takes a photo of a student\'s handwritten essay. The AI performs OCR (Optical Character Recognition), checks for grammar/relevance, and suggests a grade (e.g., "7/10 - Good points, but missed the definition of Photosynthesis").',
      ],
      monetization: 'Monthly subscription per teacher seat',
      status: 'active' as const,
      icon: Sparkles,
    },
    {
      id: '2',
      name: 'RollCall',
      subtitle: 'Attendance System',
      description: 'Biometric and card-based attendance tracking with SMS alerts',
      features: [
        'Biometric/Card: If the school issues ID cards with QR codes, the teacher scans them at the door using the mobile app.',
        'SMS Trigger: If a student is marked "Absent" at 8:30 AM, the parent automatically gets an SMS: "Agora Alert: Chioma is not in school today."',
      ],
      monetization: 'Fee per SMS sent + Hardware sales (ID Cards)',
      status: 'active' as const,
      icon: Smartphone,
    },
    {
      id: '3',
      name: 'Bursary Pro',
      subtitle: 'School Finance',
      description: 'Comprehensive financial management for schools',
      features: [
        'Payroll: Automates teacher salary payments (linked to the bank).',
        'Expense Tracker: Tracks diesel/fuel costs, chalk, and maintenance.',
        'Profit/Loss: Gives the Proprietor a "One-View" financial health dashboard.',
      ],
      monetization: 'Higher tier subscription',
      status: 'active' as const,
      icon: CreditCard,
    },
    {
      id: '4',
      name: 'PrepMaster',
      subtitle: 'CBT Engine',
      description: 'Computer-Based Testing platform for exam preparation',
      features: [
        'Practice Tests: Students can practice for JAMB/WAEC exams with realistic CBT simulations.',
        'Performance Analytics: Detailed reports on student performance and areas for improvement.',
        'Question Bank: Extensive database of past questions and answers.',
      ],
      monetization: 'Per-student subscription or school-wide license',
      status: 'inactive' as const,
      icon: BookOpen,
    },
  ];
};

