import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireRole } from './protected-route';
import { AppLayout } from './app-layout';
import { LoginPage } from '@/features/auth/pages/login-page';
import { EmployeeAttendancePage } from '@/features/attendance/pages/employee-attendance-page';
import { HrAttendancePage } from '@/features/attendance/pages/hr-attendance-page';
import { AttendanceDetailPage } from '@/features/attendance/pages/attendance-detail-page';
import { EmployeeManagementPage } from '@/features/employees/pages/employee-management-page';
import { EmployeeFormPage } from '@/features/employees/pages/employee-form-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireRole role="EMPLOYEE" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/employee/attendance',
            element: <EmployeeAttendancePage />,
          },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="HR" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/hr/employees',
            element: <EmployeeManagementPage />,
          },
          {
            path: '/hr/employees/new',
            element: <EmployeeFormPage />,
          },
          {
            path: '/hr/employees/:employeeId/edit',
            element: <EmployeeFormPage />,
          },
          {
            path: '/hr/attendance',
            element: <HrAttendancePage />,
          },
          {
            path: '/hr/attendance/:attendanceId',
            element: <AttendanceDetailPage />,
          },
        ],
      },
    ],
  },
]);
