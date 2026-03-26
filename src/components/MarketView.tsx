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
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight uppercase">Bei za Soko (Market Prices)</h2>
            <p className="opacity-80 font-medium">Soko kuu nchini Kenya leo (Major markets in Kenya today)</p>
          </div>
          <ShoppingBag className="w-12 h-12 opacity-50" />
        </div>
        <div className="flex items-center gap-2 text-sm font-bold bg-white/20 w-fit px-3 py-1 rounded-full">
          <RefreshCw className="w-3 h-3" />
          Imesasishwa Leo (Updated Today)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prices.map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-5 rounded-2xl shadow-md border border-green-50 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 font-black text-xl">
                {item.crop[0]}
              </div>
              <div>
                <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">{item.crop}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase">{item.market}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-green-600">{item.price}</div>
              <div className={`flex items-center justify-end gap-1 text-xs font-bold ${
                item.trend === 'UP' ? 'text-red-500' : 
                item.trend === 'DOWN' ? 'text-green-500' : 
                'text-gray-400'
              }`}>
                {item.trend === 'UP' ? <TrendingUp className="w-3 h-3" /> : 
                 item.trend === 'DOWN' ? <TrendingDown className="w-3 h-3" /> : null}
                {item.trend} {item.change && `(${item.change})`}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
