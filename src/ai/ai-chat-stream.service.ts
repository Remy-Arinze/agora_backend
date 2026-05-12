import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import OpenAI from 'openai';
import { MetricsService } from '../common/metrics/metrics.service';
import { PrismaService } from '../database/prisma.service';
import { AGORA_TOOLS } from './agora-chat-tools.definition';
import { AiAgentToolsService } from './ai-agent-tools.service';
import { AiChatPromptService } from './ai-chat-prompt.service';
import { AiLlmClientService } from './ai-llm-client.service';
import { toLoisStreamErrorPayload } from './ai-stream-errors';

/**
 * Lois SSE streaming chat with agentic tool-calling.
 */
@Injectable()
export class AiChatStreamService {
  private readonly logger = new Logger(AiChatStreamService.name);

  constructor(
    private readonly llm: AiLlmClientService,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly chatPrompt: AiChatPromptService,
    private readonly agentTools: AiAgentToolsService,
  ) {}

  private sendSSE(res: Response, event: { event: string; data: unknown }): void {
    if (res.writableEnded) {
      return;
    }
    try {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    } catch (e) {
      this.logger.debug(`SSE write skipped (client likely disconnected): ${e}`);
    }
  }

  async chatStreamSSE(
    res: Response,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    userId?: string,
    conversationId?: string,
    schoolId?: string,
    remainingTokens: number = Infinity,
    abortSignal?: AbortSignal,
  ): Promise<any> {
    const startTime = Date.now();
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

    const { systemPrompt, userRole } = await this.chatPrompt.getChatPrompt(messages, userId, schoolId);

    let fullAssistantContent = '';
    let finalConversationId = conversationId || null;
    let totalUsage: any = null;
    let estimatedTokens = 0;
    const toolEvents: any[] = [];

    if (userId && !finalConversationId) {
      try {
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
              create: messages
                .filter((m) => m.role.toLowerCase() !== 'system')
                .map((m) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                })),
            },
          },
        });
        finalConversationId = conversation.id;

        this.sendSSE(res, {
          event: 'conversation_id',
          data: { conversationId: finalConversationId },
        });
      } catch (err) {
        this.logger.error(`Failed to pre-create conversation: ${err}`);
      }
    }

    const abortSignalOpt =
      abortSignal && !this.llm.chatClientRejectsAbortSignal() ? { signal: abortSignal } : {};

    try {
      let currentMessages: any[] = [{ role: 'system', content: systemPrompt }, ...messages];

      let turn = 0;
      const MAX_TURNS = 3;
      let streamedFinalAssistant = false;

      while (turn < MAX_TURNS) {
        if (abortSignal?.aborted) {
          this.logger.log('chatStreamSSE: client disconnected before model turn');
          break;
        }

        turn++;
        const response = await openai.chat.completions.create({
          model,
          messages: currentMessages,
          tools: AGORA_TOOLS as OpenAI.Chat.Completions.ChatCompletionTool[],
          tool_choice: 'auto',
          temperature: 0.7,
          ...abortSignalOpt,
        });

        const choice = response.choices[0];
        totalUsage = response.usage || totalUsage;

        const toolCalls = choice.message.tool_calls?.filter(
          (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function',
        );

        if (!toolCalls || toolCalls.length === 0) {
          const finalStream = await openai.chat.completions.create({
            model,
            messages: currentMessages,
            stream: true,
            temperature: 0.7,
            ...abortSignalOpt,
          });

          for await (const chunk of finalStream as any) {
            if (abortSignal?.aborted) {
              try {
                finalStream.controller.abort();
              } catch {
                // ignore
              }
              break;
            }
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullAssistantContent += delta.content;
              estimatedTokens += Math.ceil(delta.content.length / 3.5);

              if (estimatedTokens > remainingTokens) {
                finalStream.controller.abort();
                this.sendSSE(res, {
                  event: 'error',
                  data: {
                    code: 'LOIS_CREDITS',
                    title: 'Credit limit',
                    message:
                      'This reply used the credits available for this request. Add credits or upgrade your plan to continue.',
                  },
                });
                break;
              }

              this.sendSSE(res, {
                event: 'token',
                data: { token: delta.content },
              });
            }
          }
          streamedFinalAssistant = true;
          break;
        }

        currentMessages.push(choice.message);

        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const thinkingEvent = { message: this.agentTools.getToolThinkingMessage(functionName) };
          this.sendSSE(res, { event: 'thinking', data: thinkingEvent });
          toolEvents.push({ type: 'thinking', ...thinkingEvent });

          const toolStartEvent = {
            toolName: functionName,
            toolDisplayName: this.agentTools.getToolDisplayName(functionName),
            args: functionArgs,
          };
          this.sendSSE(res, { event: 'tool_start', data: toolStartEvent });
          toolEvents.push({ type: 'tool_start', ...toolStartEvent });

          let toolResult: any;
          try {
            const result = await this.agentTools.executeAgentTool(functionName, functionArgs, {
              schoolId,
              userRole,
              userId,
            });
            toolResult = result.data;
          } catch (tErr: unknown) {
            this.logger.error(`Tool execution error: ${tErr}`);
            if (tErr instanceof ForbiddenException) {
              const p = toLoisStreamErrorPayload(tErr);
              toolResult = { error: p.message, code: p.code };
            } else {
              const anyErr = tErr as { message?: string };
              toolResult = { error: anyErr?.message || 'Something went wrong running that action.' };
            }
          }

          const toolResultEvent = {
            toolName: functionName,
            toolDisplayName: this.agentTools.getToolDisplayName(functionName),
            result: toolResult,
          };
          this.sendSSE(res, { event: 'tool_result', data: toolResultEvent });
          toolEvents.push({ type: 'tool_result', ...toolResultEvent });

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      }

      if (!streamedFinalAssistant && !abortSignal?.aborted) {
        const closing =
          "I've reached the maximum number of automated steps for this reply. " +
          'Send a short follow-up (for example **continue** or your next question) and I can keep going from here.';
        fullAssistantContent = fullAssistantContent ? `${fullAssistantContent}\n\n${closing}` : closing;
        this.sendSSE(res, {
          event: 'token',
          data: { token: closing },
        });
      }

      if (userId && finalConversationId && !abortSignal?.aborted) {
        if (conversationId) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            await this.prisma.chatMessage.create({
              data: {
                conversationId: finalConversationId,
                role: 'user',
                content: lastMessage.content,
              },
            });
          }
        }

        await this.prisma.chatMessage.create({
          data: {
            conversationId: finalConversationId,
            role: 'assistant',
            content: fullAssistantContent || 'No response generated.',
            toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
          },
        });
      }

      if (!abortSignal?.aborted) {
        this.sendSSE(res, {
          event: 'done',
          data: { conversationId: finalConversationId ?? '' },
        });

        const durationMs = Date.now() - startTime;
        this.metricsService.recordLoisDuration(durationMs, { operation: 'chat_stream' });
        this.metricsService.loisApiCallsTotal.inc({ operation: 'chat_stream', status: 'success' });
        if (totalUsage) {
          this.metricsService.loisTokensConsumedTotal.inc({ direction: 'input' }, totalUsage.prompt_tokens);
          this.metricsService.loisTokensConsumedTotal.inc({ direction: 'output' }, totalUsage.completion_tokens);
        }
      }

      return { total_tokens: (totalUsage?.total_tokens || 0) + estimatedTokens };
    } catch (error: any) {
      this.metricsService.loisApiCallsTotal.inc({ operation: 'chat_stream', status: 'failed' });
      this.metricsService.loisErrorsTotal.inc({ error_type: error?.name || 'unknown' });
      if (error?.name === 'AbortError') {
        this.logger.log('chatStreamSSE: OpenAI request aborted (client disconnect or stop)');
        // No SSE error: user stopped or closed the tab — avoid error toasts.
      } else {
        this.logger.error(`SSE Chat failed: ${error}`);
        const payload = toLoisStreamErrorPayload(error);
        this.sendSSE(res, { event: 'error', data: payload });
      }
      return { total_tokens: (totalUsage?.total_tokens || 0) + estimatedTokens };
    }
  }
}
