/**
 * OpenAI tool definitions for Lois agentic chat.
 * School facts go through typed, permissioned tools — never model-authored SQL.
 */
export const AGORA_TOOLS: Array<{
  type: 'function';
  function: { name: string; description: string; parameters: object };
}> = [
  {
    type: 'function',
    function: {
      name: 'search_semantic',
      description:
        'Semantic search over the school knowledge base (policies, handbooks, indexed profiles). Use for qualitative questions, not counts or grade lists.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          limit: { type: 'number', description: 'Max results (default 5, max 8)' },
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
        'High-level counts for this school: active enrolments, teachers, and classes. Use for snapshot numbers, not named student lists.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_students',
      description:
        'List enrolled students in this school (name, class). Filter by name query and/or class. Use for "who is in JSS 2A" or "find Ada". Does not return grades.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name search (first or last name)' },
          classId: { type: 'string', description: 'Filter by class id' },
          classArmId: { type: 'string', description: 'Filter by class arm id' },
          classQuery: {
            type: 'string',
            description: 'Class name such as "JSS 2A" when you do not have an id. Prefer list_classes if this is ambiguous.',
          },
          limit: { type: 'number', description: 'Max rows (default 15, max 25)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_classes',
      description:
        'List or find classes in this school. Use for "what classes do we have", "how many arms in JSS 1", or to resolve "JSS 2A" into classArmId/classId before other tools.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional name such as "JSS 2A", "SS1 Gold", or a level like "JSS 1"',
          },
          limit: { type: 'number', description: 'Max rows (default 25, max 40)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_student_overview',
      description:
        'One student: class, recent published grades, and short attendance summary. Use when the user names a student or the page is focused on a student. Never invent an id.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student profile id' },
        },
        required: ['studentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_class_performance',
      description:
        'Class-level published grade averages for the active term, plus how many students sit below the risk threshold. Use for "how is JSS 2 doing".',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "JSS 2A" when you do not have an id' },
          thresholdPercent: { type: 'number', description: 'At-risk cutoff (default 45)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_academic_risk_summary',
      description:
        'Students whose average published grade percentage is below a threshold for the active term. School admins see the whole school; teachers only their roster.',
      parameters: {
        type: 'object',
        properties: {
          thresholdPercent: {
            type: 'number',
            description: 'Average percent below which a student is flagged (default 45)',
          },
          limit: { type: 'number', description: 'Max students (default 25, max 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_scheme_of_work',
      description:
        'Published scheme of work weeks: topic, delivery status, lesson-note presence. Use for curriculum / "what should be taught this week" / missing weeks.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classLevelId: { type: 'string' },
          subjectId: { type: 'string' },
          weekNumber: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_now_in_class',
      description:
        'What is on the timetable right now (Africa/Lagos) for a class, or the form/class teacher for primary. Use for "who is teaching this class now".',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "JSS 2A" when you do not have an id' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_timetable',
      description:
        'Full-day timetable for a class (Africa/Lagos). Use for "what does JSS 2A have on Thursday", not for the current period (use get_now_in_class).',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "JSS 2A"' },
          day: {
            type: 'string',
            description: 'Day of week (Monday–Sunday) or "today". Defaults to today in Africa/Lagos.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_staff',
      description:
        'List teachers and school admins (name, role, subjects). Use for staff directory questions. Does not return passwords.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name search' },
          kind: {
            type: 'string',
            enum: ['teacher', 'admin', 'all'],
            description: 'Which staff to list (default all for school admins; teachers only see teachers)',
          },
          limit: { type: 'number', description: 'Max rows (default 20, max 25)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'who_teaches',
      description:
        'Who teaches a subject, optionally in a class. Also returns the form/class teacher when a class is specified. Use for "who teaches JSS 2 Mathematics" or "who is the form teacher for SS1A".',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Subject name such as Mathematics or English' },
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "JSS 2A"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description:
        'Attendance totals for a class (or school-wide rollup) over recent days: present, absent, late. Use for absence questions, not named medical details.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "JSS 2A"' },
          days: { type: 'number', description: 'Lookback days (default 7, max 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_fee_debtors',
      description:
        'Students with outstanding school fees (unpaid fee records and/or enrollment debt balance). Use for bursar questions such as who owes fees. Does not record payments.',
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          classArmId: { type: 'string' },
          classQuery: { type: 'string', description: 'Class name such as "SS2"' },
          limit: { type: 'number', description: 'Max students (default 20, max 25)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_admissions',
      description:
        'Admission applications inbox: pending, accepted, or declined. Use for "how many pending applications" or recent applicants. Does not approve or reject.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
            description: 'Filter by status. Omit for a count of each status plus recent pending.',
          },
          limit: { type: 'number', description: 'Max application rows (default 15, max 25)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar',
      description:
        'School calendar events and holidays in a date range (Africa/Lagos). Use for "what is happening this week" or "are we on holiday Friday".',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD (default today)' },
          to: { type: 'string', description: 'End date YYYY-MM-DD (default 7 days from from)' },
          type: {
            type: 'string',
            enum: ['ACADEMIC', 'EVENT', 'EXAM', 'MEETING', 'HOLIDAY'],
            description: 'Optional event type filter',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_guardians',
      description:
        'Parent/guardian contacts for one student (name, relationship, phone, email). Does not send messages. Never invent a student id.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student profile id' },
        },
        required: ['studentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_lois_insights',
      description:
        'Background issues Lois already flagged for this school (academic risk, performance drops, scheme-of-work gaps, attendance, overdue fees, admissions backlog). Results are limited to what this admin is allowed to see. Use when the user asks what Lois noticed, or to explain the Overview card.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max insights (default 8, max 15)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_parent_message',
      description:
        'Draft a parent/guardian update for a student. Returns text only — it is NOT sent. Always tell the user this is a draft they must copy or send from the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          topic: { type: 'string', description: 'What the note is about' },
          tone: { type: 'string', enum: ['supportive', 'formal', 'urgent'] },
        },
        required: ['studentId', 'topic'],
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
