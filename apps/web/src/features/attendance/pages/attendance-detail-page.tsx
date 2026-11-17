import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { PageState } from '@/components/shared/page-state';
import { getAttendanceDetail, getAttendancePhoto } from '../api/attendance-api';
import { formatAttendanceTimestamp } from '../utils/format-attendance-timestamp';

export function AttendanceDetailPage() {
  const { attendanceId = '' } = useParams();
  const detail = useQuery({
    queryKey: ['attendance', 'detail', attendanceId],
    queryFn: () => getAttendanceDetail(attendanceId),
    enabled: Boolean(attendanceId),
  });
  const photo = useQuery({
    queryKey: ['attendance', 'photo', attendanceId],
    queryFn: () => getAttendancePhoto(attendanceId),
    enabled: Boolean(attendanceId) && detail.isSuccess,
  });
  const [photoUrl, setPhotoUrl] = useState<{ id: string; blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!photo.data) return;
    const url = URL.createObjectURL(photo.data);
    setPhotoUrl({ id: attendanceId, blob: photo.data, url });
    return () => URL.revokeObjectURL(url);
  }, [attendanceId, photo.data]);

  const currentPhoto =
    photoUrl?.id === attendanceId && photoUrl.blob === photo.data ? photoUrl.url : null;

  return (
    <section aria-labelledby="attendance-detail-title" className="max-w-3xl">
      <Link to="/hr/attendance" className="text-sm font-medium text-slate-700 underline">
        Back to attendance
      </Link>
      <h1 id="attendance-detail-title" className="mt-4 text-2xl font-semibold text-slate-950">
        Attendance detail
      </h1>
      {detail.isPending ? (
        <PageState kind="loading" title="Loading attendance detail" />
      ) : detail.isError ? (
        axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? (
          <PageState kind="error" title="Attendance record not found" />
        ) : (
          <PageState
            kind="error"
            title="Could not load attendance detail"
            onRetry={() => void detail.refetch()}
          />
        )
      ) : (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-600">Employee</dt>
              <dd className="font-medium text-slate-950">{detail.data.employee.name}</dd>
              <dd className="text-sm text-slate-600">{detail.data.employee.employeeNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Attendance date</dt>
              <dd className="text-slate-950">{detail.data.attendanceDate}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Submitted at (Asia/Jakarta)</dt>
              <dd className="text-slate-950">
                {formatAttendanceTimestamp(detail.data.submittedAt)}
              </dd>
            </div>
          </dl>
          <h2 className="mt-6 text-lg font-semibold text-slate-950">Attendance photo</h2>
          {photo.isError ? (
            <PageState
              kind="error"
              title="Could not load attendance photo"
              onRetry={() => void photo.refetch()}
            />
          ) : !currentPhoto ? (
            <PageState kind="loading" title="Loading attendance photo" />
          ) : (
            <img
              src={currentPhoto}
              alt={`Attendance photo for ${detail.data.employee.name}`}
              className="mt-4 h-auto max-w-full rounded-lg"
            />
          )}
        </div>
      )}
    </section>
  );
}
