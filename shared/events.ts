export type RideEventType = 'search_ride' | 'view_ride' | 'book_ride' | 'cancel_ride';

export type SearchRideEvent = {
  type: 'search_ride';
  from: string;
  to: string;
  timestamp: string;
};

export type ViewRideEvent = {
  type: 'view_ride';
  rideId: string;
  timestamp: string;
};

export type BookRideEvent = {
  type: 'book_ride';
  rideId: string;
  price: number;
  timestamp: string;
};

export type CancelRideEvent = {
  type: 'cancel_ride';
  rideId: string;
  timestamp: string;
};

export type RideEvent = SearchRideEvent | ViewRideEvent | BookRideEvent | CancelRideEvent;

export type FunnelMetrics = {
  searchCount: number;
  viewCount: number;
  bookingCount: number;
  cancellationCount: number;
  searchToViewDropOff: number;
  viewToBookDropOff: number;
  searchToBookDropOff: number;
};

export type DashboardSummary = {
  totalSearches: number;
  totalBookings: number;
  totalCancellations: number;
  conversionRate: number;
  cancellationRate: number;
};

export type RouteInsight = {
  route: string;
  searches: number;
  bookings: number;
  cancellations: number;
  conversionRate: number;
};

export type TimeSeriesPeriod = 'days' | 'weeks' | 'months' | 'years';

export type TimeSeriesPoint = {
  label: string;
  searches: number;
  bookings: number;
  cancellations: number;
};

export type TimeSeriesByPeriod = Record<TimeSeriesPeriod, TimeSeriesPoint[]>;

export type InsightCard = {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
};