
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  Activity,
  Bell
} from 'lucide-react';
import { analyzeCoinSignal } from './services/geminiService';
import { fetchMultipleBinancePrices, formatBinanceData } from './services/binanceService';
import { CoinData, RiskLevel, WatchNotification } from './types';
import { CoinDetail } from './components/CoinDetail';
import { WatchSettings } from './components/WatchSettings';
import { NotificationContainer } from './components/NotificationToast';
import { checkAllWatchRules, requestNotificationPermission } from './services/watchService';

// --- Configuration ---
const COINS_CONFIG = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', coingeckoId: 'bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627EEA', coingeckoId: 'ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#14F195', coingeckoId: 'solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', color: '#F3BA2F', coingeckoId: 'binancecoin' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#23292F', coingeckoId: 'ripple' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#0033AD', coingeckoId: 'cardano' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', color: '#E84142', coingeckoId: 'avalanche-2' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#C2A633', coingeckoId: 'dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#E6007A', coingeckoId: 'polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', color: '#2A5ADA', coingeckoId: 'chainlink' },
];

// 코인 로고 URL 가져오기 (CoinGecko 고품질 이미지)
const getCoinLogoUrl = (coin: any): string => {
  const coingeckoId = coin.coingeckoId || coin.id;
  // CoinGecko의 large 이미지 사용 (더 고품질)
  return `https://assets.coingecko.com/coins/images/${getCoinImagePath(coingeckoId)}/large/${coingeckoId}.png`;
};

// CoinGecko 이미지 경로 매핑
const getCoinImagePath = (coingeckoId: string): string => {
  const imagePathMap: Record<string, string> = {
    'bitcoin': '1',
    'ethereum': '279',
    'solana': '4128',
    'binancecoin': '825',
    'ripple': '52',
    'cardano': '975',
    'avalanche-2': '12559',
    'dogecoin': '5',
    'polkadot': '12171',
    'chainlink': '877',
  };
  return imagePathMap[coingeckoId] || '1';
};


