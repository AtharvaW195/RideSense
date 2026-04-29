import type { DashboardSummary, FunnelMetrics, InsightCard, RideEvent, RouteInsight, TimeSeriesByPeriod } from '../../shared/events';
import type { RideOption } from '../../shared/rides';

const headers = {
  'Content-Type': 'application/json'
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function loadRideCatalog(): Promise<{ rides: RideOption[] }> {
  return requestJson('/api/catalog/rides');
}

export function logRideEvent(event: RideEvent): Promise<{ event: RideEvent }> {
  return requestJson('/api/events', {
    method: 'POST',
    headers,
    body: JSON.stringify(event)
  });
}

export function loadDashboard(): Promise<{
  summary: DashboardSummary;
  funnel: FunnelMetrics;
  routes: RouteInsight[];
  topRoutes: RouteInsight[];
  seriesByPeriod: TimeSeriesByPeriod;
  insights: InsightCard[];
}> {
  return requestJson('/api/dashboard');
}