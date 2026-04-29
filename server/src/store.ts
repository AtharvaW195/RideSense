import { rideCatalog } from '../../shared/rides.js';
import type { RideEvent } from '../../shared/events.js';

const eventLog: RideEvent[] = [];

export function recordEvent(event: RideEvent): RideEvent {
  eventLog.push(event);
  return event;
}

export function listEvents(): RideEvent[] {
  return [...eventLog];
}

export function rideById(rideId: string) {
  return rideCatalog.find((ride: (typeof rideCatalog)[number]) => ride.id === rideId);
}

export function seedDemoEvents(): void {
  if (eventLog.length > 0) {
    return;
  }

  const now = Date.now();
  const timestampFromOffset = (daysAgo: number, hour: number, minute: number) => {
    const base = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    base.setHours(hour, minute, 0, 0);
    return base.toISOString();
  };
  const demoRows: RideEvent[] = [];

  rideCatalog.forEach((ride, index) => {
    const timeOffset = index < 30 ? index : index < 60 ? 30 + (index - 30) * 7 : index < 96 ? 120 + (index - 60) * 28 : 420 + (index - 96) * 42;
    const baseHour = 6 + (index % 10);

    demoRows.push({
      type: 'search_ride',
      from: ride.from,
      to: ride.to,
      timestamp: timestampFromOffset(timeOffset, baseHour, 5)
    });

    demoRows.push({
      type: 'search_ride',
      from: ride.from,
      to: ride.to,
      timestamp: timestampFromOffset(timeOffset, baseHour, 17)
    });

    demoRows.push({
      type: 'view_ride',
      rideId: ride.id,
      timestamp: timestampFromOffset(timeOffset, baseHour + 1, 11)
    });

    if (index % 3 !== 0) {
      demoRows.push({
        type: 'book_ride',
        rideId: ride.id,
        price: ride.price,
        timestamp: timestampFromOffset(timeOffset, baseHour + 2, 22)
      });
    }

    if (index % 5 === 0) {
      demoRows.push({
        type: 'cancel_ride',
        rideId: ride.id,
        timestamp: timestampFromOffset(timeOffset, baseHour + 3, 33)
      });
    }
  });

  demoRows.sort((left, right) => left.timestamp.localeCompare(right.timestamp)).forEach((event) => recordEvent(event));
}