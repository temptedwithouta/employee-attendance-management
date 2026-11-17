import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import type { Employee, EmployeeCreateInput, EmployeeUpdateInput } from '../api/employees-api';
import { employeeCreateSchema, employeeEditSchema } from '../schemas/employee-form-schema';

type EmployeeFormProps = {
  isPending: boolean;
  serverError?: string | null;
} & (
  | { mode: 'create'; onSubmit: (values: EmployeeCreateInput) => Promise<void> }
  | { mode: 'edit'; initialEmployee: Employee; onSubmit: (values: EmployeeUpdateInput) => Promise<void> }
);

type FormValues = EmployeeUpdateInput & { initialPassword?: string };

const fields = [
  { name: 'employeeNumber', label: 'Employee number', type: 'text' },
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'position', label: 'Position', type: 'text' },
] as const;

export function EmployeeForm(props: EmployeeFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(props.mode === 'create' ? employeeCreateSchema : employeeEditSchema),
    defaultValues: props.mode === 'edit' ? {
      employeeNumber: props.initialEmployee.employeeNumber,
      name: props.initialEmployee.name,
      email: props.initialEmployee.email,
      department: props.initialEmployee.department,
      position: props.initialEmployee.position,
    } : {
      employeeNumber: '', name: '', email: '', department: '', position: '', initialPassword: '',
    },
  });
  const pending = props.isPending || isSubmitting;

  const submit = async (values: FormValues) => {
    const { employeeNumber, name, email, department, position } = values;
    const editable = { employeeNumber, name, email, department, position };
    if (props.mode === 'create') {
      await props.onSubmit({ ...editable, initialPassword: values.initialPassword ?? '' });
    } else {
      await props.onSubmit(editable);
    }
  };

  return (
    <form className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate onSubmit={handleSubmit(submit)}>
      <fieldset disabled={pending} className="space-y-5">
        {fields.map(({ name, label, type }) => (
          <div key={name}>
            <label htmlFor={name} className="block text-sm font-medium text-slate-800">{label}</label>
            <input
              {...register(name)}
              id={name}
              type={type}
              required
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-70"
            />
            {errors[name] && <p id={`${name}-error`} className="mt-2 text-sm text-red-700">{errors[name]?.message}</p>}
          </div>
        ))}
        {props.mode === 'create' && (
          <div>
            <label htmlFor="initialPassword" className="block text-sm font-medium text-slate-800">Initial password</label>
            <input
              {...register('initialPassword')}
              id="initialPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(errors.initialPassword)}
              aria-describedby={errors.initialPassword ? 'initialPassword-error' : undefined}
              className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-70"
            />
            {errors.initialPassword && <p id="initialPassword-error" className="mt-2 text-sm text-red-700">{errors.initialPassword.message}</p>}
          </div>
        )}
      </fieldset>
      {props.serverError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{props.serverError}</p>
      )}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? 'Saving...' : props.mode === 'create' ? 'Create employee' : 'Save changes'}
      </Button>
    </form>
  );
}
