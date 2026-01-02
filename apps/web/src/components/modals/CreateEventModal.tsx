'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export type EventType = 'ACADEMIC' | 'EVENT' | 'EXAM' | 'MEETING' | 'HOLIDAY';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    type: EventType;
    location?: string;
    roomId?: string;
    isAllDay: boolean;
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  }) => Promise<void>;
  selectedSlot?: { start: Date; end: Date };
  rooms?: Array<{ id: string; name: string; code?: string }>;
  isLoading?: boolean;
  currentSchoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
}

export function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
  selectedSlot,
  rooms = [],
  isLoading = false,
  currentSchoolType,
}: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(
    selectedSlot ? format(selectedSlot.start, "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [endDate, setEndDate] = useState(
    selectedSlot ? format(selectedSlot.end, "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [type, setType] = useState<EventType>('EVENT');
  const [location, setLocation] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title,
      description: description || undefined,
      startDate,
      endDate,
      type,
      location: location || undefined,
      roomId: roomId || undefined,
      isAllDay,
      schoolType: currentSchoolType || undefined,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setLocation('');
    setRoomId('');
    setIsAllDay(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Event" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
            Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event description"
            className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
              Start Date & Time *
            </label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
              End Date & Time *
            </label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded border-light-border dark:border-dark-border"
            />
            <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
              All-day event
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
            Event Type *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="ACADEMIC">Academic</option>
            <option value="EVENT">Event</option>
            <option value="EXAM">Exam</option>
            <option value="MEETING">Meeting</option>
            <option value="HOLIDAY">Holiday</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
            Location
          </label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., School Hall, Sports Field"
          />
        </div>

        {rooms.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2 text-light-text-primary dark:text-dark-text-primary">
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} {room.code && `(${room.code})`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

