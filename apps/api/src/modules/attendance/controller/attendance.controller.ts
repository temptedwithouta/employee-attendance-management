import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../auth/infrastructure/security/guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/infrastructure/security/guard/roles.guard';
import {
  AttendanceService,
  InvalidPhotoError,
  MAX_PHOTO_BYTES,
  PhotoTooLargeError,
  type PhotoInput,
} from '../service/attendance.service';
import {
  AttendanceConflictError,
  AttendanceNotFoundError,
} from '../repository/attendance.repository';
import { ListAttendanceDto } from '../model/dto/attendance.dto';

async function mapAttendanceErrors<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof InvalidPhotoError) throw new BadRequestException(error.message);
    if (error instanceof PhotoTooLargeError) throw new PayloadTooLargeException(error.message);
    if (error instanceof AttendanceConflictError) throw new ConflictException(error.message);
    if (error instanceof AttendanceNotFoundError) throw new NotFoundException(error.message);
    throw error;
  }
}

@ApiTags('attendance')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Missing or invalid bearer token' })
@ApiResponse({ status: 403, description: 'Role not permitted' })
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post()
  @Roles('EMPLOYEE')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Attendance recorded' })
  @ApiResponse({ status: 400, description: 'Invalid photo or form fields' })
  @ApiResponse({ status: 409, description: 'Attendance already submitted for this day' })
  @ApiResponse({ status: 413, description: 'Photo exceeds the size limit' })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES + 1, files: 1, fields: 0 } }),
  )
  submit(@Req() request: AuthenticatedRequest, @UploadedFile() photo?: PhotoInput) {
    if (!request.user.employeeId) throw new UnauthorizedException();
    return mapAttendanceErrors(this.attendance.submit(request.user.employeeId, photo));
  }

  @Get()
  @Roles('HR')
  @ApiResponse({ status: 200, description: 'Paginated attendance records' })
  @ApiResponse({ status: 400, description: 'Invalid filter or pagination' })
  list(@Query() query: ListAttendanceDto) {
    return this.attendance.list({
      page: query.page,
      limit: query.limit,
      employeeId: query.employeeId,
      date: query.date ? new Date(`${query.date}T00:00:00.000Z`) : undefined,
    });
  }

  @Get(':id')
  @Roles('HR')
  @ApiResponse({ status: 200, description: 'Attendance detail' })
  @ApiResponse({ status: 400, description: 'Invalid ID' })
  @ApiResponse({ status: 404, description: 'Attendance not found' })
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return mapAttendanceErrors(this.attendance.find(id));
  }

  @Get(':id/photo')
  @Roles('HR')
  @ApiResponse({ status: 200, description: 'Private JPEG or PNG photo' })
  @ApiResponse({ status: 400, description: 'Invalid ID' })
  @ApiResponse({ status: 404, description: 'Attendance not found' })
  async photo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const photo = await mapAttendanceErrors(this.attendance.photo(id));
    response.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(photo.data);
  }
}