function App() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchSettingsOpen, setWatchSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WatchNotification[]>([]);

  useEffect(() => {
    // 브라우저 알림 권한 요청
    requestNotificationPermission();
    
    refreshMarketData();
    
    // 30초마다 실시간 가격 업데이트 및 Watch 체크
    const interval = setInterval(() => {
      refreshMarketData();
    }, 30000); // 30초
    
    return () => clearInterval(interval);
  }, []);

  // 코인 분석 완료 후 Watch 체크
  useEffect(() => {
    if (coins.length > 0 && coins.every(coin => coin.analysis)) {
      checkAllWatchRules(coins, (notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 4)]); // 최대 5개
      });
    }
  }, [coins]);

  const refreshMarketData = async () => {
    setLoading(true);
    
    try {
      // Binance에서 모든 코인 가격 정보 가져오기
      const symbols = COINS_CONFIG.map(config => config.symbol);
      const priceMap = await fetchMultipleBinancePrices(symbols);
    
    const newCoins: CoinData[] = COINS_CONFIG.map(config => {
        const ticker = priceMap.get(config.symbol);
        
        if (!ticker) {
          console.error(`[Binance] ${config.symbol} 가격 데이터를 가져올 수 없습니다.`);
          // 데이터가 없으면 해당 코인을 제외하거나 에러 상태로 표시
          return null;
        }
        
        // Binance 데이터 사용
        const formatted = formatBinanceData(ticker);
        return {
          ...config,
          price: formatted.price,
          change24h: formatted.change24h,
          volume24h: formatted.volume24h,
          marketCap: formatted.marketCap,
          analysis: undefined
        };
    }).filter((coin): coin is CoinData => coin !== null);

    setCoins(newCoins);
    setLoading(false);
    runAIAnalysis(newCoins);
    } catch (error) {
      console.error('Error refreshing market data:', error);
      setLoading(false);
    }
  };

  const [analysisErrors, setAnalysisErrors] = useState<Set<string>>(new Set());

  const runAIAnalysis = async (currentCoins: CoinData[]) => {
    setAnalyzing(true);
    setAnalysisErrors(new Set()); // 에러 상태 초기화
    const updatedCoins = [...currentCoins];
    const newErrors = new Set<string>();
    
    await Promise.all(updatedCoins.map(async (coin, index) => {
      // Staggered delay for effect
      await new Promise(r => setTimeout(r, index * 100));
      const analysis = await analyzeCoinSignal(coin);
      if (analysis) {
        updatedCoins[index] = { ...coin, analysis };
        setCoins([...updatedCoins]);
        
        if (selectedCoin && selectedCoin.id === coin.id) {
          setSelectedCoin({ ...coin, analysis });
        }
      } else {
        // 분석 실패 시 에러 상태로 표시
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        console.error(`[Analysis] ${coin.symbol} 분석 실패 - 데이터 부족`);
        console.error(`[Analysis] 백엔드 서버 확인: ${apiUrl}`);
        updatedCoins[index] = { ...coin, analysis: undefined };
        newErrors.add(coin.id);
        setCoins([...updatedCoins]);
      }
    }));
    setAnalysisErrors(newErrors);
    setAnalyzing(false);
  };

  const filteredCoins = coins.filter(coin => 
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskVisuals = (risk?: RiskLevel) => {
    switch (risk) {
      case 'LOW': return { 
        bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-500', 
        label: 'LOW RISK', icon: ShieldCheck, lightBg: 'bg-emerald-50',
        textColor: 'text-emerald-500'
      };
      case 'MEDIUM': return { 
        bg: 'bg-indigo-400', text: 'text-white', border: 'border-indigo-400',
        label: 'MEDIUM RISK', icon: Activity, lightBg: 'bg-indigo-50',
        textColor: 'text-indigo-500'
      };
      case 'HIGH': return { 
        bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-400',
        label: 'HIGH RISK', icon: AlertTriangle, lightBg: 'bg-orange-50',
        textColor: 'text-orange-500'
      };
      case 'EXTREME': return { 
        bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-500',
        label: 'EXTREME RISK', icon: ShieldAlert, lightBg: 'bg-rose-50',
        textColor: 'text-rose-500'
      };
      default: return { 
        bg: 'bg-slate-300', text: 'text-slate-500', border: 'border-slate-200',
        label: 'ANALYZING', icon: RefreshCw, lightBg: 'bg-slate-50',
        textColor: 'text-slate-400'
      };
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-slate-800 font-sans relative overflow-x-hidden selection:bg-indigo-100">
      
      {/* 3D Background Objects */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl opacity-60 animate-float"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[70vw] h-[70vw] max-w-[500px] max-h-[500px] bg-gradient-to-tr from-blue-200/40 to-teal-200/40 rounded-full blur-3xl opacity-60 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 py-10">
        
        {/* Header */}
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-slate-500 font-semibold text-base tracking-wide mb-0.5">Hello, Investor 👋</h2>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                CoinGuard
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setWatchSettingsOpen(true)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 hover:shadow-md transition-all active:scale-95 relative"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button 
                onClick={refreshMarketData}
                disabled={loading || analyzing}
                className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 transition-all active:scale-95
                  ${loading || analyzing ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}
                `}
              >
                <RefreshCw className={`w-6 h-6 ${loading || analyzing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
               <Search className="h-5 w-5 text-slate-400" />
             </div>
             <input 
                type="text" 
                placeholder="Search coins (e.g. BTC, Solana)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white pl-11 pr-4 py-4 rounded-2xl shadow-sm border border-transparent focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-700 font-medium transition-all placeholder:text-slate-300"
             />
          </div>
        </header>

        {/* Crypto Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          {filteredCoins.length > 0 ? (
            filteredCoins.map((coin, index) => {
              const visuals = getRiskVisuals(coin.analysis?.riskLevel);
              const Icon = visuals.icon;
              const isPositive = coin.change24h >= 0;
              
              return (
                <div 
                  key={coin.id}
                  onClick={() => setSelectedCoin(coin)}
                  className="
                    group relative bg-white rounded-[2rem] p-5 cursor-pointer
                    shadow-clay hover:shadow-clay-hover transition-all duration-300 transform hover:-translate-y-1
                    border border-white/60
                    flex flex-col gap-4
                  "
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Card Header: Icon+Name vs Price */}
                  <div className="flex justify-between items-start">
                    {/* Left: Icon & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-inner-soft shrink-0 overflow-hidden border border-slate-100 p-1">
                        <img 
                          src={getCoinLogoUrl(coin)} 
                          alt={coin.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            // 이미지 로드 실패 시 폴백
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span style="color: ${(coin as any).color}; font-size: 1.25rem; font-weight: bold;">${coin.symbol[0]}</span>`;
                            }
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-slate-800 tracking-tight leading-none mb-0.5">{coin.name}</h3>
                        <p className="text-slate-400 font-medium text-xs tracking-wide">{coin.symbol} / USD</p>
                      </div>
                    </div>

                    {/* Right: Price */}
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-slate-800">
                        ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-0.5 ${
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {isPositive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {coin.change24h > 0 ? '+' : ''}{coin.change24h}%
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Guideline Bubble */}
                  <div className={`relative ${visuals.lightBg} rounded-2xl p-4 border border-slate-100/50`}>
                    <div className={`absolute -top-3 left-4 px-3 py-1 bg-white rounded-full border border-slate-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${visuals.textColor}`}>
                      <Icon className="w-3.5 h-3.5" /> 
                      {coin.analysis ? visuals.label : 'ANALYZING'}
                    </div>
                    
                    {coin.analysis ? (
                      <div className="mt-2 animate-fade-in-up">
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed line-clamp-2">
                          {coin.analysis.analysisSummary 
                            ? `"${coin.analysis.analysisSummary}"`
                            : `"${coin.analysis.actionGuide}"`}
                        </p>
                      </div>
                    ) : analyzing && !analysisErrors.has(coin.id) ? (
                      <div className="mt-2 flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                          분석 중...
                        </p>
                      </div>
                    ) : analysisErrors.has(coin.id) ? (
                      <div className="mt-2">
                        <p className="text-xs text-rose-500 font-semibold leading-relaxed">
                          현재 데이터를 가져올 수 없어 분석할 수 없습니다.
                        </p>
                      </div>
                    ) : null}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-slate-400">
               <Search className="w-12 h-12 mb-4 opacity-20" />
               <p className="text-lg font-bold">No coins found matching "{searchQuery}"</p>
               <p className="text-sm opacity-60 mt-1">Try searching for Bitcoin, ETH, or Solana.</p>
            </div>
          )}
        </div>

        {/* Fullscreen Detail View */}
        {selectedCoin && (
          <CoinDetail 
            coin={selectedCoin} 
            onBack={() => setSelectedCoin(null)} 
          />
        )}

      </div>

      {/* Watch Settings Modal */}
      <WatchSettings
        isOpen={watchSettingsOpen}
        onClose={() => setWatchSettingsOpen(false)}
        availableCoins={COINS_CONFIG.map(c => ({ symbol: c.symbol, name: c.name }))}
      />

      {/* Notification Toast Container */}
      <NotificationContainer
        notifications={notifications}
        onClose={(id) => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }}
        onNotificationClick={(notification) => {
          const coin = coins.find(c => c.symbol === notification.coinSymbol);
          if (coin) {
            setSelectedCoin(coin);
            setWatchSettingsOpen(false);
          }
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }}
      />
    </div>
  );
}

export default App;
