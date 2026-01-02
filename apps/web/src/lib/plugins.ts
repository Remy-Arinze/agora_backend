// Plugin configuration and utilities
// In a real app, this would fetch from the API based on the teacher's school

import { Sparkles, Smartphone, BookOpen } from 'lucide-react';

export interface Plugin {
  id: string;
  name: string;
  slug: string;
  icon: React.ElementType;
  description: string;
  category: string;
}

// Mock data - in production, this would come from an API call
// based on the teacher's current school's subscribed plugins
export const getActivePluginsForTeacher = (): Plugin[] => {
  // TODO: Replace with actual API call
  return [
    {
      id: '2',
      name: 'Socrates AI',
      slug: 'socrates-ai',
      icon: Sparkles,
      description: "The Teacher's Assistant",
      category: 'AI & Automation',
    },
    {
      id: '3',
      name: 'RollCall',
      slug: 'rollcall',
      icon: Smartphone,
      description: 'Attendance System',
      category: 'Attendance',
    },
    {
      id: '5',
      name: 'PrepMaster',
      slug: 'prepmaster',
      icon: BookOpen,
      description: 'CBT Engine',
      category: 'Assessment',
    },
  ];
};

