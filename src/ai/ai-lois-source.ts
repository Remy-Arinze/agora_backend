export type AgentToolContext = {
  schoolId?: string;
  userRole?: string;
  userId?: string;
  conversationId?: string | null;
};

/** Grounding chips attached to Lois tool / RAG results. */

export type LoisSource = {
  kind: 'tool' | 'rag';
  tool?: string;
  type?: string;
  label: string;
  href?: string;
  relevance?: number;
};

export type AgentToolResult = {
  data: any;
  usage: any;
  sources?: LoisSource[];
};

export function toolSource(
  tool: string,
  label: string,
  href?: string,
): LoisSource {
  return { kind: 'tool', tool, label, href };
}
