'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { CalendarEventType } from '@/lib/store/api/schoolAdminApi';
import { Clock, MapPin, Building2, Plus } from 'lucide-react';

interface DayEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: CalendarEventType | 'TIMETABLE' | 'SESSION_START' | 'SESSION_END' | 'TERM_START' | 'TERM_END' | 'HALF_TERM';
  location?: string;
  roomName?: string;
  isAllDay: boolean;
  description?: string;
}

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: DayEvent[];
  onAddEvent?: () => void;
}

const eventTypeLabels: Record<string, string> = {
  ACADEMIC: 'Academic',
  EVENT: 'Event',
  EXAM: 'Exam',
  MEETING: 'Meeting',
  HOLIDAY: 'Holiday',
  TIMETABLE: 'Timetable',
  SESSION_START: 'Session Start',
  SESSION_END: 'Session End',
  TERM_START: 'Term Start',
  TERM_END: 'Term End',
  HALF_TERM: 'Half-Term Break',
};

const eventTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  ACADEMIC: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
  EVENT: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  EXAM: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
  MEETING: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
  },
  HOLIDAY: {
    bg: 'bg-gray-50 dark:bg-gray-950',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  TIMETABLE: {
    bg: 'bg-indigo-50 dark:bg-indigo-950',
    border: 'border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  SESSION_START: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  SESSION_END: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
  TERM_START: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  TERM_END: {
    bg: 'bg-pink-50 dark:bg-pink-950',
    border: 'border-pink-200 dark:border-pink-800',
    text: 'text-pink-700 dark:text-pink-300',
  },
  HALF_TERM: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
};

export function DayEventsModal({ isOpen, onClose, date, events, onAddEvent }: DayEventsModalProps) {
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startDate.getTime() - b.startDate.getTime();
  });

  const getEventTypeStyle = (type: string) => {
    return eventTypeColors[type] || eventTypeColors.EVENT;
  };

  const handleAddEvent = () => {
    onClose();
    if (onAddEvent) {
      // Small delay to ensure modal closes before opening the create modal
      setTimeout(() => {
        onAddEvent();
      }, 100);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Events for ${format(date, 'EEEE, MMMM d, yyyy')}`} size="lg">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleAddEvent} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              No events scheduled for this day
            </p>
            <Button variant="primary" onClick={handleAddEvent} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {sortedEvents.map((event) => {
              const style = getEventTypeStyle(event.type);
              return (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border ${style.bg} ${style.border} ${style.text}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${style.border} border ${style.text}`}>
                          {eventTypeLabels[event.type] || event.type}
                        </span>
                        {event.isAllDay && (
                          <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                            All Day
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-2">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
                          {event.description}
                        </p>
                      )}
                      <div className="flex flex-col gap-2 text-sm">
                        {!event.isAllDay && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(event.startDate, 'h:mm a')} - {format(event.endDate, 'h:mm a')}
                            </span>
                          </div>
                        )}
                        {(event.location || event.roomName) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location || event.roomName}</span>
                            {event.roomName && event.location && (
                              <>
                                <span className="text-light-text-muted dark:text-dark-text-muted">•</span>
                                <Building2 className="h-4 w-4" />
                                <span>{event.roomName}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

