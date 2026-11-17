import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/shared/page-state';
import {
  deactivateEmployee,
  listEmployees,
  type EmployeeStatus,
} from '../api/employees-api';

const employeeListQueryKey = 'employees';
const pageSize = 25;

export function EmployeeManagementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('');
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({
    queryKey: [employeeListQueryKey, page, pageSize, search, status],
    queryFn: () =>
      listEmployees({
        page,
        limit: pageSize,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
  });
  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [employeeListQueryKey] }),
  });

  const result = employeesQuery.data;
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));

  return (
    <section aria-labelledby="employees-title">
      <h1 id="employees-title" className="text-2xl font-semibold text-slate-950">
        Employees
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Search and review employee records.
      </p>
      <a href="/hr/employees/new" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
        Create employee
      </a>

      {deactivateMutation.isError && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not deactivate employee. Please try again.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="employee-search" className="block text-sm font-medium text-slate-800">
            Search employees
          </label>
          <input
            id="employee-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor="employee-status" className="block text-sm font-medium text-slate-800">
            Status
          </label>
          <select
            id="employee-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as EmployeeStatus | '');
              setPage(1);
            }}
            className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {employeesQuery.isPending && (
        <PageState kind="loading" title="Loading employees" />
      )}
      {employeesQuery.isError && !result && (
        <PageState
          kind="error"
          title="Could not load employees"
          description="Please try again."
          onRetry={() => void employeesQuery.refetch()}
        />
      )}
      {employeesQuery.isError && result && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p role="alert" className="text-sm text-red-900">
            Could not refresh employees. The displayed results may be out of date.
          </p>
          <Button type="button" variant="outline" onClick={() => void employeesQuery.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {result && result.items.length === 0 && (
        <PageState
          kind="empty"
          title="No employees found"
          description="Try changing your search or status filter."
        />
      )}
      {result && result.items.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Employee number</th>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Department</th>
                  <th scope="col" className="px-4 py-3 font-medium">Position</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((employee) => (
                  <tr key={employee.id} className="text-slate-800">
                    <td className="whitespace-nowrap px-4 py-3">{employee.employeeNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{employee.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{employee.email}</td>
                    <td className="whitespace-nowrap px-4 py-3">{employee.department}</td>
                    <td className="whitespace-nowrap px-4 py-3">{employee.position}</td>
                    <td className="whitespace-nowrap px-4 py-3">{employee.status}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <a href={`/hr/employees/${encodeURIComponent(employee.id)}/edit`} aria-label={`Edit ${employee.name}`} className="rounded text-slate-900 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Edit</a>
                        {employee.status === 'ACTIVE' && (
                          <Button
                            type="button"
                            variant="outline"
                            aria-label={`Deactivate ${employee.name}`}
                            disabled={deactivateMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Deactivate ${employee.name}? They will lose account access, but their attendance history will be preserved.`,
                                )
                              ) {
                                deactivateMutation.mutate(employee.id);
                              }
                            }}
                            className="text-red-700 hover:bg-red-50"
                          >
                            {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="Employee pagination"
            className="mt-4 flex items-center justify-between gap-4"
          >
            <Button
              type="button"
              variant="outline"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span aria-live="polite" className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
