import { useEffect, useMemo, useState } from 'react';
import { loadDashboard, loadRideCatalog, logRideEvent } from './api';
import type { DashboardSummary, FunnelMetrics, InsightCard, RouteInsight, TimeSeriesByPeriod, TimeSeriesPeriod, TimeSeriesPoint } from '../../shared/events';
import type { RideOption } from '../../shared/rides';

type SearchFilters = {
  from: string;
  to: string;
};

const fallbackSummary: DashboardSummary = {
  totalSearches: 0,
  totalBookings: 0,
  totalCancellations: 0,
  conversionRate: 0,
  cancellationRate: 0
};

const fallbackFunnel: FunnelMetrics = {
  searchCount: 0,
  viewCount: 0,
  bookingCount: 0,
  cancellationCount: 0,
  searchToViewDropOff: 0,
  viewToBookDropOff: 0,
  searchToBookDropOff: 0
};

const fallbackSeriesByPeriod: TimeSeriesByPeriod = {
  days: [],
  weeks: [],
  months: [],
  years: []
};

export default function App() {
  const [filters, setFilters] = useState<SearchFilters>({ from: 'Vestal, NY', to: 'Ithaca, NY' });
  const [lastSearchedRoute, setLastSearchedRoute] = useState<string>('Vestal, NY → Ithaca, NY');
  const [rideCatalog, setRideCatalog] = useState<RideOption[]>([]);
  const [visibleRides, setVisibleRides] = useState<RideOption[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>(fallbackSummary);
  const [funnel, setFunnel] = useState<FunnelMetrics>(fallbackFunnel);
  const [routes, setRoutes] = useState<RouteInsight[]>([]);
  const [seriesByPeriod, setSeriesByPeriod] = useState<TimeSeriesByPeriod>(fallbackSeriesByPeriod);
  const [timePeriod, setTimePeriod] = useState<TimeSeriesPeriod>('days');
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [statusMessage, setStatusMessage] = useState('Search a route to start the simulation.');
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const placeSuggestions = useMemo(() => {
    return [...new Set(rideCatalog.flatMap((ride) => [ride.from, ride.to]))].sort((left, right) => left.localeCompare(right));
  }, [rideCatalog]);

  async function refreshDashboard() {
    const dashboard = await loadDashboard();
    setSummary(dashboard.summary);
    setFunnel(dashboard.funnel);
    setRoutes(dashboard.routes);
    setSeriesByPeriod(dashboard.seriesByPeriod);
    setInsights(dashboard.insights);
  }

  useEffect(() => {
    async function bootstrap() {
      const catalog = await loadRideCatalog();
      setRideCatalog(catalog.rides);
      setVisibleRides([]);
      await refreshDashboard();
    }

    bootstrap().catch(() => {
      setStatusMessage('Unable to load dashboard data. Start the backend and refresh.');
    });
    // The initial filter is derived from the default route and reused in the simulation panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topRoutes = useMemo(() => routes.slice(0, 5), [routes]);
  const selectedSeries = seriesByPeriod[timePeriod];
  const routeInsight = useMemo(() => {
    const target = lastSearchedRoute.trim().toLowerCase();
    const exactMatch = routes.find((route) => route.route.toLowerCase() === target);
    if (exactMatch) {
      return exactMatch;
    }

    return undefined;
  }, [lastSearchedRoute, routes]);

  const routeInsightSeverity = useMemo<InsightCard['severity']>(() => {
    if (!routeInsight) {
      return 'medium';
    }

    if (routeInsight.cancellations >= 2 && routeInsight.cancellations >= routeInsight.bookings) {
      return 'high';
    }

    if (routeInsight.searches >= 3 && routeInsight.conversionRate < 0.35) {
      return 'high';
    }

    if (routeInsight.searches >= 3 && routeInsight.conversionRate < 0.6) {
      return 'medium';
    }

    return 'low';
  }, [routeInsight]);

  const highImpactInsight = useMemo<InsightCard>(() => {
    if (routeInsight) {
      if (routeInsight.cancellations >= 2 && routeInsight.cancellations >= routeInsight.bookings) {
        return {
          title: 'Route-level cancellation risk',
          detail: `${routeInsight.route} has cancellations at or above bookings. Focus on route confidence, pricing clarity, and cancellation friction.`,
          severity: 'high'
        };
      }

      if (routeInsight.searches >= 3 && routeInsight.conversionRate < 0.35) {
        return {
          title: 'Route-level conversion gap',
          detail: `${routeInsight.route} has meaningful search demand but low booking completion. Strengthen trust and simplify checkout for this route.`,
          severity: 'high'
        };
      }

      if (routeInsight.searches >= 3 && routeInsight.conversionRate >= 0.7) {
        return {
          title: 'Route performing strongly',
          detail: `${routeInsight.route} is converting well. This route is a candidate for supply scaling and promotional prioritization.`,
          severity: 'low'
        };
      }
    }

    if (summary.cancellationRate > 0.4 && summary.totalCancellations >= 4) {
      return {
        title: 'Possible pricing or UX issue',
        detail: 'A large share of bookings are being canceled. That usually points to a price surprise, weak route confidence, or a confusing post-booking experience.',
        severity: 'high'
      };
    }

    if (summary.conversionRate < 0.35 && summary.totalSearches >= 20) {
      return {
        title: 'High demand but low conversion',
        detail: 'Search volume is healthy, but bookings are lagging. Consider reducing friction in booking and improving value communication.',
        severity: 'high'
      };
    }

    return insights[0] ?? {
      title: 'Behavior looks healthy',
      detail: 'No urgent anomaly is currently dominant in the event stream.',
      severity: 'low'
    };
  }, [insights, routeInsight, summary.cancellationRate, summary.conversionRate, summary.totalCancellations, summary.totalSearches]);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFrom = filters.from.trim();
    const trimmedTo = filters.to.trim();
    setLastSearchedRoute(`${trimmedFrom} → ${trimmedTo}`);
    const normalizedFrom = trimmedFrom.toLowerCase();
    const normalizedTo = trimmedTo.toLowerCase();
    const ridesToShow = rideCatalog.filter((ride) => {
      const fromMatches = normalizedFrom.length === 0 || ride.from.toLowerCase().includes(normalizedFrom);
      const toMatches = normalizedTo.length === 0 || ride.to.toLowerCase().includes(normalizedTo);
      return fromMatches && toMatches;
    });

    setVisibleRides(ridesToShow);
    setStatusMessage(
      ridesToShow.length > 0
        ? `Showing ${ridesToShow.length} ride option${ridesToShow.length === 1 ? '' : 's'} for ${trimmedFrom} to ${trimmedTo}.`
        : `No rides matched ${trimmedFrom} to ${trimmedTo}. Try a broader place name or pick from autocomplete.`,
    );

    await logRideEvent({
      type: 'search_ride',
      from: trimmedFrom,
      to: trimmedTo,
      timestamp: new Date().toISOString()
    });

    await refreshDashboard();
  }

  async function trackRideView(ride: RideOption) {
    setPendingRideId(ride.id);
    await logRideEvent({ type: 'view_ride', rideId: ride.id, timestamp: new Date().toISOString() });
    setStatusMessage(`Viewed ${ride.from} to ${ride.to} with ${ride.driver}.`);
    await refreshDashboard();
    setPendingRideId(null);
  }

  async function trackBooking(ride: RideOption) {
    setPendingRideId(ride.id);
    await logRideEvent({ type: 'book_ride', rideId: ride.id, price: ride.price, timestamp: new Date().toISOString() });
    setStatusMessage(`Booked ${ride.from} to ${ride.to} for $${ride.price}.`);
    await refreshDashboard();
    setPendingRideId(null);
  }

  async function trackCancellation(ride: RideOption) {
    setPendingRideId(ride.id);
    await logRideEvent({ type: 'cancel_ride', rideId: ride.id, timestamp: new Date().toISOString() });
    setStatusMessage(`Canceled the ride from ${ride.from} to ${ride.to}.`);
    await refreshDashboard();
    setPendingRideId(null);
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Ride Analytics & Insights Dashboard</p>
          <h1>Understand demand, conversion, and rider friction in one view.</h1>
          <p className="hero-text">Track behavior, simulate rides, and surface product signals without a busy interface.</p>
          <p className="note">Insights are generated based on behavioral heuristics.</p>
        </div>

        <form className="search-panel" onSubmit={handleSearchSubmit}>
          <LocationField
            label="From"
            value={filters.from}
            onValueChange={(value) => setFilters((current) => ({ ...current, from: value }))}
            placeholder="City or address"
            listId="place-suggestions"
          />
          <LocationField
            label="To"
            value={filters.to}
            onValueChange={(value) => setFilters((current) => ({ ...current, to: value }))}
            placeholder="City or address"
            listId="place-suggestions"
          />
          <button type="submit">Find a Ride</button>
        </form>

        <datalist id="place-suggestions">
          {placeSuggestions.map((place) => (
            <option key={place} value={place} />
          ))}
        </datalist>

        <div className="hero-status">{statusMessage}</div>
      </section>

      <section className="dashboard-card results-panel">
        <div className="section-heading">
          <p className="eyebrow">Search Results</p>
          <h2>Rides matching your search</h2>
        </div>

        <div className="insight-grid search-insight-grid">
          <article className={`insight-card ${highImpactInsight.severity} insight-focus`}>
            <p className="eyebrow inline">High impact insight</p>
            <h3>{highImpactInsight.title}</h3>
            <p>{highImpactInsight.detail}</p>
          </article>

          <article className={`insight-card ${routeInsightSeverity} insight-focus`}>
            <p className="eyebrow inline">Route insight</p>
            <h3>{routeInsight ? routeInsight.route : lastSearchedRoute}</h3>
            {routeInsight ? (
              <p>
                {routeInsight.searches} searches, {routeInsight.bookings} bookings, {routeInsight.cancellations} cancellations, {formatPercent(routeInsight.conversionRate)} conversion.
              </p>
            ) : (
              <p>No route analytics yet for this exact route. Search and interact with rides to generate route-specific behavior.</p>
            )}
          </article>
        </div>

        {visibleRides.length > 0 ? (
          <div className="ride-grid">
            {visibleRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                pendingRideId={pendingRideId}
                onView={trackRideView}
                onBook={trackBooking}
                onCancel={trackCancellation}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">Search for a route to see matching rides here.</div>
        )}
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total Searches" value={summary.totalSearches.toString()} />
        <MetricCard label="Total Bookings" value={summary.totalBookings.toString()} />
        <MetricCard label="Total Cancellations" value={summary.totalCancellations.toString()} />
        <MetricCard label="Conversion Rate" value={formatPercent(summary.conversionRate)} />
        <MetricCard label="Cancellation Rate" value={formatPercent(summary.cancellationRate)} />
      </section>

      <section className="dashboard-grid analysis-grid">
        <article className="dashboard-card chart-card">
          <div className="section-heading">
            <p className="eyebrow">Funnel</p>
            <h2>Search → Book</h2>
            <p className="section-copy">Search is the entry step. We count bookings and cancellations after that search, and we skip the view step because it mirrors search too closely for this dashboard.</p>
          </div>
          <FunnelRow label="Searches" value={funnel.searchCount} accent="#f59e0b" />
          <FunnelRow label="Bookings" value={funnel.bookingCount} accent="#ea580c" />
          <FunnelRow label="Cancellations" value={funnel.cancellationCount} accent="#9a3412" />
          <div className="section-heading section-spacer">
            <p className="eyebrow">Time Analytics</p>
            <h2>Searches, bookings, and cancellations over time</h2>
            <p className="section-copy">Switch between days, weeks, months, and years to see the same mock data at different scales.</p>
          </div>
          <div className="period-switcher" role="tablist" aria-label="Time analytics period">
            {(['days', 'weeks', 'months', 'years'] as TimeSeriesPeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                className={period === timePeriod ? 'period-button active' : 'period-button'}
                onClick={() => setTimePeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
          <TrendChart series={selectedSeries} />
        </article>
      </section>

      <section className="dashboard-grid bottom-grid">
        <article className="dashboard-card">
          <div className="section-heading">
            <p className="eyebrow">Route Analytics</p>
            <h2>Most searched routes</h2>
          </div>
          <div className="route-list">
            {topRoutes.map((route) => (
              <RouteRow key={route.route} route={route} />
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function LocationField({
  label,
  value,
  onValueChange,
  placeholder,
  listId
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  listId: string;
}) {
  return (
    <label className="autocomplete-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        list={listId}
      />
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FunnelRow({ label, value, accent, small = false }: { label: string; value: string | number; accent: string; small?: boolean }) {
  return (
    <div className={`funnel-row ${small ? 'small' : ''}`}>
      <span>{label}</span>
      <div className="funnel-track">
        <div className="funnel-fill" style={{ background: accent, width: small ? '50%' : '100%' }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function RouteRow({ route }: { route: RouteInsight }) {
  return (
    <div className="route-row">
      <div>
        <strong>{route.route}</strong>
        <span>{route.searches} searches · {route.bookings} bookings · {route.cancellations} cancellations</span>
      </div>
      <div className="route-metric">
        <strong>{formatPercent(route.conversionRate)}</strong>
        <span>conversion</span>
      </div>
    </div>
  );
}

function RideCard({ ride, onView, onBook, onCancel, pendingRideId }: {
  ride: RideOption;
  onView: (ride: RideOption) => Promise<void>;
  onBook: (ride: RideOption) => Promise<void>;
  onCancel: (ride: RideOption) => Promise<void>;
  pendingRideId: string | null;
}) {
  return (
    <article className="ride-card" onClick={() => onView(ride)}>
      <div className="ride-card-top">
        <div>
          <h3>{ride.from} → {ride.to}</h3>
          <p>{ride.driver} · {ride.departure} · {ride.rating.toFixed(1)} rating</p>
        </div>
        <div className="ride-price">${ride.price}</div>
      </div>

      <p className="seat-count">{ride.seatsLeft} seats left</p>

      <div className="ride-actions">
        <button type="button" onClick={(event) => { event.stopPropagation(); void onBook(ride); }} disabled={pendingRideId === ride.id}>Book</button>
        <button type="button" className="ghost" onClick={(event) => { event.stopPropagation(); void onCancel(ride); }} disabled={pendingRideId === ride.id}>Cancel</button>
      </div>
    </article>
  );
}

function TrendChart({ series }: { series: TimeSeriesPoint[] }) {
  const maxValue = Math.max(1, ...series.flatMap((point) => [point.searches, point.bookings, point.cancellations]));
  const columnCount = Math.max(1, series.length);

  return (
    <div className="trend-chart" aria-label="Search and booking trend chart" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
      {series.map((point) => (
        <div className="trend-column" key={point.label}>
          <div className="bar-group">
            <div className="bar search" style={{ height: `${(point.searches / maxValue) * 100}%` }} />
            <div className="bar booking" style={{ height: `${(point.bookings / maxValue) * 100}%` }} />
            <div className="bar cancellation" style={{ height: `${(point.cancellations / maxValue) * 100}%` }} />
          </div>
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}