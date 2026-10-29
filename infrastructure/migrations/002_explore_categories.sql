-- Expand place_categories for Explore filters (TomTom / mapping POI set).
INSERT INTO place_categories (id, label) VALUES
  ('restaurant', 'Restaurant'),
  ('cafe', 'Cafe'),
  ('hotel', 'Hotel'),
  ('fuel', 'Fuel'),
  ('ev_charging', 'EV Charging'),
  ('hospital', 'Hospital'),
  ('pharmacy', 'Pharmacy'),
  ('school', 'School'),
  ('shopping', 'Shopping'),
  ('grocery', 'Grocery'),
  ('museum', 'Museum'),
  ('library', 'Library'),
  ('airport', 'Airport'),
  ('attraction', 'Attraction'),
  ('sports', 'Sports'),
  ('entertainment', 'Entertainment')
ON CONFLICT (id) DO NOTHING;
