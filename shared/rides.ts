export type RideOption = {
  id: string;
  from: string;
  to: string;
  driver: string;
  departure: string;
  seatsLeft: number;
  price: number;
  rating: number;
};

const locations = [
  'Vestal, NY',
  'Binghamton, NY',
  'Ithaca, NY',
  'Elmira, NY',
  'Utica, NY',
  'Syracuse, NY',
  'Corning, NY',
  'Oneonta, NY',
  'Kingston, NY',
  'Albany, NY',
  'Poughkeepsie, NY',
  'Rochester, NY'
];

const drivers = [
  'Maya', 'Ethan', 'Priya', 'Noah', 'Ava', 'Sam', 'Lina', 'Jonah', 'Nina', 'Owen', 'Leah', 'Henry', 'Zoe', 'Iris', 'Miles', 'Tara'
];

const departureTimes = [
  '6:15 AM', '7:10 AM', '8:05 AM', '9:00 AM', '10:20 AM', '11:35 AM', '12:15 PM', '1:30 PM', '2:45 PM', '4:05 PM', '5:50 PM', '7:20 PM', '8:40 PM', '9:15 PM', '10:05 PM'
];

function routeSeed(fromIndex: number, toIndex: number): number {
  return fromIndex * locations.length + toIndex + 1;
}

function routePrice(distanceSeed: number): number {
  return 16 + (distanceSeed % 11) * 3;
}

function routeRating(distanceSeed: number): number {
  return 4.2 + ((distanceSeed % 8) * 0.1);
}

export const rideCatalog: RideOption[] = locations.flatMap((from, fromIndex) => {
  return locations.flatMap((to, toIndex) => {
    if (fromIndex === toIndex) {
      return [];
    }

    const seed = routeSeed(fromIndex, toIndex);
    return [{
      id: `ride-${1000 + seed}`,
      from,
      to,
      driver: drivers[seed % drivers.length],
      departure: departureTimes[seed % departureTimes.length],
      seatsLeft: 1 + (seed % 5),
      price: routePrice(seed),
      rating: Number(routeRating(seed).toFixed(1))
    }];
  });
});
