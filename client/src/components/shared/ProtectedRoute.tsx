import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false }: Props) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (!user) return <Navigate to="/login" replace />;
  if (superAdminOnly && user.role !== 'SUPER_ADMIN') return <Navigate to="/calendar" replace />;
  const elevatedRoles = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'];
  if (adminOnly && !elevatedRoles.includes(user.role)) return <Navigate to="/calendar" replace />;

  return <>{children}</>;
}
