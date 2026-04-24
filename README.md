# UAP Night Watch Telemetry App

A full-stack mobile-friendly dashboard optimized for portrait use on modern iPhones.

## What it does

- Collects free real-time weather and space-weather data (no API keys required).
- Blends atmospheric and geophysical values useful for UAP skywatch sessions.
- Stores a 4-hour rolling telemetry window in the client for trend monitoring.
- Displays data in a 2x2 grid of evenly sized dark-mode cards.

## Data sources (free / no key)

- Open-Meteo API (local weather and UV).
- NOAA SWPC public JSON endpoints (Kp index, solar wind plasma, IMF magnetometer values).

## Backend

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Endpoint:

- `GET /api/uap/telemetry?lat=<latitude>&lon=<longitude>`

## Frontend

```bash
cd frontend
npm install
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 npx expo start
```

Open in Expo Go on iPhone and keep the app running during your skywatch session.
