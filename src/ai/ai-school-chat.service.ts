import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiChatPromptService } from './ai-chat-prompt.service';
import { AiLlmClientService } from './ai-llm-client.service';

/**
 * Legacy non-streaming chat and conversation CRUD (preserved for backward compatibility).
 */
@Injectable()
export class AiSchoolChatService {
  private readonly logger = new Logger(AiSchoolChatService.name);

  constructor(
    private readonly llm: AiLlmClientService,
    private readonly prisma: PrismaService,
    private readonly chatPrompt: AiChatPromptService,
  ) {}

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    userId?: string,
    conversationId?: string,
    schoolId?: string,
  ): Promise<{ data: { response: string; conversationId: string }; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

    const { systemPrompt } = await this.chatPrompt.getChatPrompt(messages, userId, schoolId);

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...messages,
        ],
        temperature: 0.7,
      });

      const assistantContent = response.choices[0]?.message?.content || '';

      let finalConversationId = conversationId;

      if (userId) {
        if (!finalConversationId) {
          const lastUserMessage = messages.slice().reverse().find((m) => m.role === 'user');
          const title = lastUserMessage?.content
            ? lastUserMessage.content.substring(0, 40) + (lastUserMessage.content.length > 40 ? '...' : '')
            : 'New Chat';

          const conversation = await this.prisma.chatConversation.create({
            data: {
              userId,
              schoolId,
              title,
              messages: {
                create: messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              },
            },
          });
          finalConversationId = conversation.id;
        }

        if (conversationId) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            await this.prisma.chatMessage.create({
              data: {
                conversationId: finalConversationId!,
                role: 'user',
                content: lastMessage.content,
              },
            });
          }
        }

        await this.prisma.chatMessage.create({
          data: {
            conversationId: finalConversationId!,
            role: 'assistant',
            content: assistantContent,
          },
        });
      }

      return {
        data: {
          response: assistantContent,
          conversationId: finalConversationId || '',
        },
        usage: response.usage,
      };
    } catch (error) {
      this.logger.error(`AI Chat failed: ${error}`);
      throw new BadRequestException('AI assistant is currently unavailable. Please try again later.');
    }
  }

  async getConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      throw new BadRequestException('Conversation not found');
    }

    return conversation.messages;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== userId) {
      throw new BadRequestException('Conversation not found');
    }

    await this.prisma.chatConversation.delete({
      where: { id: conversationId },
    });

    return { success: true };
  }
}
