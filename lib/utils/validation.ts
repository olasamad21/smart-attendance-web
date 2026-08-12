import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    role: z.enum(['lecturer', 'student'] as const),
    department: z.string().optional(),
    level: z.string().optional(),
    matricNumber: z.string().optional(),
    confirmMatricNumber: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.role === 'student') {
        return data.matricNumber === data.confirmMatricNumber;
      }
      return true;
    },
    {
      message: 'Matric numbers do not match',
      path: ['confirmMatricNumber'],
    }
  );

export const courseSchema = z.object({
  courseTitle: z.string().min(3, 'Course title must be at least 3 characters'),
  courseCode: z
    .string()
    .length(6, 'Course code must be exactly 6 characters')
    .regex(/^[A-Z0-9]+$/i, 'Course code must be alphanumeric'),
  defaultDuration: z
    .number()
    .min(15, 'Duration must be at least 15 minutes')
    .max(180, 'Duration must not exceed 180 minutes'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CourseInput = z.infer<typeof courseSchema>;