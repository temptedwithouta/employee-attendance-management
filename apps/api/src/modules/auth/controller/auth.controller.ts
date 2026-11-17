import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import {
  AuthService,
  InvalidCredentialsError,
  type AuthenticatedUser,
} from '../service/auth.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../infrastructure/security/guard/jwt-auth.guard';
import { LoginDto } from '../model/dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Access token and authenticated user, without password hash.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(@Body() body: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    try {
      return await this.auth.login(body.email, body.password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current authenticated user, without password hash.' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, expired or inactive account token.' })
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }
}
