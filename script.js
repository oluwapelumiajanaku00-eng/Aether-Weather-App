const CONFIG = {
  geocodeUrl: 'https://geocoding-api.open-meteo.com/v1/search',
  forecastUrl: 'https://api.open-meteo.com/v1/forecast',
  defaultLocation: { name: 'Berlin', admin1: 'Berlin', country: 'Germany', latitude: 52.52437, longitude: 13.41053, timezone: 'Europe/Berlin' },
  days: 7
};

const els = {
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  status: document.getElementById('status'),
  unitsButton: document.getElementById('unitsButton'),
  unitsMenu: document.getElementById('unitsMenu'),
  switchLabel: document.getElementById('switchLabel'),
  locationName: document.getElementById('locationName'),
  locationDate: document.getElementById('locationDate'),
  currentIcon: document.getElementById('currentIcon'),
  currentTemp: document.getElementById('currentTemp'),
  feelsLike: document.getElementById('feelsLike'),
  humidity: document.getElementById('humidity'),
  wind: document.getElementById('wind'),
  precipitation: document.getElementById('precipitation'),
  dailyGrid: document.getElementById('dailyGrid'),
  hourSelect: document.getElementById('hourSelect'),
  hourSelectMobile: document.getElementById('hourSelectMobile'),
  hourlyList: document.getElementById('hourlyList'),
  hourlyListMobile: document.getElementById('hourlyListMobile')
};

const STORAGE_KEY = 'aether-weather-units';
const savedUnits = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();
const state = {
  units: { temp: savedUnits.temp || 'c', wind: savedUnits.wind || 'kmh', precip: savedUnits.precip || 'mm' },
  location: CONFIG.defaultLocation,
  weather: null,
  selectedDay: 0,
  lastRequest: 0
};

const weatherMap = {
  0: ['Clear sky', 'icon-sunny.webp'], 1: ['Mainly clear', 'icon-sunny.webp'], 2: ['Partly cloudy', 'icon-partly-cloudy.webp'], 3: ['Overcast', 'icon-overcast.webp'],
  45: ['Fog', 'icon-fog.webp'], 48: ['Depositing rime fog', 'icon-fog.webp'],
  51: ['Light drizzle', 'icon-drizzle.webp'], 53: ['Drizzle', 'icon-drizzle.webp'], 55: ['Heavy drizzle', 'icon-drizzle.webp'],
  56: ['Light freezing drizzle', 'icon-drizzle.webp'], 57: ['Heavy freezing drizzle', 'icon-drizzle.webp'],
  61: ['Light rain', 'icon-rain.webp'], 63: ['Rain', 'icon-rain.webp'], 65: ['Heavy rain', 'icon-rain.webp'],
  66: ['Light freezing rain', 'icon-rain.webp'], 67: ['Heavy freezing rain', 'icon-rain.webp'],
  71: ['Light snow', 'icon-snow.webp'], 73: ['Snow', 'icon-snow.webp'], 75: ['Heavy snow', 'icon-snow.webp'], 77: ['Snow grains', 'icon-snow.webp'],
  80: ['Rain showers', 'icon-rain.webp'], 81: ['Rain showers', 'icon-rain.webp'], 82: ['Violent rain showers', 'icon-rain.webp'],
  85: ['Snow showers', 'icon-snow.webp'], 86: ['Heavy snow showers', 'icon-snow.webp'],
  95: ['Thunderstorm', 'icon-storm.webp'], 96: ['Thunderstorm with hail', 'icon-storm.webp'], 99: ['Thunderstorm with heavy hail', 'icon-storm.webp']
};

function weatherInfo(code) { return weatherMap[code] || ['Weather', 'icon-overcast.webp']; }
function pad(n) { return String(n).padStart(2, '0'); }
function getTimeParts(iso) { const [date, time] = iso.split('T'); const [y,m,d] = date.split('-').map(Number); const [hh,mm] = time.split(':').map(Number); return { y,m,d,hh,mm }; }
function formatLongDate(iso) { const p = getTimeParts(iso); return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(p.y,p.m-1,p.d))); }
function weekdayFromISO(iso, timezone) { return new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone: timezone || 'UTC'}).format(new Date(iso)); }
function hourLabel(iso, timezone) { const d = new Date(`${iso}:00`); return new Intl.DateTimeFormat('en-US',{hour:'numeric',hour12:true,timeZone:timezone || 'UTC'}).format(d); }
function temp(v) { return `${Math.round(v)}°`; }
function wind(v) { return `${Math.round(v * (state.units.wind === 'mph' ? 0.621371 : 1))} ${state.units.wind}`; }
function precip(v) { const out = state.units.precip === 'in' ? v * 0.0393701 : v; return `${out < 1 && state.units.precip === 'in' ? out.toFixed(2) : Math.round(out * 10) / 10} ${state.units.precip}`; }
function geocodeLabel(loc) { return [loc.name, loc.admin1, loc.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', '); }
function setStatus(message, type='') { if (!message) { els.status.hidden = true; els.status.textContent=''; els.status.className='status'; return; } els.status.hidden=false; els.status.className=`status ${type}`; els.status.textContent=message; }

