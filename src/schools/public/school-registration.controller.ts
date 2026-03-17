import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SchoolRegistrationService } from './school-registration.service';
import { RegisterSchoolDto, RegisterSchoolResponseDto } from '../dto/register-school.dto';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('schools/public')
@Controller('schools/public')
export class SchoolRegistrationController {
    constructor(private readonly registrationService: SchoolRegistrationService) { }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new school (Public)' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'School registration submitted successfully',
        type: ResponseDto<RegisterSchoolResponseDto>,
    })
    @ApiResponse({ status: HttpStatus.CONFLICT, description: 'School or email already exists' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
    async registerSchool(
        @Body() registerSchoolDto: RegisterSchoolDto,
    ): Promise<ResponseDto<RegisterSchoolResponseDto>> {
        const result = await this.registrationService.registerSchool(registerSchoolDto);
        return ResponseDto.ok(result, 'Registration submitted successfully');
    }
}
