import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

const attendanceSubmissionSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  attendanceDate: z.string(),
  submittedAt: z.string(),
});

const attendanceListItemSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  attendanceDate: z.string(),
  submittedAt: z.string(),
  employee: z.object({
    id: z.string(),
    employeeNumber: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  photoUrl: z.string(),
});

const attendanceListResponseSchema = z.object({
  items: z.array(attendanceListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type AttendanceSubmission = z.infer<typeof attendanceSubmissionSchema>;
export type AttendanceListItem = z.infer<typeof attendanceListItemSchema>;
export type AttendanceListParams = {
  page: number;
  limit: number;
  date?: string;
  employeeId?: string;
};

export async function submitAttendance(photo: File): Promise<AttendanceSubmission> {
  const formData = new FormData();
  formData.append('photo', photo);

  const response = await apiClient.post<unknown>('/attendance', formData);
  return attendanceSubmissionSchema.parse(response.data);
}

export async function listAttendance(
  params: AttendanceListParams,
): Promise<{
  items: AttendanceListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const { page, limit, date, employeeId } = params;
  const response = await apiClient.get<unknown>('/attendance', {
    params: {
      page,
      limit,
      ...(date !== undefined && { date }),
      ...(employeeId !== undefined && { employeeId }),
    },
  });
  return attendanceListResponseSchema.parse(response.data);
}

export async function getAttendanceDetail(id: string): Promise<AttendanceListItem> {
  const response = await apiClient.get<unknown>(`/attendance/${id}`);
  return attendanceListItemSchema.parse(response.data);
}

export async function getAttendancePhoto(id: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/attendance/${id}/photo`, {
    responseType: 'blob',
  });
  return response.data;
}
