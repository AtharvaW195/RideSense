import { rideCatalog } from '../../shared/rides.js';
import type { DashboardSummary, FunnelMetrics, InsightCard, RideEvent, RouteInsight, TimeSeriesPeriod, TimeSeriesPoint } from '../../shared/events.js';

function startOfDay(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function yearsAgo(years: number): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

function startOfWeek(value: Date): Date {
  const day = startOfDay(value);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

function startOfMonth(value: Date): Date {
  const month = new Date(value);
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  return month;
}

function startOfYear(value: Date): Date {
  const year = new Date(value);
  year.setMonth(0, 1);
  year.setHours(0, 0, 0, 0);
  return year;
}

function nextBucketStart(value: Date, period: TimeSeriesPeriod): Date {
  const next = new Date(value);

  if (period === 'days') {
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (period === 'weeks') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (period === 'months') {
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function bucketStart(value: Date, period: TimeSeriesPeriod): Date {
  if (period === 'days') {
    return startOfDay(value);
  }

  if (period === 'weeks') {
    return startOfWeek(value);
  }

  if (period === 'months') {
    return startOfMonth(value);
  }

  return startOfYear(value);
}

function bucketLabel(value: Date, period: TimeSeriesPeriod): string {
  if (period === 'days') {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (period === 'weeks') {
    return `${value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} wk`;
  }

  if (period === 'months') {
    return value.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  return value.getFullYear().toString();
}

function periodWindow(period: TimeSeriesPeriod): number {
  if (period === 'days') {
    return 14;
  }

  if (period === 'weeks') {
    return 12;
  }

  if (period === 'months') {
    return 12;
  }

  return 5;
}

function routeLabel(from: string, to: string): string {
  return `${from} → ${to}`;
}

function rideRouteName(rideId: string): string {
  const ride = rideCatalog.find((entry) => entry.id === rideId);
  return ride ? routeLabel(ride.from, ride.to) : 'Unknown route';
}

export function summarizeEvents(events: RideEvent[]): DashboardSummary {
  const searchCount = events.filter((event) => event.type === 'search_ride').length;
  const bookingCount = events.filter((event) => event.type === 'book_ride').length;
  const cancellationCount = events.filter((event) => event.type === 'cancel_ride').length;

  return {
    totalSearches: searchCount,
    totalBookings: bookingCount,
    totalCancellations: cancellationCount,
    conversionRate: searchCount === 0 ? 0 : bookingCount / searchCount,
    cancellationRate: bookingCount === 0 ? 0 : cancellationCount / bookingCount
  };
}

export function buildFunnel(events: RideEvent[]): FunnelMetrics {
  const searchCount = events.filter((event) => event.type === 'search_ride').length;
  const viewCount = events.filter((event) => event.type === 'view_ride').length;
  const bookingCount = events.filter((event) => event.type === 'book_ride').length;
  const cancellationCount = events.filter((event) => event.type === 'cancel_ride').length;

  return {
    searchCount,
    viewCount,
    bookingCount,
    cancellationCount,
    searchToViewDropOff: searchCount === 0 ? 0 : Math.max(0, 1 - viewCount / searchCount),
    viewToBookDropOff: viewCount === 0 ? 0 : Math.max(0, 1 - bookingCount / viewCount),
    searchToBookDropOff: searchCount === 0 ? 0 : Math.max(0, 1 - bookingCount / searchCount)
  };
}

export function buildRouteAnalytics(events: RideEvent[]): RouteInsight[] {
  const searchTotals = new Map<string, number>();
  const bookingTotals = new Map<string, number>();
  const cancellationTotals = new Map<string, number>();

  events.forEach((event) => {
    if (event.type === 'search_ride') {
      const key = routeLabel(event.from, event.to);
      searchTotals.set(key, (searchTotals.get(key) ?? 0) + 1);
      return;
    }

    if (event.type === 'book_ride') {
      const key = rideRouteName(event.rideId);
      bookingTotals.set(key, (bookingTotals.get(key) ?? 0) + 1);
      return;
    }

    if (event.type === 'cancel_ride') {
      const key = rideRouteName(event.rideId);
      cancellationTotals.set(key, (cancellationTotals.get(key) ?? 0) + 1);
    }
  });

  const routes = new Set([...searchTotals.keys(), ...bookingTotals.keys()]);

  return [...routes]
    .map((route) => {
      const searches = searchTotals.get(route) ?? 0;
      const bookings = bookingTotals.get(route) ?? 0;

      return {
        route,
        searches,
        bookings,
        cancellations: cancellationTotals.get(route) ?? 0,
        conversionRate: searches === 0 ? 0 : bookings / searches
      };
    })
    .sort((left, right) => right.searches - left.searches || left.conversionRate - right.conversionRate);
}

export function buildTimeSeries(events: RideEvent[], period: TimeSeriesPeriod): TimeSeriesPoint[] {
  const totalBuckets = periodWindow(period);
  const buckets = new Map<string, TimeSeriesPoint>();
  const bounds = new Map<string, { start: Date; end: Date }>();

  for (let offset = totalBuckets - 1; offset >= 0; offset -= 1) {
    const reference = period === 'days' ? daysAgo(offset) : period === 'weeks' ? daysAgo(offset * 7) : period === 'months' ? monthsAgo(offset) : yearsAgo(offset);
    const start = bucketStart(reference, period);
    const end = nextBucketStart(start, period);
    const key = start.toISOString();
    bounds.set(key, { start, end });
    buckets.set(key, { label: bucketLabel(start, period), searches: 0, bookings: 0, cancellations: 0 });
  }

  events.forEach((event) => {
    const createdAt = new Date(event.timestamp);
    if (Number.isNaN(createdAt.getTime())) {
      return;
    }

    for (const [key, window] of bounds.entries()) {
      if (createdAt < window.start || createdAt >= window.end) {
        continue;
      }

      const current = buckets.get(key);
      if (!current) {
        return;
      }

      if (event.type === 'search_ride') {
        current.searches += 1;
      }

      if (event.type === 'book_ride') {
        current.bookings += 1;
      }

      if (event.type === 'cancel_ride') {
        current.cancellations += 1;
      }

      return;
    }
  });

  return [...buckets.values()];
}

export function buildMostSearchedRoutes(events: RideEvent[]): RouteInsight[] {
  const byRoute = new Map<string, { searches: number; bookings: number }>();
  const cancellationTotals = new Map<string, number>();

  events.forEach((event) => {
    if (event.type === 'cancel_ride') {
      const key = rideRouteName(event.rideId);
      cancellationTotals.set(key, (cancellationTotals.get(key) ?? 0) + 1);
      return;
    }

    if (event.type !== 'search_ride') {
      return;
    }

    const key = routeLabel(event.from, event.to);
    const current = byRoute.get(key) ?? { searches: 0, bookings: 0 };
    current.searches += 1;
    byRoute.set(key, current);
  });

  return [...byRoute.entries()]
    .map(([route, value]) => ({
      route,
      searches: value.searches,
      bookings: value.bookings,
      cancellations: cancellationTotals.get(route) ?? 0,
      conversionRate: value.searches === 0 ? 0 : value.bookings / value.searches
    }))
    .sort((left, right) => right.searches - left.searches);
}

export function generateInsights(events: RideEvent[]): InsightCard[] {
  const summary = summarizeEvents(events);
  const funnel = buildFunnel(events);
  const routeAnalytics = buildRouteAnalytics(events);

  const insights: InsightCard[] = [];

  if (summary.totalSearches >= 20 && summary.conversionRate < 0.3) {
    insights.push({
      title: 'High demand but low conversion',
      detail: 'Search volume is strong, but too few riders are making it to booking. Review pricing, trust signals, and the booking path.',
      severity: 'high'
    });
  }

  if (summary.totalCancellations >= 4 && summary.cancellationRate > 0.3) {
    insights.push({
      title: 'Possible pricing or UX issue',
      detail: 'A large share of bookings are being canceled. That usually points to a price surprise, weak route confidence, or a confusing post-booking experience.',
      severity: 'high'
    });
  }

  if (funnel.viewCount >= 10 && funnel.viewToBookDropOff > 0.6) {
    insights.push({
      title: 'Users are interested but not committing',
      detail: 'Ride cards are getting attention, but views are not turning into purchases. Consider surfacing stronger social proof or clearer value cues.',
      severity: 'medium'
    });
  }

  const eveningSearches = events.filter((event) => {
    if (event.type !== 'search_ride') {
      return false;
    }

    const hour = new Date(event.timestamp).getHours();
    return hour >= 18 && hour <= 23;
  }).length;

  const eveningBookings = events.filter((event) => {
    if (event.type !== 'book_ride') {
      return false;
    }

    const hour = new Date(event.timestamp).getHours();
    return hour >= 18 && hour <= 23;
  }).length;

  if (eveningSearches >= 5 && eveningBookings <= 1) {
    insights.push({
      title: 'Evening supply gap',
      detail: 'Evening search intent is rising, but bookings are not keeping up. This often points to a supply issue or a schedule mismatch on popular routes.',
      severity: 'high'
    });
  }

  const weakRoutes = routeAnalytics.filter((route) => route.searches >= 5 && route.conversionRate < 0.15).slice(0, 3);
  weakRoutes.forEach((route) => {
    insights.push({
      title: 'Route conversion needs attention',
      detail: `${route.route} is getting steady interest, but conversion is lagging. Tune pricing or make the itinerary feel more dependable.`,
      severity: 'medium'
    });
  });

  if (insights.length === 0) {
    insights.push({
      title: 'Behavior looks healthy',
      detail: 'Search, view, and booking patterns are tracking closely enough that no urgent product issue stands out yet.',
      severity: 'low'
    });
  }

  return insights.slice(0, 5);
}