import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { submitAttendance, type AttendanceSubmission } from '../api/attendance-api';
import {
  attendanceSubmissionFormSchema,
  type AttendanceSubmissionFormValues,
} from '../schemas/attendance-submission-schema';
import { formatAttendanceTimestamp } from '../utils/format-attendance-timestamp';

export function EmployeeAttendancePage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceSubmission | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceSubmissionFormValues>({
    resolver: zodResolver(attendanceSubmissionFormSchema),
    mode: 'onChange',
  });
  const photo = watch('photo');

  useEffect(() => {
    if (!attendanceSubmissionFormSchema.safeParse({ photo }).success) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onSubmit = async ({ photo: selectedPhoto }: AttendanceSubmissionFormValues) => {
    setResult(null);
    setSubmitError(null);
    try {
      setResult(await submitAttendance(selectedPhoto));
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      setSubmitError(
        status === 409
          ? 'Attendance has already been submitted for today.'
          : status === 413
            ? 'The photo is too large for the server. Choose a smaller photo.'
            : 'Could not submit attendance. Check your photo and try again.',
      );
    }
  };

  return (
    <section aria-labelledby="attendance-title" className="max-w-xl">
      <h1 id="attendance-title" className="text-2xl font-semibold text-slate-950">
        WFH attendance
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Submit a photo as proof of your work-from-home attendance.
      </p>
      <form className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="photo" className="block text-sm font-medium text-slate-800">
            Photo proof
          </label>
          <p id="photo-help" className="mt-1 text-sm text-slate-600">
            JPEG or PNG, up to 5 MiB. The server may apply a lower limit.
          </p>
          <Controller
            control={control}
            name="photo"
            render={({ field: { onChange, onBlur, ref, name } }) => (
              <input
                id="photo"
                name={name}
                ref={ref}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                required
                disabled={isSubmitting}
                onBlur={onBlur}
                onChange={(event) => {
                  setResult(null);
                  setSubmitError(null);
                  onChange(event.target.files?.[0]);
                }}
                aria-invalid={Boolean(errors.photo)}
                aria-describedby={errors.photo ? 'photo-help photo-error' : 'photo-help'}
                className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              />
            )}
          />
          {errors.photo && (
            <p id="photo-error" className="mt-2 text-sm text-red-700">
              {errors.photo.message}
            </p>
          )}
        </div>
        {preview && (
          <img
            src={preview}
            alt="Photo proof preview"
            className="max-h-64 max-w-full rounded-md object-contain"
          />
        )}
        {submitError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </p>
        )}
        {result && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
            Attendance submitted. Server time: {formatAttendanceTimestamp(result.submittedAt)} WIB.
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="min-h-11">
          {isSubmitting ? 'Submitting...' : 'Submit attendance'}
        </Button>
      </form>
    </section>
  );
}
