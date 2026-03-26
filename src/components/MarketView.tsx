import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { getMarketPrices } from '../lib/gemini';

interface MarketPrice {
  crop: string;
  price: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  market: string;
  change?: string;
}

export function MarketView() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMarketPrices();
        setPrices(data);
      } catch (err) {
        console.error(err);
        setError("Imeshindwa kupata bei za soko. (Failed to load market prices.)");
      } finally {
        setLoading(false);
      }
    }
    fetchPrices();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xl">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Inatafuta bei za soko... (Fetching market prices...)</p>
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
        <h2 className="text-4xl font-light tracking-tight">Market Prices</h2>
        <p className="text-sm text-black/40 font-medium uppercase tracking-[0.2em]">Real-time Kenyan Markets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prices.map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass p-6 rounded-[24px] apple-shadow flex items-center justify-between apple-transition hover:translate-y-[-2px]"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">{item.market}</span>
              <h3 className="text-xl font-light">{item.crop}</h3>
              <div className="text-sm font-medium text-apple-blue">{item.price}</div>
            </div>
            <div className="text-right space-y-1">
              <div className={`text-xs font-bold tracking-widest ${
                item.trend === 'UP' ? 'text-red-500' : 
                item.trend === 'DOWN' ? 'text-green-500' : 'text-black/20'
              }`}>
                {item.trend}
              </div>
              <div className="text-[10px] text-black/30">{item.change}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
