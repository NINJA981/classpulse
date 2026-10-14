'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Room } from '@classiq/shared';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useRooms } from '@/components/admin/queries';
import { ConfirmDialog } from '@/components/admin/common';
import { RoomDialog } from '@/components/admin/rooms/room-dialog';

export default function RoomsPage() {
  const rooms = useRooms();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Room | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);

  const remove = useMutation({
    mutationFn: (room: Room) => api.delete(`/admin/rooms/${room.id}`),
    onSuccess: (_, room) => {
      void qc.invalidateQueries({ queryKey: adminKeys.rooms });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Room “${room.name}” deleted`);
      setDeleting(null);
    },
  });

  const addButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
      Add room
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Rooms"
        description="Physical classrooms. Sections are taught in a room, and classroom devices are installed per room."
        actions={addButton}
      />
      <Card>
        {rooms.isPending ? (
          <LoadingBlock label="Loading rooms…" />
        ) : rooms.error ? (
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
        ) : rooms.data.length === 0 ? (
          <EmptyState
            icon={<DoorOpen className="size-8" aria-hidden />}
            title="No rooms yet"
            description="Add the classrooms in your school so sections and recording devices can be assigned to them."
            action={addButton}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Building</TH>
                <TH className="text-right">Capacity</TH>
                <TH className="text-right">Devices</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rooms.data.map((r) => (
                <TR key={r.id}>
                  <TD className="font-semibold">{r.name}</TD>
                  <TD className="text-ink-2">{r.building ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{r.capacity ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{r.deviceCount}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} aria-label={`Edit room ${r.name}`} onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="size-3.5" aria-hidden />}
                        aria-label={`Delete room ${r.name}`}
                        onClick={() => {
                          remove.reset();
                          setDeleting(r);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {editing && <RoomDialog room={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete room?"
        description={
          deleting && (
            <>
              <strong>{deleting.name}</strong> will be removed. Rooms with a classroom device attached can’t be deleted — revoke
              the device first.
            </>
          )
        }
        confirmLabel="Delete room"
        onConfirm={() => deleting && remove.mutate(deleting)}
        pending={remove.isPending}
        error={remove.error}
      />
    </>
  );
}