function syncUnitMenu() {
  const tempButtons = els.unitsMenu.querySelectorAll('[data-temp]');
  const windButtons = els.unitsMenu.querySelectorAll('[data-wind]');
  const precipButtons = els.unitsMenu.querySelectorAll('[data-precip]');
  tempButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.temp === state.units.temp)));
  windButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.wind === state.units.wind)));
  precipButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.precip === state.units.precip)));
  els.switchLabel.textContent = state.units.temp === 'c' && state.units.wind === 'kmh' && state.units.precip === 'mm' ? 'Switch to Imperial' : 'Switch to Metric';
}

function setAllUnits(mode) { state.units = mode === 'imperial' ? { temp: 'f', wind: 'mph', precip: 'in' } : { temp: 'c', wind: 'kmh', precip: 'mm' }; localStorage.setItem(STORAGE_KEY, JSON.stringify(state.units)); syncUnitMenu(); renderWeather(); }

function openUnits() { els.unitsMenu.hidden=false; els.unitsButton.setAttribute('aria-expanded','true'); }
function closeUnits() { els.unitsMenu.hidden=true; els.unitsButton.setAttribute('aria-expanded','false'); }

els.unitsButton.addEventListener('click', e => { e.stopPropagation(); els.unitsMenu.hidden ? openUnits() : closeUnits(); });
document.addEventListener('click', e => { if (!e.target.closest('.units-wrap')) closeUnits(); });
els.switchLabel.addEventListener('click', () => { const imperial = !(state.units.temp === 'f' && state.units.wind === 'mph' && state.units.precip === 'in'); setAllUnits(imperial ? 'imperial' : 'metric'); });

els.unitsMenu.addEventListener('click', e => {
  const btn = e.target.closest('.unit-option'); if (!btn) return;
  if (btn.dataset.temp) state.units.temp = btn.dataset.temp;
  if (btn.dataset.wind) state.units.wind = btn.dataset.wind;
  if (btn.dataset.precip) state.units.precip = btn.dataset.precip;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.units)); syncUnitMenu(); renderWeather();
});

function buildForecastUrl(loc) {
  const params = new URLSearchParams({
    latitude: loc.latitude,
    longitude: loc.longitude,
    timezone: 'auto',
    forecast_days: CONFIG.days,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min'
  });
  return `${CONFIG.forecastUrl}?${params.toString()}`;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

let activeAbort;
async function loadWeather(loc = state.location) {
  if (activeAbort) activeAbort.abort();
  activeAbort = new AbortController();
  const requestId = ++state.lastRequest;
  setStatus('Loading weather…','loading');
  try {
    const data = await fetchJson(buildForecastUrl(loc), activeAbort.signal);
    if (requestId !== state.lastRequest) return;
    state.location = loc;
    state.weather = data;
    state.selectedDay = 0;
    renderWeather();
    setStatus('');
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error(error);
    setStatus('We couldn’t load weather data. Check your connection and try again.','error');
  }
}

async function searchLocations(query) {
  const q = query.trim();
  if (q.length < 2) { els.searchResults.hidden=true; els.searchResults.innerHTML=''; return; }
  const requestId = ++state.lastRequest;
  try {
    const params = new URLSearchParams({ name:q, count:'6', language:'en', format:'json' });
    const data = await fetchJson(`${CONFIG.geocodeUrl}?${params.toString()}`);
    if (requestId !== state.lastRequest) return;
    renderSearchResults((data.results || []).slice(0,6));
  } catch (error) { if (error.name !== 'AbortError') console.error(error); }
}

function renderSearchResults(results) {
  if (!results.length) {
    els.searchResults.innerHTML = '<div class="result-item" aria-disabled="true">No locations found<span class="result-meta">Try a city, region, or country.</span></div>';
    els.searchResults.hidden = false;
    return;
  }
  els.searchResults.innerHTML = results.map((r,i)=>`
    <button class="result-item" type="button" role="option" data-index="${i}" aria-selected="false">
      ${escapeHtml(r.name)}
      <span class="result-meta">${escapeHtml([r.admin1,r.country].filter(Boolean).join(', '))}</span>
    </button>`).join('');
  els.searchResults._results = results;
  els.searchResults.hidden = false;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

els.searchInput.addEventListener('input', () => searchLocations(els.searchInput.value));
els.searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') els.searchResults.hidden=true;
  const items = [...els.searchResults.querySelectorAll('.result-item[role="option"]')]; if (!items.length) return;
  const current = items.findIndex(x=>x.getAttribute('aria-selected')==='true');
  if (e.key==='ArrowDown' || e.key==='ArrowUp') {
    e.preventDefault(); const next = e.key==='ArrowDown' ? Math.min(items.length-1,current+1) : Math.max(0,current-1);
    items.forEach((item,i)=>item.setAttribute('aria-selected',String(i===next))); items[next]?.focus();
  }
});
els.searchResults.addEventListener('click', e => {
  const item = e.target.closest('[data-index]'); if (!item) return;
  const result = els.searchResults._results[Number(item.dataset.index)];
  if (!result) return;
  els.searchInput.value = geocodeLabel(result); els.searchResults.hidden=true; loadWeather(result);
});
els.searchForm.addEventListener('submit', async e => {
  e.preventDefault();
  const query = els.searchInput.value.trim();
  if (!query) { setStatus('Enter a city or place to search.','error'); els.searchInput.focus(); return; }
  els.searchResults.hidden=true;
  await searchLocations(query);
  const result = els.searchResults._results?.[0];
  if (result) { els.searchInput.value=geocodeLabel(result); loadWeather(result); return; }
  setStatus('No location found. Try another city or include a country.','error');
});

