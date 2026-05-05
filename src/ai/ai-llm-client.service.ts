import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import OpenAI, { AzureOpenAI } from 'openai';
import { PrismaService } from '../database/prisma.service';

/**
 * Central OpenAI / Azure client, embedding client, model id, and read-only Prisma for Lois SQL.
 * Other AI services depend on this instead of duplicating client construction.
 */
@Injectable()
export class AiLlmClientService {
  private readonly logger = new Logger(AiLlmClientService.name);
  private openai: OpenAI | null = null;
  private embeddingsClient: OpenAI | null = null;
  private readonly model: string;
  private readonly readOnlyPrisma: PrismaClient;
  /** Main chat client is Azure; Azure rejects `signal` on chat.completions (400 unknown argument). */
  private readonly mainChatUsesAzureOpenAi: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const readOnlyUrl =
      this.configService.get<string>('READONLY_DATABASE_URL') ||
      this.configService.get<string>('DATABASE_URL') ||
      this.configService.get<string>('DB_URL');
    this.readOnlyPrisma = new PrismaClient({
      datasources: { db: { url: readOnlyUrl } },
    });

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const azureApiKey = this.configService.get<string>('AZURE_OPENAI_API_KEY');
    const azureEndpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
    const azureDeployment = this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT');
    const azureApiVersion = this.configService.get<string>('AZURE_OPENAI_API_VERSION');

    const azureEmbedKey = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_API_KEY');
    const azureEmbedEndpoint =
      this.configService.get<string>('Azure_OPENAI_EMBEDDING_ENDPOINT') ||
      this.configService.get<string>('AZURE_OPENAI_EMBEDDING_ENDPOINT');
    const azureEmbedDeployment = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_DEPLOYMENT');
    const azureEmbedApiVersion = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_API_VERSION');

    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';

    if (azureApiKey && azureEndpoint && azureDeployment) {
      this.mainChatUsesAzureOpenAi = true;
      this.openai = new AzureOpenAI({
        apiKey: azureApiKey,
        endpoint: azureEndpoint,
        apiVersion: azureApiVersion || '2025-01-01-preview',
        deployment: azureDeployment,
      }) as any;
      this.logger.log(`Azure OpenAI initialized with deployment: ${azureDeployment}`);
    } else if (apiKey && apiKey !== 'your_openai_api_key_here') {
      this.mainChatUsesAzureOpenAi = false;
      this.openai = new OpenAI({ apiKey });
      this.logger.log('Standard OpenAI client initialized');
    } else {
      this.mainChatUsesAzureOpenAi = false;
      this.logger.warn('AI services are not configured (neither OpenAI nor Azure)');
    }

    if (azureEmbedKey && azureEmbedEndpoint && azureEmbedDeployment) {
      this.embeddingsClient = new AzureOpenAI({
        apiKey: azureEmbedKey,
        endpoint: azureEmbedEndpoint,
        apiVersion: azureEmbedApiVersion || '2023-05-15',
        deployment: azureEmbedDeployment,
      }) as any;
      this.logger.log(`Azure OpenAI Embeddings initialized with deployment: ${azureEmbedDeployment}`);
    } else {
      this.embeddingsClient = this.openai;
      if (this.openai) {
        this.logger.log('Using default OpenAI client for embeddings fallback');
      }
    }
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  ensureConfigured(): void {
    if (!this.openai) {
      throw new BadRequestException('AI features are not configured. Please contact your administrator.');
    }
  }

  getOpenai(): OpenAI {
    this.ensureConfigured();
    return this.openai!;
  }

  getEmbeddingsClient(): OpenAI {
    this.ensureConfigured();
    if (!this.embeddingsClient) {
      throw new BadRequestException('Embeddings client is not configured.');
    }
    return this.embeddingsClient;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * When true, do not pass `signal` to `chat.completions.create` — Azure returns 400
   * "Unrecognized request argument supplied: signal". Abort is still handled between
   * turns and via stream `controller.abort()` where applicable.
   */
  chatClientRejectsAbortSignal(): boolean {
    return this.mainChatUsesAzureOpenAi;
  }

  getReadOnlyPrisma(): PrismaClient {
    return this.readOnlyPrisma;
  }

  /** Primary Prisma (read-write) for app data — same instance as Nest PrismaService. */
  getPrisma(): PrismaService {
    return this.prisma;
  }
}
