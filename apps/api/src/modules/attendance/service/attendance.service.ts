import { extname } from 'node:path';
import type { Attendance } from '../model/entity/attendance';
import {
  AttendanceNotFoundError,
  type AttendanceListQuery,
  type AttendanceRepository,
  type AttendanceWithEmployee,
} from '../repository/attendance.repository';
import { attendanceDateFor } from './attendance-date';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export class InvalidPhotoError extends Error {}
export class PhotoTooLargeError extends Error {}

export interface PhotoInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface PhotoStorage {
  save(data: Buffer, extension: 'png' | 'jpg'): Promise<string>;
  read(key: string): Promise<{ data: Buffer; contentType: string }>;
  remove(key: string): Promise<void>;
}

type PublicAttendance = Omit<Attendance, 'photoPath' | 'attendanceDate'> & {
  attendanceDate: string;
};
type AttendanceDetail = PublicAttendance & {
  employee: AttendanceWithEmployee['employee'];
  photoUrl: string;
};

function publicAttendance(record: Attendance): PublicAttendance {
  return {
    id: record.id,
    employeeId: record.employeeId,
    attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
    submittedAt: record.submittedAt,
  };
}

function detail(record: AttendanceWithEmployee): AttendanceDetail {
  return {
    ...publicAttendance(record),
    employee: record.employee,
    photoUrl: `/api/v1/attendance/${record.id}/photo`,
  };
}

function photoExtension(photo: PhotoInput | undefined, maxBytes: number): 'png' | 'jpg' {
  if (photo && Buffer.isBuffer(photo.buffer) && photo.buffer.length > maxBytes) {
    throw new PhotoTooLargeError('Photo exceeds the size limit');
  }
  if (!photo || !Buffer.isBuffer(photo.buffer) || photo.buffer.length === 0) {
    throw new InvalidPhotoError('A valid photo within the size limit is required');
  }
  const extension = extname(photo.originalname).toLowerCase();
  const png =
    photo.mimetype === 'image/png' &&
    extension === '.png' &&
    photo.buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg =
    photo.mimetype === 'image/jpeg' &&
    (extension === '.jpg' || extension === '.jpeg') &&
    photo.buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (png) return 'png';
  if (jpeg) return 'jpg';
  throw new InvalidPhotoError('Photo must be a JPEG or PNG with matching extension and signature');
}

export class AttendanceService {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly storage: PhotoStorage,
    private readonly maxPhotoBytes: number,
  ) {}

  async submit(employeeId: string, photo: PhotoInput | undefined): Promise<PublicAttendance> {
    const extension = photoExtension(photo, this.maxPhotoBytes);
    if (!photo) throw new InvalidPhotoError('A photo is required');
    const submittedAt = new Date();
    const attendanceDate = attendanceDateFor(submittedAt);
    const photoPath = await this.storage.save(photo.buffer, extension);
    try {
      return publicAttendance(
        await this.attendance.create({ employeeId, attendanceDate, submittedAt, photoPath }),
      );
    } catch (error) {
      try {
        await this.storage.remove(photoPath);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Failed to remove photo after attendance creation failed',
        );
      }
      throw error;
    }
  }

  async list(
    query: AttendanceListQuery,
  ): Promise<{ items: AttendanceDetail[]; total: number; page: number; limit: number }> {
    const result = await this.attendance.list(query);
    return {
      items: result.items.map(detail),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  async find(id: string): Promise<AttendanceDetail> {
    return detail(await this.findRecord(id));
  }

  async photo(id: string): Promise<{ data: Buffer; contentType: string }> {
    const record = await this.findRecord(id);
    return this.storage.read(record.photoPath);
  }

  private async findRecord(id: string): Promise<AttendanceWithEmployee> {
    const record = await this.attendance.findById(id);
    if (!record) throw new AttendanceNotFoundError('Attendance not found');
    return record;
  }
}
