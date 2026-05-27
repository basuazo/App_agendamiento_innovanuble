export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'LIDER_COMUNITARIA' | 'USER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';
export type BookingPurpose = 'LEARN' | 'PRODUCE' | 'DESIGN' | 'REUNION';
export type CommentTag = 'GENERAL' | 'MACHINE_ISSUE' | 'ORDER' | 'CLEANING';
export type CompanionRelation = 'CUIDADOS' | 'AMISTAD' | 'OTRO';
export type ResourceAvailabilityStatus = 'available' | 'booked' | 'blocked';

export interface Category {
  id: string;
  name: string;
  slug: string;   // e.g. "RECTA_CASERA" — usado para lógica de negocio
  color: string;  // hex color
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
  isActive: boolean;
  logoUrl?: string | null;
  primaryColor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceCustomization {
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  role: Role;
  spaceId?: string | null;
  isVerified?: boolean;
  createdAt: string;
}

export interface Resource {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  category: Category;
  requiresCertification: boolean;
  capacity: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  resourceId: string;
  startTime: string;
  endTime: string;
  notes?: string;
  purpose: BookingPurpose;
  produceItem?: string;
  produceQty?: number;
  quantity: number;
  isPrivate?: boolean;
  attendees: number;
  companionRelation?: CompanionRelation;
  status: BookingStatus;
  isExceptional?: boolean;
  googleCalendarEventId?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; organization?: string | null };
  resource: { id: string; name: string; category: Category };
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  tag: CommentTag;
  imageUrl?: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ResourceAvailability {
  [resourceId: string]: {
    status: ResourceAvailabilityStatus;
    reason?: string;
    availableCapacity?: number;
  };
}

export interface TrainingExemption {
  id: string;
  resourceId: string;
  resource: { id: string; name: string };
}

export type EnrollmentStatus = 'CONFIRMED' | 'WAITLIST';

export interface TrainingEnrollment {
  id: string;
  trainingId: string;
  userId: string;
  status: EnrollmentStatus;
  createdAt: string;
  user: { id: string; name: string; email: string; organization?: string | null };
}

export interface Training {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  capacity: number;
  createdBy: string;
  createdAt: string;
  exemptions: TrainingExemption[];
  enrollments: TrainingEnrollment[];
}

export type NotificationType = 'TRAINING_NEW' | 'USER_PENDING' | 'CERT_REQUEST';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  linkTo?: string | null;
  isRead: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface Certification {
  id: string;
  userId: string;
  categoryId: string;
  category: Category;
  certifiedAt: string;
  certifiedById: string;
  notes?: string;
  certifier?: { name: string };
  user?: { id: string; name: string; email: string };
}

export interface BusinessHours {
  id: string;
  dayOfWeek: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado
  isOpen: boolean;
  openTime: string;  // "09:00"
  closeTime: string; // "17:00"
  updatedAt: string;
}

export interface SpaceSettings {
  days: BusinessHours[];
  maxCapacity: number;        // aforo general (máquinas)
  maxCapacityReunion: number; // aforo sala de reuniones
  maxBookingMinutes: number;  // duración máxima de reserva en minutos (30–240, intervalos de 30)
  lunchBreakEnabled: boolean;
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
}

export interface Maintenance {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  spaceId: string;
  createdBy: string;
  createdAt: string;
  creator?: { id: string; name: string };
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  rejected: number;
}

export interface UserSummaryEnrollment {
  id: string;
  trainingId: string;
  userId: string;
  status: EnrollmentStatus;
  createdAt: string;
  training: { id: string; title: string; startTime: string; endTime: string; capacity: number };
}

export interface UserSummary {
  user: User;
  bookings: (Booking & { resource: { id: string; name: string; category: Category } })[];
  bookingStats: BookingStats;
  enrollments: UserSummaryEnrollment[];
  certifications: Certification[];
}
