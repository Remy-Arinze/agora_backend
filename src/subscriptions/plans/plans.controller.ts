import { Controller, Get, Post, Body, Param, UseGuards, Put, Delete, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SubscriptionPlansService } from './plans.service';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../dto/subscription-plan.dto';
import { UserWithContext } from '../../auth/types/user-with-context.type';

@Controller('subscription-plans')
export class SubscriptionPlansController {
    constructor(private readonly plansService: SubscriptionPlansService) { }

    // Public endpoint for the landing page
    @Get('public')
    async getPublicPlans() {
        const plans = await this.plansService.getPublicPlans();
        return { success: true, data: plans };
    }

    // School-specific endpoint (returns public + custom plans for that school)
    @Get('school')
    @UseGuards(JwtAuthGuard)
    async getPlansForSchool(
        @Request() req: { user: UserWithContext }
    ) {
        const schoolId = req.user.currentSchoolId;
        if (!schoolId) {
            return { success: false, data: await this.plansService.getPublicPlans() };
        }
        const plans = await this.plansService.getPlansForSchool(schoolId);
        return { success: true, data: plans };
    }

    // --- Super Admin Endpoints ---

    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async getAllPlans() {
        const plans = await this.plansService.getAllPlans();
        return { success: true, data: plans };
    }

    @Post('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async createPlan(@Body() dto: CreateSubscriptionPlanDto) {
        const plan = await this.plansService.createPlan(dto);
        return { success: true, data: plan };
    }

    @Put('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async updatePlan(
        @Param('id') id: string,
        @Body() dto: UpdateSubscriptionPlanDto
    ) {
        const plan = await this.plansService.updatePlan(id, dto);
        return { success: true, data: plan };
    }

    @Delete('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async deletePlan(@Param('id') id: string) {
        await this.plansService.deletePlan(id);
        return { success: true, message: 'Plan deleted successfully' };
    }
}
