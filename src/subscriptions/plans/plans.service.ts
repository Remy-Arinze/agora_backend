import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../dto/subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
    constructor(private readonly prisma: PrismaService) { }

    async getPublicPlans() {
        return this.prisma.subscriptionPlan.findMany({
            where: { isPublic: true },
            orderBy: { monthlyPrice: 'asc' },
        });
    }

    async getPlansForSchool(schoolId: string) {
        return this.prisma.subscriptionPlan.findMany({
            where: {
                OR: [
                    { isPublic: true },
                    { customSchoolId: schoolId },
                ],
            },
            orderBy: { monthlyPrice: 'asc' },
        });
    }

    async getAllPlans() {
        return this.prisma.subscriptionPlan.findMany({
            orderBy: [
                { isPublic: 'desc' },
                { monthlyPrice: 'asc' },
            ],
            include: {
                customSchool: {
                    select: { name: true, subdomain: true },
                },
            },
        });
    }

    async getPlanById(id: string) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async createPlan(data: CreateSubscriptionPlanDto) {
        return this.prisma.subscriptionPlan.create({
            data: {
                tierCode: data.tierCode,
                name: data.name,
                description: data.description,
                monthlyPrice: data.monthlyPrice,
                yearlyPrice: data.yearlyPrice,
                features: data.features as any,
                highlight: data.highlight ?? false,
                cta: data.cta,
                accent: data.accent,
                isPublic: data.isPublic ?? true,
                customSchoolId: data.customSchoolId,
                maxStudents: data.maxStudents,
                maxTeachers: data.maxTeachers,
                maxAdmins: data.maxAdmins,
                aiCredits: data.aiCredits,
            },
        });
    }

    async updatePlan(id: string, data: UpdateSubscriptionPlanDto) {
        await this.getPlanById(id);
        const updatedPlan = await this.prisma.subscriptionPlan.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                monthlyPrice: data.monthlyPrice,
                yearlyPrice: data.yearlyPrice,
                features: data.features as any,
                highlight: data.highlight,
                cta: data.cta,
                accent: data.accent,
                isPublic: data.isPublic,
                customSchoolId: data.customSchoolId,
                maxStudents: data.maxStudents,
                maxTeachers: data.maxTeachers,
                maxAdmins: data.maxAdmins,
                aiCredits: data.aiCredits,
            },
        });

        // Sync limits to all active subscriptions using this plan
        if (
            data.maxStudents !== undefined ||
            data.maxTeachers !== undefined ||
            data.maxAdmins !== undefined ||
            data.aiCredits !== undefined
        ) {
            await this.prisma.subscription.updateMany({
                where: { planId: id },
                data: {
                    ...(data.maxStudents !== undefined ? { maxStudents: data.maxStudents } : {}),
                    ...(data.maxTeachers !== undefined ? { maxTeachers: data.maxTeachers } : {}),
                    ...(data.maxAdmins !== undefined ? { maxAdmins: data.maxAdmins } : {}),
                    ...(data.aiCredits !== undefined ? { aiCredits: data.aiCredits } : {}),
                },
            });
        }

        return updatedPlan;
    }

    async deletePlan(id: string) {
        await this.getPlanById(id);
        return this.prisma.subscriptionPlan.delete({
            where: { id },
        });
    }
}