function renderWeather() {
  if (!state.weather) return;
  const { current, daily, hourly, timezone } = state.weather;
  const info = weatherInfo(current.weather_code);
  const useF = state.units.temp === 'f';
  const currentTemp = useF ? current.temperature_2m * 9/5 + 32 : current.temperature_2m;
  const apparent = useF ? current.apparent_temperature * 9/5 + 32 : current.apparent_temperature;
  const highs = daily.temperature_2m_max.map(v => useF ? v*9/5+32 : v);
  const lows = daily.temperature_2m_min.map(v => useF ? v*9/5+32 : v);
  els.locationName.textContent = geocodeLabel(state.location);
  els.locationDate.textContent = formatLongDate(current.time);
  els.currentIcon.src = `./assets/images/${info[1]}`;
  els.currentIcon.alt = info[0];
  els.currentTemp.textContent = temp(currentTemp);
  els.feelsLike.textContent = temp(apparent);
  els.humidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  els.wind.textContent = wind(current.wind_speed_10m);
  els.precipitation.textContent = precip(current.precipitation);
  renderDaily(daily, highs, lows);
  renderDaySelectors(daily.time, timezone);
  renderHourly(timezone, hourly, state.selectedDay);
  syncUnitMenu();
}

function renderDaily(daily, highs, lows) {
  els.dailyGrid.innerHTML = daily.time.map((date,i)=>{
    const info=weatherInfo(daily.weather_code[i]);
    const active = i === state.selectedDay;
    return `<button class="daily-card ${active?'active':''}" type="button" data-day="${i}" aria-label="${date}, high ${Math.round(highs[i])} degrees, low ${Math.round(lows[i])} degrees">
      <span class="daily-day">${weekdayFromISO(`${date}T12:00:00`, state.weather.timezone)}</span>
      <img class="daily-icon" src="./assets/images/${info[1]}" alt="${escapeHtml(info[0])}">
      <span class="daily-temp"><span>${Math.round(highs[i])}°</span><span class="low">${Math.round(lows[i])}°</span></span>
    </button>`;
  }).join('');
}

function renderDaySelectors(dates, timezone) {
  const options = dates.map((date,i)=>`<option value="${i}">${new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:timezone}).format(new Date(`${date}T12:00:00`))}</option>`).join('');
  els.hourSelect.innerHTML=options; els.hourSelectMobile.innerHTML=options;
  els.hourSelect.value=String(state.selectedDay); els.hourSelectMobile.value=String(state.selectedDay);
}

function hourlyIndexes(hourlyTimes, dailyDate) {
  return hourlyTimes.map((iso,i)=>({iso,i})).filter(x=>x.iso.startsWith(dailyDate));
}

function renderHourly(timezone, hourly, dayIndex) {
  const date=state.weather.daily.time[dayIndex];
  const indexes=hourlyIndexes(hourly.time,date);
  const currentIndex = indexes.find(x => x.iso >= state.weather.current.time)?.i;
  const selected=indexes.length ? indexes : []; 
  const rows=selected.slice(currentIndex !== undefined && dayIndex===0 ? indexes.findIndex(x=>x.i===currentIndex) : 0, 24);
  const html=rows.map(({iso,i})=>{
    const info=weatherInfo(hourly.weather_code[i]);
    const rawTemp=state.units.temp==='f' ? hourly.temperature_2m[i]*9/5+32 : hourly.temperature_2m[i];
    return `<div class="hour-item">
      <img src="./assets/images/${info[1]}" alt="${escapeHtml(info[0])}">
      <span class="hour-time">${hourLabel(iso, timezone)}</span>
      <span class="hour-temp">${temp(rawTemp)}</span>
    </div>`;
  }).join('');
  els.hourlyList.innerHTML=html;
  els.hourlyListMobile.innerHTML=html;
}

function selectDay(i) { state.selectedDay=Number(i)||0; els.hourSelect.value=String(state.selectedDay); els.hourSelectMobile.value=String(state.selectedDay); renderWeather(); }
els.hourSelect.addEventListener('change',e=>selectDay(e.target.value));
els.hourSelectMobile.addEventListener('change',e=>selectDay(e.target.value));
els.dailyGrid.addEventListener('click',e=>{const card=e.target.closest('[data-day]'); if(card) selectDay(card.dataset.day);});

syncUnitMenu();
loadWeather();
