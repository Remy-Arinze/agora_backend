/**
 * OpenAI tool definitions for Lois agentic chat (hybrid RAG: SQL + semantic + generators).
 */
export const AGORA_TOOLS: Array<{
  type: 'function';
  function: { name: string; description: string; parameters: object };
}> = [
  {
    type: 'function',
    function: {
      name: 'execute_sql',
      description:
        'Run a read-only SQL query to get counts, facts, or specific filtered records from the school database. Available tables: Student, Teacher, Class, ClassArm, ClassTeacher, Subject, Enrollment, Grade, Attendance, AcademicSession, Term, TimetablePeriod, Assessment. For TimetablePeriod rows, join Term then AcademicSession and filter AcademicSession."schoolId". Use for quantitative questions like "How many...", "List all...", or "Find the student with ID...". ALWAYS filter by schoolId on tenant tables.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'The SELECT SQL query to execute. Must be read-only.' },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_semantic',
      description:
        'Perform a semantic vector search for information within the school knowledge base. Use for open-ended questions, summaries, or finding similar concepts in handbooks or policies.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The natural language search query' },
          limit: { type: 'number', description: 'Max number of results to return, default 5' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_school_stats',
      description:
        'Get real-time statistics for a school including total counts of students, teachers, and classes. Use when the user asks for high-level numbers about the school.',
      parameters: {
        type: 'object',
        properties: {
          schoolId: { type: 'string', description: 'The unique ID of the school' },
        },
        required: ['schoolId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_academic_risk_summary',
      description:
        'List students whose average published grade percentage is below a threshold (default 45%) for the active term. School admins see the whole school; teachers only see students in their assigned classes. Use when the user asks who is struggling, at risk, failing, or needs intervention.',
      parameters: {
        type: 'object',
        properties: {
          thresholdPercent: {
            type: 'number',
            description: 'Average percent below which a student is flagged (default 45)',
          },
          limit: { type: 'number', description: 'Max students to return (default 25, max 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grade_essay',
      description:
        'Grade a student essay based on a prompt and optional rubric. Returns score, feedback, strengths, and areas for improvement.',
      parameters: {
        type: 'object',
        properties: {
          essay: { type: 'string', description: 'The full text of the student essay' },
          prompt: { type: 'string', description: 'The prompt or question the student was answering' },
          subject: { type: 'string', description: 'The subject of the essay' },
          gradeLevel: { type: 'string', description: 'The grade level of the student' },
          rubric: { type: 'string', description: 'Optional grading rubric or criteria' },
          maxScore: { type: 'number', description: 'Maximum possible score, default 100' },
        },
        required: ['essay', 'prompt', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_lesson_plan',
      description:
        'Generate a detailed lesson plan. Use this tool even if optional details are missing; LOIS will infer them from context.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The lesson topic' },
          subject: { type: 'string', description: 'The academic subject' },
          gradeLevel: { type: 'string', description: 'e.g., JSS 1, SS 3' },
          objectives: { type: 'array', items: { type: 'string' } },
          duration: { type: 'number', description: 'Duration in minutes' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_quiz',
      description:
        'Generate quick quiz questions. Use this tool for ALL quiz requests to ensure the interactive builder appears.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The quiz topic' },
          subject: { type: 'string', description: 'The academic subject' },
          gradeLevel: { type: 'string', description: 'e.g., JSS 1' },
          questionCount: { type: 'number' },
          questionTypes: {
            type: 'array',
            items: { type: 'string', enum: ['multiple_choice', 'true_false', 'short_answer'] },
            description: 'Types of questions to include',
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_flashcards',
      description: 'Create study flashcards for a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          subject: { type: 'string' },
          gradeLevel: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_summary',
      description: 'Generate a study summary for a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          subject: { type: 'string' },
          gradeLevel: { type: 'string' },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_assessment',
      description:
        'Generate formal assessment questions. MANDATORY: ALWAYS use this tool if the user wants to create an assessment/exam so they can access the full-screen editor.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Assessment topic' },
          subject: { type: 'string', description: 'The academic subject' },
          gradeLevel: { type: 'string', description: 'e.g., SS 2' },
          questionCount: { type: 'number' },
          questionTypes: {
            type: 'array',
            items: { type: 'string', enum: ['multiple_choice', 'short_answer', 'essay'] },
            description: 'Types of questions to include',
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'mixed'] },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
];
