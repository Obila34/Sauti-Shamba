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
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight uppercase">{location}</h2>
            <p className="opacity-80 font-medium">Utabiri wa siku 3 (3-Day Forecast)</p>
          </div>
          <Cloud className="w-12 h-12 opacity-50" />
        </div>
        <p className="text-lg font-medium leading-tight">{weather?.summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {weather?.forecast.map((day, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-2xl shadow-md border border-blue-50"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="font-black text-blue-600 uppercase text-sm">{day.day}</span>
              {day.condition.toLowerCase().includes('rain') ? <CloudRain className="text-blue-400" /> : <Sun className="text-yellow-500" />}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-gray-400" />
              <span className="text-2xl font-black text-gray-800">{day.temp}</span>
            </div>
            <p className="text-sm font-bold text-gray-600 mb-2">{day.condition}</p>
            <div className="bg-blue-50 p-3 rounded-xl">
              <p className="text-xs text-blue-800 leading-tight font-medium">
                <span className="font-bold uppercase block mb-1 text-[10px]">Ushauri (Advice):</span>
                {day.impact}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
