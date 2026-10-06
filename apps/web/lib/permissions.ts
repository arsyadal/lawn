import type { UserRole } from './types';

export const canManagePayments = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
export const canManageServices = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
export const canManageTeam = (role?: UserRole) => role === 'OWNER';
export const canManageSettings = (role?: UserRole) => role === 'OWNER';
export const canCreateOrder = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
export const canViewReports = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
export const canRotateTracking = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
export const canViewAudit = (role?: UserRole) => role === 'OWNER' || role === 'ADMIN';
