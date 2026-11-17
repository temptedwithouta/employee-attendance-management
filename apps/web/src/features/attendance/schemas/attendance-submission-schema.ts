import { z } from 'zod';

export const attendanceSubmissionFormSchema = z.object({
  photo: z
    .custom<File>((value) => value instanceof File, 'Select a JPEG or PNG photo.')
    .refine(
      (file) =>
        !file ||
        (/\.jpe?g$/i.test(file.name) && file.type === 'image/jpeg') ||
        (/\.png$/i.test(file.name) && file.type === 'image/png'),
      'Select a JPEG or PNG photo with a matching file type.',
    )
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, 'Photo must not exceed 5 MiB.'),
});

export type AttendanceSubmissionFormValues = z.infer<typeof attendanceSubmissionFormSchema>;
