import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider><AppShell>{children}</AppShell></AuthProvider>;
}
