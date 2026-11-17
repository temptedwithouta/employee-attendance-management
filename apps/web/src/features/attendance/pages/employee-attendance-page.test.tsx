import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { EmployeeAttendancePage } from './employee-attendance-page';

const response = {
  id: 'attendance-id',
  employeeId: 'employee-id',
  attendanceDate: '2026-11-16',
  submittedAt: '2026-11-15T18:30:00.000Z',
};

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
let originalAdapter = apiClient.defaults.adapter;

function choosePhoto(file: File) {
  fireEvent.change(screen.getByLabelText('Photo proof'), { target: { files: [file] } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Submit attendance' }));
}

function successAdapter() {
  apiClient.defaults.adapter = async (config) => ({
    data: response,
    status: 201,
    statusText: 'Created',
    headers: new AxiosHeaders(),
    config,
  });
}

describe('EmployeeAttendancePage', () => {
  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
    createObjectURL.mockReset().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    revokeObjectURL.mockReset();
    const NativeURL = URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
  });

  afterEach(() => {
    cleanup();
    apiClient.defaults.adapter = originalAdapter;
    vi.unstubAllGlobals();
  });

  it('previews and submits a valid photo', async () => {
    let submittedData: FormData | undefined;
    apiClient.defaults.adapter = async (config) => {
      submittedData = config.data as FormData;
      return { data: response, status: 201, statusText: 'Created', headers: new AxiosHeaders(), config };
    };
    render(<EmployeeAttendancePage />);
    const file = new File(['image'], 'proof.jpg', { type: 'image/jpeg' });
    choosePhoto(file);
    expect(await screen.findByAltText('Photo proof preview')).toHaveAttribute('src', 'blob:first');
    submit();
    await screen.findByText(/attendance submitted/i);
    expect(submittedData?.get('photo')).toBe(file);
    const fieldNames: string[] = [];
    submittedData?.forEach((_, name) => fieldNames.push(name));
    expect(fieldNames).toEqual(['photo']);
  });

  it('rejects unsupported and oversized photos', async () => {
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests++;
      return { data: response, status: 201, statusText: 'Created', headers: new AxiosHeaders(), config };
    };
    render(<EmployeeAttendancePage />);
    for (const [file, message] of [
      [new File(['a'], 'proof.gif', { type: 'image/gif' }), /select a jpeg or png/i],
      [new File(['a'], 'proof.jpg', { type: 'image/png' }), /select a jpeg or png/i],
      [new File(['a'], 'proof.png', { type: 'image/jpeg' }), /select a jpeg or png/i],
      [new File(['a'], 'proof.jpg', { type: '' }), /select a jpeg or png/i],
      [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'proof.png', { type: 'image/png' }), /must not exceed 5 mib/i],
    ] as const) {
      choosePhoto(file);
      submit();
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByAltText('Photo proof preview')).not.toBeInTheDocument();
      expect(requests).toBe(0);
    }
  });

  it('accepts a PNG at the 5 MiB boundary', async () => {
    successAdapter();
    render(<EmployeeAttendancePage />);
    choosePhoto(new File([new Uint8Array(5 * 1024 * 1024)], 'proof.PNG', { type: 'image/png' }));
    submit();
    expect(await screen.findByText(/attendance submitted/i)).toBeInTheDocument();
  });

  it('disables submit while pending', async () => {
    let release: (() => void) | undefined;
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests++;
      await new Promise<void>((resolve) => { release = resolve; });
      return { data: response, status: 201, statusText: 'Created', headers: new AxiosHeaders(), config };
    };
    render(<EmployeeAttendancePage />);
    choosePhoto(new File(['image'], 'proof.jpeg', { type: 'image/jpeg' }));
    submit();
    const button = await screen.findByRole('button', { name: /submitting/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(requests).toBe(1));
    release?.();
    await screen.findByText(/attendance submitted/i);
  });

  it('shows the server timestamp after success', async () => {
    successAdapter();
    render(<EmployeeAttendancePage />);
    choosePhoto(new File(['image'], 'proof.png', { type: 'image/png' }));
    submit();
    expect(await screen.findByText(/16 Nov 2026.*01:30/)).toBeInTheDocument();
  });

  it('shows success with an unavailable timestamp when the server timestamp is malformed', async () => {
    apiClient.defaults.adapter = async (config) => ({
      data: { ...response, submittedAt: 'not-a-date' },
      status: 201,
      statusText: 'Created',
      headers: new AxiosHeaders(),
      config,
    });
    render(<EmployeeAttendancePage />);
    choosePhoto(new File(['image'], 'proof.png', { type: 'image/png' }));
    submit();

    expect(await screen.findByRole('status')).toHaveTextContent(/attendance submitted/i);
    expect(screen.getByRole('status')).toHaveTextContent('Timestamp unavailable');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows success with an unavailable timestamp when the server timestamp has an impossible date', async () => {
    apiClient.defaults.adapter = async (config) => ({
      data: { ...response, submittedAt: '2026-02-30T10:00:00Z' },
      status: 201,
      statusText: 'Created',
      headers: new AxiosHeaders(),
      config,
    });
    render(<EmployeeAttendancePage />);
    choosePhoto(new File(['image'], 'proof.png', { type: 'image/png' }));
    submit();

    expect(await screen.findByRole('status')).toHaveTextContent(/attendance submitted/i);
    expect(screen.getByRole('status')).toHaveTextContent('Timestamp unavailable');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [409, /already (?:been )?submitted/i],
    [413, /too large/i],
    [400, /could not submit/i],
  ])('shows duplicate-day errors and upload errors (%s)', async (status, message) => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('Request failed', undefined, config, undefined, {
        data: { message: 'server detail' }, status, statusText: 'Error', headers: new AxiosHeaders(), config,
      });
    };
    render(<EmployeeAttendancePage />);
    choosePhoto(new File(['image'], 'proof.jpg', { type: 'image/jpeg' }));
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/attendance submitted/i)).not.toBeInTheDocument();
  });

  it('revokes preview URLs on replacement and unmount', async () => {
    const { unmount } = render(<EmployeeAttendancePage />);
    choosePhoto(new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByAltText('Photo proof preview')).toHaveAttribute('src', 'blob:first');
    choosePhoto(new File(['second'], 'second.png', { type: 'image/png' }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:first'));
    expect(screen.getByAltText('Photo proof preview')).toHaveAttribute('src', 'blob:second');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second');
  });

  it('requires a photo before submitting', async () => {
    render(<EmployeeAttendancePage />);
    submit();
    expect(await screen.findByText(/select a jpeg or png/i)).toBeInTheDocument();
  });
});
