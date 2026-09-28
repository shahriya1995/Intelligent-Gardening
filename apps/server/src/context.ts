import { getDatabase } from "./db.js";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label} response`);
  return value as JsonObject;
}

async function json(url: URL, label: string): Promise<JsonObject> {
  const response = await fetch(url, { headers: { "User-Agent": "Open-Gardener/0.2" }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`);
  return object(await response.json(), label);
}

export function currentDateTime(timeZone = "UTC"): Record<string, unknown> {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error(`Invalid IANA timezone: ${timeZone}`);
  }
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    timezone: timeZone,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekday: parts.weekday,
    utc_iso: now.toISOString(),
  };
}

export async function gardenWeather(gardenId: number, forecastDays = 7): Promise<Record<string, unknown>> {
  const garden = getDatabase().prepare("SELECT id, name, location FROM gardens WHERE id=?").get(gardenId) as { id: number; name: string; location: string } | undefined;
  if (!garden) throw new Error(`Garden ${gardenId} does not exist`);
  if (!garden.location.trim()) throw new Error(`Garden ${gardenId} has no location configured`);

  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({ name: garden.location, count: "1", language: "en", format: "json" }).toString();
  const geocode = await json(geocodeUrl, "geocoding");
  const match = Array.isArray(geocode.results) ? object(geocode.results[0], "geocoding result") : undefined;
  if (!match || typeof match.latitude !== "number" || typeof match.longitude !== "number") {
    throw new Error(`Could not resolve garden location: ${garden.location}`);
  }

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(match.latitude),
    longitude: String(match.longitude),
    timezone: typeof match.timezone === "string" ? match.timezone : "auto",
    forecast_days: String(forecastDays),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset",
  }).toString();
  const weather = await json(weatherUrl, "weather");

  return {
    garden: { id: garden.id, name: garden.name, configured_location: garden.location },
    resolved_location: {
      name: match.name, admin1: match.admin1, country: match.country,
      latitude: match.latitude, longitude: match.longitude, timezone: match.timezone,
    },
    fetched_at: new Date().toISOString(),
    current: weather.current,
    current_units: weather.current_units,
    daily: weather.daily,
    daily_units: weather.daily_units,
    source: "Open-Meteo",
  };
}
