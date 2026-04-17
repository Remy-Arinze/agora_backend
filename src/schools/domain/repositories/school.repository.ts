import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { School, Prisma } from '@prisma/client';

@Injectable()
export class SchoolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<School | null> {
    return this.prisma.school.findUnique({
      where: { id },
    });
  }


  async findAll(): Promise<School[]> {
    return this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.SchoolCreateInput): Promise<School> {
    return this.prisma.school.create({ data });
  }

  async update(id: string, data: Prisma.SchoolUpdateInput): Promise<School> {
    return this.prisma.school.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<School> {
    return this.prisma.school.delete({
      where: { id },
    });
  }
}
