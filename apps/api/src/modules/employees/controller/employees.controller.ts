import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/security/guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/infrastructure/security/guard/roles.guard';
import { EmployeesService } from '../service/employees.service';
import type { Employee } from '../model/entity/employee';
import {
  EmployeeConflictError,
  EmployeeNotFoundError,
  type EmployeePage,
} from '../repository/employee.repository';
import { CreateEmployeeDto, ListEmployeesDto, UpdateEmployeeDto } from '../model/dto/employee.dto';

async function mapEmployeeErrors<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof EmployeeConflictError) throw new ConflictException(error.message);
    if (error instanceof EmployeeNotFoundError) throw new NotFoundException(error.message);
    throw error;
  }
}

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: ListEmployeesDto): Promise<EmployeePage> {
    return this.employees.list(query);
  }

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string): Promise<Employee> {
    return mapEmployeeErrors(this.employees.findById(id));
  }

  @Post()
  create(@Body() body: CreateEmployeeDto): Promise<Employee> {
    const { initialPassword, ...fields } = body;
    return mapEmployeeErrors(this.employees.create(fields, initialPassword));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateEmployeeDto,
  ): Promise<Employee> {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    return mapEmployeeErrors(this.employees.update(id, body));
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<Employee> {
    return mapEmployeeErrors(this.employees.deactivate(id));
  }
}
