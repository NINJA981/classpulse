'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Room, RoomInput } from '@classiq/shared';
import { Button, Dialog, Field, InlineError, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError, optional } from '../queries';

const FIELDS = ['name', 'building', 'capacity'];

/** Create (room = null) or edit a room. Mount it only while open so the form resets. */
export function RoomDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(room?.name ?? '');
  const [building, setBuilding] = useState(room?.building ?? '');
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : '');
  const [capacityError, setCapacityError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Partial<RoomInput>) =>
      room ? api.patch<Room>(`/admin/rooms/${room.id}`, body) : api.post<Room>('/admin/rooms', body),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: adminKeys.rooms });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(room ? `Room “${saved.name}” updated` : `Room “${saved.name}” created`);
      onClose();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cap = capacity.trim() === '' ? undefined : Number(capacity);
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1 || cap > 1000)) {
      setCapacityError('Enter a whole number between 1 and 1000');
      return;
    }
    setCapacityError(null);
    save.mutate({
      name: name.trim(),
      // On edit an empty string clears the building; on create it is omitted.
      building: room ? building.trim() : optional(building),
      capacity: cap,
    });
  }

  const fe = fieldErrorsOf(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={room ? `Edit ${room.name}` : 'Add room'}
      description="A room is a physical classroom. Each room can host one classroom recording device."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="room-form" loading={save.isPending} disabled={!name.trim()}>
            {room ? 'Save room' : 'Create room'}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Room name" required error={fe.name} hint="e.g. Room 101 or Physics Lab">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />}
        </Field>
        <Field label="Building" error={fe.building}>
          {(p) => <Input {...p} value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={80} />}
        </Field>
        <Field label="Capacity" error={capacityError ?? fe.capacity} hint="Number of seats (optional)">
          {(p) => (
            <Input {...p} type="number" inputMode="numeric" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          )}
        </Field>
        <InlineError error={formLevelError(save.error, FIELDS)} />
      </form>
    </Dialog>
  );
}
