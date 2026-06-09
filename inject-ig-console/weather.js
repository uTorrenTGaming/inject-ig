let LOCATIONS = [
    { name: 'São Paulo', tz: 'America/Sao_Paulo', lat: -23.5505, lon: -46.6333 },
    { name: 'Nova York', tz: 'America/New_York', lat: 40.7128, lon: -74.0060 },
    { name: 'Londres', tz: 'Europe/London', lat: 51.5074, lon: -0.1278 },
    { name: 'Tóquio', tz: 'Asia/Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Paris', tz: 'Europe/Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'Sydney', tz: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Dubai', tz: 'Asia/Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Moscou', tz: 'Europe/Moscow', lat: 55.7558, lon: 37.6173 }
];

const WMO_CODES = {
    0: 'Céu Limpo',
    1: 'Quase Limpo',
    2: 'Parc. Nublado',
    3: 'Nublado',
    45: 'Nevoeiro',
    48: 'Nevoeiro',
    51: 'Chuvisco Leve',
    53: 'Chuvisco Mod.',
    55: 'Chuvisco Denso',
    61: 'Chuva Leve',
    63: 'Chuva Moderada',
    65: 'Chuva Forte',
    71: 'Neve Leve',
    73: 'Neve Moderada',
    75: 'Neve Forte',
    77: 'Grãos de Neve',
    80: 'Pancadas de Chuva',
    81: 'Pancadas Fortes',
    82: 'Pancadas Violentas',
    85: 'Pancadas de Neve',
    86: 'Pancadas Neve Forte',
    95: 'Trovoada',
    96: 'Trovoada c/ Granizo',
    99: 'Trovoada c/ Granizo'
};

const getWeatherIcon = (code, isDay) => {
    if (code === 0 || code === 1) return isDay ? '☀️' : '🌙';
    if (code === 2) return isDay ? '⛅' : '☁️';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌥️';
};

class WeatherApp {
    constructor() {
        this.container = document.getElementById('weather-cards-container');
        this.clockInterval = null;
        this.weatherInterval = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        await this.fetchUserLocation();
        this.fetchWeatherData();
        
        // Update weather every 15 minutes
        this.weatherInterval = setInterval(() => this.fetchWeatherData(), 15 * 60 * 1000);
        
        // Start live clocks
        this.clockInterval = setInterval(() => this.updateClocks(), 1000);
    }

    async fetchUserLocation() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            if (!res.ok) return;
            const data = await res.json();
            if (data.latitude && data.longitude && data.city && data.timezone) {
                // Remove if already exists to prevent duplicates on re-init just in case
                LOCATIONS = LOCATIONS.filter(l => !l.name.includes('📍'));
                LOCATIONS.unshift({
                    name: '📍 ' + data.city,
                    tz: data.timezone,
                    lat: data.latitude,
                    lon: data.longitude
                });
            }
        } catch (err) {
            console.error('IP Geolocation failed:', err);
        }
    }

    async fetchWeatherData() {
        try {
            const lats = LOCATIONS.map(l => l.lat).join(',');
            const lons = LOCATIONS.map(l => l.lon).join(',');
            
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,is_day&timezone=auto`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            this.renderCards(data);
        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            if (this.container) {
                this.container.innerHTML = `<div style="text-align: center; color: var(--red); font-size: 11px; padding: 20px; grid-column: 1 / -1;">Falha ao carregar dados de clima. Verifique a conexão com a internet.</div>`;
            }
        }
    }

    renderCards(apiData) {
        if (!this.container) return;
        this.container.innerHTML = '';

        // If open-meteo returns array (multiple locations), it returns array of objects.
        // Wait, for multiple lats/lons, it actually returns an array in the root.
        const results = Array.isArray(apiData) ? apiData : [apiData];

        LOCATIONS.forEach((loc, i) => {
            const data = results[i] || results[0]; 
            const current = data.current || {};
            
            const temp = Math.round(current.temperature_2m) || '--';
            const code = current.weather_code !== undefined ? current.weather_code : 0;
            const isDay = current.is_day !== undefined ? current.is_day : 1;
            const desc = WMO_CODES[code] || 'Desconhecido';
            const icon = getWeatherIcon(code, isDay);

            // Dynamic styles based on day/night
            const bgGradient = isDay 
                ? 'linear-gradient(135deg, rgba(10,132,255,0.1) 0%, rgba(58,160,255,0.05) 100%)'
                : 'linear-gradient(135deg, rgba(44,44,46,0.5) 0%, rgba(28,28,30,0.5) 100%)';
            const borderColor = isDay ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.05)';
            const tempColor = isDay ? 'var(--text-1)' : '#E5E5EA';

            const card = document.createElement('div');
            card.className = 'card weather-card';
            card.style.background = bgGradient;
            card.style.borderColor = borderColor;
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.height = '140px';
            card.style.padding = '20px';
            card.style.position = 'relative';
            card.style.overflow = 'hidden';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 2;">
                    <div>
                        <div style="font-size: 20px; font-weight: 600; color: ${tempColor}; letter-spacing: -0.5px;">${loc.name}</div>
                        <div class="live-clock" data-tz="${loc.tz}" style="font-size: 13px; font-weight: 500; color: var(--text-2); margin-top: 4px; font-family: var(--mono);">--:--:--</div>
                    </div>
                    <div style="font-size: 36px; font-weight: 300; color: ${tempColor}; letter-spacing: -2px; margin-top: -6px;">
                        ${temp}°
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; z-index: 2; margin-top: 10px;">
                    <div style="font-size: 12px; font-weight: 500; color: var(--text-2); background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                        ${desc}
                    </div>
                    <div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${icon}</div>
                </div>
                <!-- Ambient Glow -->
                <div style="position: absolute; right: -20px; bottom: -20px; width: 100px; height: 100px; background: ${isDay ? 'rgba(255,204,0,0.1)' : 'rgba(10,132,255,0.1)'}; filter: blur(30px); border-radius: 50%; z-index: 1;"></div>
            `;
            this.container.appendChild(card);
        });
        
        this.updateClocks(); // Initial clock update
    }

    updateClocks() {
        const clockEls = document.querySelectorAll('.live-clock');
        if (!clockEls.length) return;
        
        clockEls.forEach(el => {
            const tz = el.getAttribute('data-tz');
            if (!tz) return;
            
            try {
                const timeString = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).format(new Date());
                
                el.innerText = timeString;
            } catch (e) {
                // Ignore invalid timezones
            }
        });
    }
}

// Instantiate globally
window.weatherApp = new WeatherApp();

// Bind to tab switch
setTimeout(() => {
    // Wait for the renderer to bind the tabs first, then we can hook into it
    setTimeout(() => {
        const segBtns = document.querySelectorAll('.seg-btn[data-target]');
        segBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.getAttribute('data-target') === 'view-weather') {
                    window.weatherApp.init();
                }
            });
        });
    }, 500);
}, 100);
