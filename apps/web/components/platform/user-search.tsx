'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { PlatformUserHit, Role } from '@classpulse/shared';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { useDebounced } from '@/components/admin/use-debounced';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { platformKeys } from './queries';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', teacher: 'Teacher', student: 'Student' };

/** Search every school's users by name, email or roll number. */
export function UserSearch() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const term = useDebounced(q.trim(), 300);
  const ready = term.length >= 2;
  const results = useQuery({
    queryKey: [...platformKeys.users(term), role],
    queryFn: () => api.get<PlatformUserHit[]>('/platform/users', { q: term, role }),
    enabled: ready,
  });

  return (
    <>
      <PageHeader eyebrow="Platform console" title="Users" description="Find any admin, teacher or student across all schools." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Search users" hint="Name, email or roll number (at least 2 characters)" className="sm:w-96">
          {(p) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input {...p} type="search" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
        </Field>
        <Field label="Role" className="sm:w-40">
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
            </Select>
          )}
        </Field>
      </div>
      <Card>
        {!ready ? (
          <EmptyState icon={<Search className="size-8" aria-hidden />} title="Search across every school" description="Type a name, an email address or a roll number." />
        ) : results.isPending ? (
          <LoadingBlock />
        ) : results.isError ? (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data.length === 0 ? (
          <EmptyState title="No users found" description="Check the spelling, or search by email or roll number instead." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>User</TH>
                  <TH>Role</TH>
                  <TH>School</TH>
                  <TH>Status</TH>
                  <TH>Last sign-in</TH>
                </tr>
              </THead>
              <TBody>
                {results.data.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-xs text-muted">{u.email ?? u.rollNumber}</p>
                    </TD>
                    <TD>{ROLE_LABEL[u.role]}</TD>
                    <TD>
                      <Link href={`/platform/schools/${u.school.id}`} className="font-semibold hover:underline">
                        {u.school.name}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-muted">{u.school.code}</span>
                      {u.school.status === 'suspended' && (
                        <Badge tone="danger" className="ml-2">
                          Suspended
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{u.status}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {results.data.length >= 50 && <p className="border-t border-line px-5 py-3 text-xs text-muted">Showing the first 50 matches. Refine the search to narrow it down.</p>}
          </>
        )}
      </Card>
    </>
  );
}
