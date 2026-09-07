import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { ResponseDto } from '../common/dto/response.dto';
import { BudService } from './bud.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../database/prisma.service';

@ApiTags('bud')
@Controller('bud')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@ApiBearerAuth()
export class BudController {
  constructor(
    private readonly bud: BudService,
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: UserWithContext) {
    const data = await this.bud.getOrCreateProfile(user.id);
    return ResponseDto.ok(data);
  }

  @Post('rename/confirm')
  async confirmRename(@CurrentUser() user: UserWithContext) {
    return ResponseDto.ok(await this.bud.confirmRename(user.id));
  }

  @Post('chat/rename-hint')
  async renameHint(@CurrentUser() user: UserWithContext, @Body() body: { message: string }) {
    return ResponseDto.ok(await this.bud.maybeRenameFromChat(user.id, body.message || ''));
  }

  @Post('chat')
  async chat(@CurrentUser() user: UserWithContext, @Body() body: { message: string }) {
    return ResponseDto.ok(await this.bud.chat(user.id, body.message || ''));
  }

  @Get('today')
  async today(@CurrentUser() user: UserWithContext) {
    return ResponseDto.ok(await this.bud.getTodayReview(user.id));
  }

  @Post('cards/:cardId/rate')
  async rate(
    @CurrentUser() user: UserWithContext,
    @Param('cardId') cardId: string,
    @Body() body: { rating: number },
  ) {
    return ResponseDto.ok(await this.bud.rateCard(user.id, cardId, body.rating));
  }

  @Post('weeks/:weekId/deck')
  async deck(@CurrentUser() user: UserWithContext, @Param('weekId') weekId: string) {
    return ResponseDto.ok(await this.bud.generateDeckForWeek(user.id, weekId));
  }

  @Post('sessions')
  async session(
    @CurrentUser() user: UserWithContext,
    @Body() body: { type: 'REVIEW' | 'FLASHCARDS' | 'QUIZ' | 'TEACH_BACK' | 'CHAT'; stableKeys?: string[] },
  ) {
    return ResponseDto.ok(await this.bud.recordSession(user.id, body.type as any, body.stableKeys || []));
  }

  @Get('plans')
  async plans() {
    const data = await this.prisma.budPlan.findMany({ where: { isActive: true }, orderBy: { priceKobo: 'asc' } });
    return ResponseDto.ok(data);
  }

  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: UserWithContext,
    @Body() body: { planId: string; callbackUrl?: string },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        guardians: { include: { parent: true } },
        enrollments: { where: { isActive: true }, take: 1 },
      },
    });
    if (!student) throw new Error('Student not found');
    const guardianEmail = student.guardians.find((g) => g.isPrimary)?.parent?.email
      || student.guardians.find((g) => g.parent?.email)?.parent?.email;
    const email = user.email || guardianEmail;
    if (!email) throw new Error('A student or guardian email is required for Paystack');
    const result = await this.payments.initializeBudPayment({
      email,
      userId: user.id,
      studentId: student.id,
      planId: body.planId,
      schoolId: student.enrollments[0]?.schoolId,
      callbackUrl: body.callbackUrl,
    });
    return ResponseDto.ok(result);
  }

  @Get('payments/verify/:reference')
  async verify(@Param('reference') reference: string) {
    const verified = await this.payments.verifyBudReference(reference);
    if (!verified.success) {
      return ResponseDto.ok({ reference, status: 'FAILED' });
    }
    await this.payments.handleBudPaymentSuccess(reference, verified.data);
    return ResponseDto.ok({ reference, status: 'SUCCESS' });
  }
}
