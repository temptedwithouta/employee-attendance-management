import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageState } from '@/components/shared/page-state';
import { Button } from '@/components/ui/button';
import { listAttendance } from '../api/attendance-api';
import { formatAttendanceTimestamp } from '../utils/format-attendance-timestamp';

const pageSize = 25;

export function HrAttendancePage() {
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'list', page, pageSize, date, employeeId],
    queryFn: () =>
      listAttendance({
        page,
        limit: pageSize,
        ...(date ? { date } : {}),
        ...(employeeId ? { employeeId } : {}),
      }),
  });

  const result = attendanceQuery.data;
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));
  const currentPage = result?.page ?? page;

  return (
    <section aria-labelledby="attendance-title">
      <h1 id="attendance-title" className="text-2xl font-semibold text-slate-950">
        Attendance monitoring
      </h1>
      <p className="mt-2 text-sm text-slate-600">Review submitted employee attendance.</p>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="attendance-date" className="block text-sm font-medium text-slate-800">
            Attendance date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.currentTarget.value);
              setPage(1);
            }}
            className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="attendance-employee-id"
            className="block text-sm font-medium text-slate-800"
          >
            Employee ID
          </label>
          <input
            id="attendance-employee-id"
            type="text"
            value={employeeId}
            onChange={(event) => {
              setEmployeeId(event.currentTarget.value);
              setPage(1);
            }}
            className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          />
        </div>
      </div>

      {attendanceQuery.isPending || attendanceQuery.isFetching ? (
        <PageState kind="loading" title="Loading attendance" />
      ) : attendanceQuery.isError ? (
        <PageState
          kind="error"
          title="Could not load attendance"
          description="Check your filters or try again."
          onRetry={() => void attendanceQuery.refetch()}
        />
      ) : result && result.items.length === 0 ? (
        <PageState
          kind="empty"
          title="No attendance records"
          description="Try changing the date or employee ID filter."
        />
      ) : result ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Attendance records</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Employee
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Employee number
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Attendance date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Submitted at
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((attendance) => (
                  <tr key={attendance.id} className="text-slate-800">
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">
                      <Link
                        to={`/hr/attendance/${attendance.id}`}
                        className="underline hover:text-slate-600"
                      >
                        {attendance.employee.name}
                      </Link>
                    </th>
                    <td className="whitespace-nowrap px-4 py-3">
                      {attendance.employee.employeeNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{attendance.attendanceDate}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatAttendanceTimestamp(attendance.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="Attendance pagination"
            className="mt-4 flex items-center justify-between gap-4"
          >
            <Button
              type="button"
              variant="outline"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span aria-live="polite" className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
