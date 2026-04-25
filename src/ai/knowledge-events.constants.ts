
export const KNOWLEDGE_EVENTS = {
  ENTITY_CREATED: 'knowledge.entity.created',
  ENTITY_UPDATED: 'knowledge.entity.updated',
  ENTITY_DELETED: 'knowledge.entity.deleted',
};

export type KnowledgeEntityType = 
  | 'student' 
  | 'teacher' 
  | 'school' 
  | 'class' 
  | 'grade' 
  | 'attendance' 
  | 'assessment';

export interface KnowledgeEntityEvent {
  type: KnowledgeEntityType;
  id: string;
  schoolId?: string;
}
