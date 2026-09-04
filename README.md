# Aether Weather App

Responsive weather app built with plain HTML, CSS, and JavaScript using the free Open-Meteo Forecast and Geocoding APIs.

## Run locally

No build step is required.

Use a small local static server (recommended because browser security policies can vary for direct file URLs), for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Features

- City/place search powered by Open-Meteo Geocoding API
- Current conditions with temperature, feels-like temperature, humidity, wind, and precipitation
- 7-day forecast
- Hourly forecast with a day selector
- Metric / Imperial unit preferences persisted in local storage
- Responsive desktop, tablet, and mobile layouts based on the supplied mockups
- Loading, error, and no-results handling
- Keyboard-accessible search suggestions and controls

## API

The app calls:

- `https://geocoding-api.open-meteo.com/v1/search`
- `https://api.open-meteo.com/v1/forecast`

No API key is required for normal non-commercial use.

## Branding

Branded as Aether Weather.
