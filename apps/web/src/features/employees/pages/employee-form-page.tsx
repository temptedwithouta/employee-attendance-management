import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageState } from '@/components/shared/page-state';
import {
  createEmployee, getEmployee, updateEmployee,
  type EmployeeCreateInput, type EmployeeUpdateInput,
} from '../api/employees-api';
import { EmployeeForm } from '../components/employee-form';

export function EmployeeFormPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const employeeQuery = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => getEmployee(employeeId!),
    enabled: Boolean(employeeId),
  });
  const mutation = useMutation({
    mutationFn: (values: EmployeeCreateInput | EmployeeUpdateInput) =>
      employeeId
        ? updateEmployee(employeeId, values)
        : createEmployee(values as EmployeeCreateInput),
  });

  const submit = async (values: EmployeeCreateInput | EmployeeUpdateInput) => {
    setServerError(null);
    try {
      const saved = await mutation.mutateAsync(values);
      if (employeeId) queryClient.setQueryData(['employee', employeeId], saved);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      void navigate('/hr/employees');
    } catch (error) {
      setServerError(axios.isAxiosError(error) && error.response?.status === 409
        ? 'Employee number or email already exists.'
        : 'Could not save employee. Please try again.');
    }
  };

  if (employeeId && employeeQuery.isPending) {
    return <PageState kind="loading" title="Loading employee" />;
  }
  if (employeeId && employeeQuery.isError) {
    if (axios.isAxiosError(employeeQuery.error) && employeeQuery.error.response?.status === 404) {
      return <PageState kind="empty" title="Employee not found" description="This employee may no longer exist." />;
    }
    return <PageState kind="error" title="Could not load employee" description="Please try again." onRetry={() => void employeeQuery.refetch()} />;
  }

  return (
    <section aria-labelledby="employee-form-title" className="max-w-xl">
      <h1 id="employee-form-title" className="text-2xl font-semibold text-slate-950">
        {employeeId ? 'Edit employee' : 'Create employee'}
      </h1>
      {employeeId && employeeQuery.data ? (
        <EmployeeForm key={employeeId} mode="edit" initialEmployee={employeeQuery.data} onSubmit={submit} isPending={mutation.isPending} serverError={serverError} />
      ) : !employeeId ? (
        <EmployeeForm mode="create" onSubmit={submit} isPending={mutation.isPending} serverError={serverError} />
      ) : null}
    </section>
  );
}
