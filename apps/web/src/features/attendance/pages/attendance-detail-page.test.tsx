import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { Link, matchRoutes, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '@/app/router';
import { RequireRole } from '@/app/protected-route';
import {
  getAttendanceDetail,
  getAttendancePhoto,
  listAttendance,
  type AttendanceListItem,
} from '../api/attendance-api';
import { AttendanceDetailPage } from './attendance-detail-page';
import { HrAttendancePage } from './hr-attendance-page';

vi.mock('../api/attendance-api', () => ({
  getAttendanceDetail: vi.fn(),
  getAttendancePhoto: vi.fn(),
  listAttendance: vi.fn(),
}));

const record: AttendanceListItem = {
  id: 'attendance-1',
  employeeId: 'employee-1',
  attendanceDate: '2026-11-15',
  submittedAt: '2026-11-15T18:30:00.000Z',
  employee: {
    id: 'employee-1',
    employeeNumber: 'EMP-001',
    name: 'Ayu Pratama',
    email: 'ayu@example.test',
  },
  photoUrl: '/uploads/private.jpg',
};

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hr/attendance/attendance-1']}>
        <Link to="/hr/attendance/attendance-2">Other record</Link>
        <Routes>
          <Route path="/hr/attendance/:attendanceId" element={<AttendanceDetailPage />} />
          <Route path="/hr/attendance" element={<p>Attendance list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function notFound() {
  const error = new AxiosError('Not found');
  error.response = {
    status: 404,
    statusText: 'Not Found',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: {},
  };
  return error;
}

describe('AttendanceDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn().mockReturnValue('blob:attendance-photo');
        static revokeObjectURL = vi.fn();
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows attendance details and protected photo', async () => {
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    vi.mocked(getAttendanceDetail).mockResolvedValue(record);
    vi.mocked(getAttendancePhoto).mockResolvedValue(blob);
    renderDetail();

    expect(await screen.findByText('Ayu Pratama')).toBeInTheDocument();
    expect(screen.getByText('EMP-001')).toBeInTheDocument();
    expect(screen.getByText('2026-11-15')).toBeInTheDocument();
    expect(screen.getByText(/16 Nov 2026, 01:30/)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /ayu pratama/i })).toHaveAttribute(
      'src',
      'blob:attendance-photo',
    );
    expect(getAttendanceDetail).toHaveBeenCalledWith('attendance-1');
    expect(getAttendancePhoto).toHaveBeenCalledWith('attendance-1');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(screen.getByRole('link', { name: /back to attendance/i })).toHaveAttribute(
      'href',
      '/hr/attendance',
    );
  });

  it('shows detail and photo errors', async () => {
    vi.mocked(getAttendanceDetail).mockRejectedValueOnce(notFound()).mockResolvedValueOnce(record);
    vi.mocked(getAttendancePhoto).mockRejectedValueOnce(new Error('Photo unavailable'));
    const { unmount } = renderDetail();

    expect(await screen.findByText(/attendance.*not found/i)).toBeInTheDocument();
    expect(getAttendancePhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    unmount();

    renderDetail();
    expect(await screen.findByText('Ayu Pratama')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/photo/i);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('revokes the photo URL on unmount', async () => {
    vi.mocked(getAttendanceDetail).mockResolvedValue(record);
    vi.mocked(getAttendancePhoto).mockResolvedValue(new Blob(['photo']));
    const { unmount } = renderDetail();
    await screen.findByRole('img');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attendance-photo');
  });

  it('revokes the previous photo when navigating to another detail', async () => {
    vi.mocked(getAttendanceDetail).mockImplementation(async (id) => ({ ...record, id }));
    vi.mocked(getAttendancePhoto).mockImplementation(async (id) => new Blob([id]));
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-photo')
      .mockReturnValueOnce('blob:second-photo');
    renderDetail();
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:first-photo');

    fireEvent.click(screen.getByRole('link', { name: 'Other record' }));

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-photo'));
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:second-photo'),
    );
    expect(getAttendancePhoto).toHaveBeenCalledWith('attendance-2');
  });

  it('links each list record to its detail', async () => {
    vi.mocked(listAttendance).mockResolvedValue({ items: [record], page: 1, limit: 25, total: 1 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HrAttendancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('link', { name: /ayu pratama/i })).toHaveAttribute(
      'href',
      '/hr/attendance/attendance-1',
    );
  });

  it('registers the detail route under the HR role guard', () => {
    const matches = matchRoutes(router.routes, '/hr/attendance/attendance-1');
    expect(matches?.at(-1)?.route.element).toMatchObject({ type: AttendanceDetailPage });
    expect(
      matches?.some((match) => {
        const element = match.route.element;
        return (
          element &&
          typeof element === 'object' &&
          'type' in element &&
          element.type === RequireRole &&
          'props' in element &&
          (element.props as { role?: string }).role === 'HR'
        );
      }),
    ).toBe(true);
  });
});
