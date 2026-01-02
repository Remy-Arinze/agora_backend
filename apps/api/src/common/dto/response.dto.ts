import { ApiProperty } from '@nestjs/swagger';

export class ResponseDto<T> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Response data payload' })
  data: T;

  @ApiProperty({ description: 'Timestamp of the response' })
  timestamp: string;

  constructor(data: T, message = 'Success', success = true) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T, message?: string): ResponseDto<T> {
    return new ResponseDto(data, message, true);
  }

  static error<T>(message: string, data?: T): ResponseDto<T> {
    return new ResponseDto(data as T, message, false);
  }
}

