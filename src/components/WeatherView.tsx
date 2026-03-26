import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Thermometer, Wind, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { getWeatherForecast } from '../lib/gemini';

interface WeatherData {
  forecast: {
    day: string;
    temp: string;
    condition: string;
    impact: string;
  }[];
  summary: string;
}

export function WeatherView({ location }: { location: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      setLoading(true);
      setError(null);
      try {
        const data = await getWeatherForecast(location);
        setWeather(data);
      } catch (err) {
        console.error(err);
        setError("Imeshindwa kupata hali ya hewa. (Failed to load weather.)");
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, [location]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xl">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Inatafuta hali ya hewa... (Fetching weather...)</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 rounded-3xl border-2 border-red-100 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-red-600 text-white rounded-full font-bold"
        >
          Jaribu Tena (Try Again)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-light tracking-tight">{location}</h2>
        <p className="text-sm text-black/40 font-medium uppercase tracking-[0.2em]">3-Day Forecast</p>
      </div>

      <div className="space-y-6">
        <div className="glass p-8 rounded-[32px] apple-shadow text-center">
          <p className="text-xl font-light leading-relaxed text-black/80 italic">
            "{weather?.summary}"
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {weather?.forecast.map((day, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass p-6 rounded-[24px] apple-shadow space-y-4 apple-transition hover:translate-y-[-2px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">{day.day}</span>
                <span className="text-lg font-medium tracking-tight text-apple-blue">{day.temp}</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-light">{day.condition}</div>
                <p className="text-xs text-black/40 leading-relaxed">{day.impact}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
