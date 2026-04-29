import { Router } from 'express';
import { buildFunnel, buildMostSearchedRoutes, buildRouteAnalytics, buildTimeSeries, generateInsights, summarizeEvents } from './analytics.js';
import { listEvents, recordEvent, rideById } from './store.js';
import { rideCatalog } from '../../shared/rides.js';
import type { RideEvent } from '../../shared/events.js';

function isValidRideEvent(payload: unknown): payload is RideEvent {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const event = payload as Partial<RideEvent>;

  if (event.type === 'search_ride') {
    return typeof event.from === 'string' && typeof event.to === 'string' && typeof event.timestamp === 'string';
  }

  if (event.type === 'view_ride') {
    return typeof event.rideId === 'string' && typeof event.timestamp === 'string';
  }

  if (event.type === 'book_ride') {
    return typeof event.rideId === 'string' && typeof event.price === 'number' && typeof event.timestamp === 'string';
  }

  if (event.type === 'cancel_ride') {
    return typeof event.rideId === 'string' && typeof event.timestamp === 'string';
  }

  return false;
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/catalog/rides', (_request, response) => {
    response.json({ rides: rideCatalog });
  });

  router.get('/events', (request, response) => {
    const typeFilter = typeof request.query.type === 'string' ? request.query.type : undefined;
    const rideIdFilter = typeof request.query.rideId === 'string' ? request.query.rideId : undefined;

    const filtered = listEvents().filter((event) => {
      if (typeFilter && event.type !== typeFilter) {
        return false;
      }

      if (rideIdFilter && 'rideId' in event && event.rideId !== rideIdFilter) {
        return false;
      }

      return true;
    });

    response.json({ events: filtered });
  });

  router.post('/events', (request, response) => {
    if (!isValidRideEvent(request.body)) {
      response.status(400).json({ message: 'Invalid event payload.' });
      return;
    }

    if ('rideId' in request.body && request.body.rideId && !rideById(request.body.rideId)) {
      response.status(400).json({ message: 'Unknown ride id.' });
      return;
    }

    const savedEvent = recordEvent(request.body);
    response.status(201).json({ event: savedEvent });
  });

  router.get('/analytics/summary', (_request, response) => {
    response.json({ summary: summarizeEvents(listEvents()) });
  });

  router.get('/analytics/funnel', (_request, response) => {
    response.json({ funnel: buildFunnel(listEvents()) });
  });

  router.get('/analytics/routes', (_request, response) => {
    response.json({ routes: buildRouteAnalytics(listEvents()) });
  });

  router.get('/analytics/top-routes', (_request, response) => {
    response.json({ routes: buildMostSearchedRoutes(listEvents()) });
  });

  router.get('/analytics/timeseries', (_request, response) => {
    response.json({
      seriesByPeriod: {
        days: buildTimeSeries(listEvents(), 'days'),
        weeks: buildTimeSeries(listEvents(), 'weeks'),
        months: buildTimeSeries(listEvents(), 'months'),
        years: buildTimeSeries(listEvents(), 'years')
      }
    });
  });

  router.get('/insights', (_request, response) => {
    response.json({ insights: generateInsights(listEvents()) });
  });

  router.get('/dashboard', (_request, response) => {
    const events = listEvents();
    response.json({
      summary: summarizeEvents(events),
      funnel: buildFunnel(events),
      routes: buildRouteAnalytics(events),
      topRoutes: buildMostSearchedRoutes(events),
      seriesByPeriod: {
        days: buildTimeSeries(events, 'days'),
        weeks: buildTimeSeries(events, 'weeks'),
        months: buildTimeSeries(events, 'months'),
        years: buildTimeSeries(events, 'years')
      },
      insights: generateInsights(events)
    });
  });

  return router;
}