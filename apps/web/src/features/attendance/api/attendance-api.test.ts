import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/lib/api-client';
import {
  getAttendanceDetail,
  getAttendancePhoto,
  listAttendance,
  submitAttendance,
} from './attendance-api';

const attendanceResponse = {
  id: 'attendance-id',
  employeeId: 'employee-id',
  attendanceDate: '2026-11-15',
  submittedAt: '2026-11-15T10:00:00.000Z',
};

const attendanceListResponse = {
  items: [
    {
      id: 'attendance-id',
      employeeId: 'employee-id',
      attendanceDate: '2026-11-15',
      submittedAt: '2026-11-15T10:00:00.000Z',
      employee: {
        id: 'employee-id',
        employeeNumber: 'EMP-001',
        name: 'Ayu Pratiwi',
        email: 'ayu@example.com',
      },
      photoUrl: '/attendance/attendance-id/photo',
    },
  ],
  total: 31,
  page: 2,
  limit: 25,
};

let originalAdapter = apiClient.defaults.adapter;
let requestConfig: InternalAxiosRequestConfig | undefined;

function respondWith(data: unknown, status = 201) {
  apiClient.defaults.adapter = async (config) => {
    requestConfig = config;
    return {
      data,
      status,
      statusText: status === 201 ? 'Created' : 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  };
}

describe('attendance API', () => {
  beforeEach(() => {
    requestConfig = undefined;
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    sessionStorage.removeItem('dexa.accessToken');
  });

  it('posts only the photo field as multipart and parses the server response', async () => {
    respondWith(attendanceResponse);
    const photo = new File(['photo contents'], 'proof.jpg', { type: 'image/jpeg' });

    await expect(submitAttendance(photo)).resolves.toEqual(attendanceResponse);
    expect(requestConfig?.url).toBe('/attendance');
    expect(requestConfig?.method).toBe('post');
    expect(requestConfig?.data).toBeInstanceOf(FormData);

    const formData = requestConfig?.data as FormData;
    const fieldNames: string[] = [];
    formData.forEach((_, name) => fieldNames.push(name));
    expect(fieldNames).toEqual(['photo']);
    expect(formData.get('photo')).toBe(photo);
  });

  it('rejects a malformed server response', async () => {
    respondWith({ ...attendanceResponse, employeeId: 42 });

    await expect(submitAttendance(new File(['proof'], 'proof.png'))).rejects.toThrow();
  });

  it.each(['not-a-date', '2026-02-30T10:00:00Z', '2026-11-15'])(
    'preserves a non-ISO submission timestamp string: %s',
    async (submittedAt) => {
      const data = { ...attendanceResponse, submittedAt };
      respondWith(data);

      await expect(submitAttendance(new File(['proof'], 'proof.png'))).resolves.toEqual(data);
    },
  );

  it('rejects a non-string submission timestamp', async () => {
    respondWith({ ...attendanceResponse, submittedAt: 123 });

    await expect(submitAttendance(new File(['proof'], 'proof.png'))).rejects.toThrow();
  });

  it('accepts a submission timestamp with a timezone offset', async () => {
    const data = { ...attendanceResponse, submittedAt: '2026-11-15T17:00:00+07:00' };
    respondWith(data);

    await expect(submitAttendance(new File(['proof'], 'proof.png'))).resolves.toEqual(data);
  });

  it('parses the attendance list response', async () => {
    respondWith(attendanceListResponse, 200);

    await expect(listAttendance({ page: 2, limit: 25 })).resolves.toEqual(attendanceListResponse);
    expect(requestConfig?.url).toBe('/attendance');
    expect(requestConfig?.method).toBe('get');
    expect(requestConfig?.params).toEqual({ page: 2, limit: 25 });
  });

  it('serializes pagination, date, and employee ID filters', async () => {
    respondWith(attendanceListResponse, 200);

    await listAttendance({
      page: 3,
      limit: 10,
      date: '2026-11-15',
      employeeId: 'employee-id',
    });

    expect(requestConfig?.method).toBe('get');
    expect(requestConfig?.url).toBe('/attendance');
    expect(apiClient.getUri(requestConfig)).toBe(
      '/attendance?page=3&limit=10&date=2026-11-15&employeeId=employee-id',
    );
  });

  it('rejects a malformed attendance list response', async () => {
    respondWith(
      {
        ...attendanceListResponse,
        items: [{ ...attendanceListResponse.items[0], employee: { ...attendanceListResponse.items[0].employee, email: 42 } }],
      },
      200,
    );

    await expect(listAttendance({ page: 1, limit: 25 })).rejects.toThrow();
  });

  it('parses an attendance detail response', async () => {
    const detail = attendanceListResponse.items[0];
    respondWith(detail, 200);

    await expect(getAttendanceDetail('attendance-id')).resolves.toEqual(detail);
    expect(requestConfig?.url).toBe('/attendance/attendance-id');
    expect(requestConfig?.method).toBe('get');
  });

  it('rejects a malformed attendance detail response', async () => {
    const detail = attendanceListResponse.items[0];
    respondWith({ ...detail, employee: { ...detail.employee, email: 42 } }, 200);

    await expect(getAttendanceDetail('attendance-id')).rejects.toThrow();
  });

  it('fetches the protected photo as a Blob with the stored bearer token', async () => {
    sessionStorage.setItem('dexa.accessToken', 'session-token');
    const photo = new Blob(['photo contents'], { type: 'image/jpeg' });
    respondWith(photo, 200);

    await expect(getAttendancePhoto('attendance-id')).resolves.toBe(photo);
    expect(requestConfig?.url).toBe('/attendance/attendance-id/photo');
    expect(requestConfig?.method).toBe('get');
    expect(requestConfig?.responseType).toBe('blob');
    expect(requestConfig?.headers.get('Authorization')).toBe('Bearer session-token');
  });
});
