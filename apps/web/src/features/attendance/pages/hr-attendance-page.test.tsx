import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAttendance, type AttendanceListItem } from '../api/attendance-api';
import { HrAttendancePage } from './hr-attendance-page';

vi.mock('../api/attendance-api', () => ({
  listAttendance: vi.fn(),
}));

const row: AttendanceListItem = {
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
  photoUrl: '/uploads/attendance-1.jpg',
};

function response(items: AttendanceListItem[] = [row], total = items.length, page = 1, limit = 25) {
  return { items, total, page, limit };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HrAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function httpError(status: number): AxiosError {
  const error = new AxiosError(`HTTP ${status}`);
  error.response = {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: {},
  };
  return error;
}

describe('HrAttendancePage', () => {
  beforeEach(() => {
    vi.mocked(listAttendance).mockReset();
  });

  afterEach(cleanup);

  it('shows loading then attendance rows', async () => {
    let resolveRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    vi.mocked(listAttendance).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(/loading attendance/i);
    resolveRequest?.(response());

    expect(await screen.findByRole('table', { name: /attendance records/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /ayu pratama/i })).toBeInTheDocument();
    expect(screen.getByText('EMP-001')).toBeInTheDocument();
  });

  it('shows a retryable error', async () => {
    vi.mocked(listAttendance)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(response());

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load attendance/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('table', { name: /attendance records/i })).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.mocked(listAttendance).mockResolvedValueOnce(response([], 0));

    renderPage();

    expect(await screen.findByText(/no attendance records/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('filters by date and employee ID', async () => {
    vi.mocked(listAttendance).mockResolvedValue(response());

    renderPage();

    await screen.findByRole('table', { name: /attendance records/i });
    fireEvent.change(screen.getByLabelText('Attendance date'), {
      target: { value: '2026-11-15' },
    });
    fireEvent.change(screen.getByLabelText('Employee ID'), {
      target: { value: ' employee-id ' },
    });

    await waitFor(() => {
      expect(listAttendance).toHaveBeenLastCalledWith({
        page: 1,
        limit: 25,
        date: '2026-11-15',
        employeeId: ' employee-id ',
      });
    });
  });

  it('changes pages and resets page when filters change', async () => {
    vi.mocked(listAttendance).mockImplementation(async ({ page, limit }) =>
      response([row], 26, page, limit),
    );

    renderPage();

    await screen.findByRole('table', { name: /attendance records/i });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(listAttendance).toHaveBeenLastCalledWith({ page: 2, limit: 25 });
    });

    fireEvent.change(screen.getByLabelText('Attendance date'), {
      target: { value: '2026-11-15' },
    });
    await waitFor(() => {
      expect(listAttendance).toHaveBeenLastCalledWith({
        page: 1,
        limit: 25,
        date: '2026-11-15',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(listAttendance).toHaveBeenLastCalledWith({
        page: 2,
        limit: 25,
        date: '2026-11-15',
      });
    });

    fireEvent.change(screen.getByLabelText('Employee ID'), {
      target: { value: 'employee-id' },
    });
    await waitFor(() => {
      expect(listAttendance).toHaveBeenLastCalledWith({
        page: 1,
        limit: 25,
        date: '2026-11-15',
        employeeId: 'employee-id',
      });
    });
  });

  it('formats server timestamps in Jakarta time', async () => {
    vi.mocked(listAttendance).mockResolvedValueOnce(response());

    renderPage();

    expect(await screen.findByText(/16 Nov 2026, 01:30/)).toBeInTheDocument();
  });

  it('keeps an invalid date error visible and allows correcting the date', async () => {
    vi.mocked(listAttendance)
      .mockResolvedValueOnce(response([], 0))
      .mockRejectedValueOnce(httpError(400))
      .mockResolvedValueOnce(response());

    renderPage();
    await screen.findByText(/no attendance records/i);
    const dateInput = screen.getByLabelText('Attendance date');
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load attendance/i);
    expect(dateInput).toHaveValue('2026-11-15');

    fireEvent.change(dateInput, { target: { value: '2026-11-16' } });

    expect(await screen.findByRole('table', { name: /attendance records/i })).toBeInTheDocument();
    expect(listAttendance).toHaveBeenLastCalledWith({
      page: 1,
      limit: 25,
      date: '2026-11-16',
    });
  });

  it('keeps an invalid employee ID error visible and allows correcting the ID', async () => {
    vi.mocked(listAttendance)
      .mockResolvedValueOnce(response([], 0))
      .mockRejectedValueOnce(httpError(400))
      .mockResolvedValueOnce(response());

    renderPage();
    await screen.findByText(/no attendance records/i);
    const employeeInput = screen.getByLabelText('Employee ID');
    fireEvent.change(employeeInput, { target: { value: 'invalid-uuid' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load attendance/i);
    expect(employeeInput).toHaveValue('invalid-uuid');

    fireEvent.change(employeeInput, { target: { value: 'corrected-employee-id' } });

    expect(await screen.findByRole('table', { name: /attendance records/i })).toBeInTheDocument();
    expect(listAttendance).toHaveBeenLastCalledWith({
      page: 1,
      limit: 25,
      employeeId: 'corrected-employee-id',
    });
  });
});
