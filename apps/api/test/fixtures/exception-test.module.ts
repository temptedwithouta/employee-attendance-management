import { BadRequestException, Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsEmail } from 'class-validator';

class ValidationRequest {
  @IsEmail()
  email!: string;
}

@Controller('test-errors')
class ExceptionTestController {
  @Post('validation')
  validate(@Body() body: ValidationRequest): ValidationRequest {
    return body;
  }

  @Get('bad-request')
  throwBadRequest(): never {
    throw new BadRequestException('Request was invalid');
  }

  @Get('unexpected')
  throwUnexpectedError(): never {
    throw new Error('private database detail');
  }
}

@Module({ controllers: [ExceptionTestController] })
export class ExceptionTestModule {}
