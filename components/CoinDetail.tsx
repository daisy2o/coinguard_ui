
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  MessageCircle, 
  Wallet, 
  Activity, 
  Smile,
  Meh,
  Frown,
  Share2,
  ExternalLink,
  ShieldCheck,
  Info,
  RefreshCw,
  Languages
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CoinData, PricePoint, NewsItem, SocialPost, OnChainMetric, SentimentType, AnalysisStats } from '../types';
import { fetchBinancePriceHistory, TimeFrame, CandleData } from '../services/binanceService';
import { fetchLatestData, NewsItemResponse, SocialItemResponse, fetchCoinMarketData, convertToOnChainMetric } from '../services/sentimentService';
import { translateToKorean, detectLanguage } from '../services/translationService';

interface Props {
  coin: CoinData;
  onBack: () => void;
}

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

// 코인 로고 URL 가져오기 (CoinGecko 고품질 이미지)
const getCoinLogoUrl = (coin: any): string => {
  const coingeckoId = coin.coingeckoId || coin.id;
  // CoinGecko의 large 이미지 사용 (더 고품질)
  return `https://assets.coingecko.com/coins/images/${getCoinImagePath(coingeckoId)}/large/${coingeckoId}.png`;
};

// --- Data Generators that respect Stats ---

const generateHistory = (basePrice: number): CandleData[] => {
  const data: CandleData[] = [];
  let currentPrice = basePrice * 0.9;
  for (let i = 0; i < 24; i++) {
    const change = (Math.random() * 0.04 - 0.015);
    const open = currentPrice;
    currentPrice = currentPrice * (1 + change);
    const close = currentPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    data.push({ 
      time: `${i}:00`, 
      open,
      high,
      low,
      close
    });
  }
  return data;
};


const SentimentBar = ({ positive, neutral, negative }: { positive: number, neutral: number, negative: number }) => {
  const total = positive + neutral + negative;
  const posPct = total ? Math.round((positive / total) * 100) : 0;
  const neuPct = total ? Math.round((neutral / total) * 100) : 0;
  const negPct = total ? Math.round((negative / total) * 100) : 0;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3 h-3 text-indigo-500" /> Sentiment (24h)
        </h4>
      </div>
      
      <div className="h-2.5 w-full flex rounded-full overflow-hidden bg-slate-100 mb-3">
        <div style={{ width: `${posPct}%` }} className="bg-emerald-400 h-full" />
        <div style={{ width: `${neuPct}%` }} className="bg-slate-300 h-full" />
        <div style={{ width: `${negPct}%` }} className="bg-rose-400 h-full" />
      </div>

      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1 text-emerald-600"><Smile className="w-3 h-3" /> {posPct}%</div>
        <div className="flex items-center gap-1 text-slate-400"><Meh className="w-3 h-3" /> {neuPct}%</div>
        <div className="flex items-center gap-1 text-rose-500"><Frown className="w-3 h-3" /> {negPct}%</div>
      </div>
    </div>
  );
};

export const CoinDetail: React.FC<Props> = ({ coin, onBack }) => {
  const [activeTab, setActiveTab] = useState<'news' | 'social' | 'onchain'>('news');
  const [historyData, setHistoryData] = useState<CandleData[]>([]);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [socialList, setSocialList] = useState<SocialPost[]>([]);
  const [onChainData, setOnChainData] = useState<OnChainMetric | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1min');
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [loadingOnChain, setLoadingOnChain] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [socialError, setSocialError] = useState(false);
  const [onChainError, setOnChainError] = useState(false);
  
  // 번역 상태 관리: 각 항목 ID별로 번역 상태 저장
  const [newsTranslations, setNewsTranslations] = useState<Map<string, { translated: string; isTranslating: boolean }>>(new Map());
  const [socialTranslations, setSocialTranslations] = useState<Map<string, { translated: string; isTranslating: boolean }>>(new Map());

  // 시간대별 데이터 가져오기
  useEffect(() => {
    const loadPriceHistory = async () => {
      setLoadingChart(true);
      try {
        const data = await fetchBinancePriceHistory(coin.symbol, timeFrame);
        if (data.length > 0) {
          setHistoryData(data);
        } else {
          // Binance 데이터를 가져오지 못한 경우 폴백
          setHistoryData(generateHistory(coin.price));
        }
      } catch (error) {
        console.error('Error loading price history:', error);
        setHistoryData(generateHistory(coin.price));
      } finally {
        setLoadingChart(false);
      }
    };
    
    loadPriceHistory();
  }, [coin.symbol, timeFrame]);

  // 번역 함수
  const handleTranslateNews = async (newsId: string, text: string) => {
    // 이미 번역 중이거나 번역된 경우 무시
    const current = newsTranslations.get(newsId);
    if (current?.isTranslating || current?.translated) {
      return;
    }

    // 언어 감지
    const detectedLang = detectLanguage(text);
    if (detectedLang !== 'en') {
      return; // 영어가 아니면 번역하지 않음
    }

    // 번역 시작
    setNewsTranslations(prev => {
      const newMap = new Map(prev);
      newMap.set(newsId, { translated: '', isTranslating: true });
      return newMap;
    });

    try {
      console.log('[CoinDetail] 뉴스 번역 시작:', text.substring(0, 50));
      const translated = await translateToKorean(text);
      console.log('[CoinDetail] 뉴스 번역 완료:', translated.substring(0, 50));
      
      // 번역 결과가 원문과 다르고 비어있지 않은지 확인
      if (translated && translated.trim() !== '' && translated.trim() !== text.trim()) {
        setNewsTranslations(prev => {
          const newMap = new Map(prev);
          newMap.set(newsId, { translated, isTranslating: false });
          return newMap;
        });
      } else {
        console.error('[CoinDetail] 번역 결과가 유효하지 않습니다:', translated);
        throw new Error('Invalid translation result');
      }
    } catch (error) {
      console.error('[CoinDetail] 번역 실패:', error);
      setNewsTranslations(prev => {
        const newMap = new Map(prev);
        newMap.delete(newsId);
        return newMap;
      });
      // 사용자에게 알림 (선택사항)
      alert('번역에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleTranslateSocial = async (postId: string, text: string) => {
    // 이미 번역 중이거나 번역된 경우 무시
    const current = socialTranslations.get(postId);
    if (current?.isTranslating || current?.translated) {
      return;
    }

    // 언어 감지
    const detectedLang = detectLanguage(text);
    if (detectedLang !== 'en') {
      return; // 영어가 아니면 번역하지 않음
    }

    // 번역 시작
    setSocialTranslations(prev => {
      const newMap = new Map(prev);
      newMap.set(postId, { translated: '', isTranslating: true });
      return newMap;
    });

    try {
      console.log('[CoinDetail] 소셜 번역 시작:', text.substring(0, 50));
      const translated = await translateToKorean(text);
      console.log('[CoinDetail] 소셜 번역 완료:', translated.substring(0, 50));
      
      // 번역 결과가 원문과 다르고 비어있지 않은지 확인
      if (translated && translated.trim() !== '' && translated.trim() !== text.trim()) {
        setSocialTranslations(prev => {
          const newMap = new Map(prev);
          newMap.set(postId, { translated, isTranslating: false });
          return newMap;
        });
      } else {
        console.error('[CoinDetail] 번역 결과가 유효하지 않습니다:', translated);
        throw new Error('Invalid translation result');
      }
    } catch (error) {
      console.error('[CoinDetail] 번역 실패:', error);
      setSocialTranslations(prev => {
        const newMap = new Map(prev);
        newMap.delete(postId);
        return newMap;
      });
      // 사용자에게 알림 (선택사항)
      alert('번역에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 시간 포맷팅 헬퍼 함수
  const formatTimeAgo = (date: Date | string | undefined): string => {
    if (!date) return '알 수 없음';
    const now = new Date();
    const published = new Date(date);
    const diffMs = now.getTime() - published.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}일 전`;
    } else if (diffHours > 0) {
      return `${diffHours}시간 전`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}분 전`;
    } else {
      return '방금 전';
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const stats = coin.analysis?.stats;
      
      console.log(`[CoinDetail] ${coin.symbol} 데이터 로딩 시작...`);
      
      // API에서 최신 데이터 가져오기
      const [newsData, socialData, coinMarketData] = await Promise.all([
        fetchLatestData(coin.symbol, 'news', 1, 20).catch(err => {
          console.error(`[CoinDetail] fetchLatestData(news) 실패:`, err);
          return null;
        }),
        fetchLatestData(coin.symbol, 'social', 1, 20).catch(err => {
          console.error(`[CoinDetail] fetchLatestData(social) 실패:`, err);
          return null;
        }),
        fetchCoinMarketData(coin.symbol).catch(err => {
          console.error(`[CoinDetail] fetchCoinMarketData 실패:`, err);
          return null;
        })
      ]);
      
      console.log(`[CoinDetail] API 응답:`, {
        news: newsData ? `${newsData.data.length}개` : '실패',
        social: socialData ? `${socialData.data.length}개` : '실패',
        market: coinMarketData ? '성공' : '실패'
      });
      
      // 뉴스 데이터 변환
      if (newsData && newsData.data.length > 0) {
        console.log(`[CoinDetail] 실제 뉴스 데이터 사용: ${newsData.data.length}개`);
        const newsItems: NewsItem[] = newsData.data.map((item: NewsItemResponse) => ({
          id: item.id,
          title: item.title,
          source: item.provider || item.source_type || 'Unknown',
          time: formatTimeAgo(item.published_at),
          sentiment: item.sentiment || 'neutral',
          url: item.url
        }));
        setNewsList(newsItems);
      } else {
        console.error(`[CoinDetail] 뉴스 데이터를 가져올 수 없습니다.`);
        setNewsList([]);
      }
      
      // 소셜 데이터 변환
      if (socialData && socialData.data.length > 0) {
        console.log(`[CoinDetail] 실제 소셜 데이터 사용: ${socialData.data.length}개`);
        const socialItems: SocialPost[] = socialData.data.map((item: SocialItemResponse) => ({
          id: item.id,
          user: item.author_handle || item.author || item.author_name || '@unknown',
          text: item.content || item.title || '',
          time: formatTimeAgo(item.published_at),
          sentiment: item.sentiment || 'neutral',
          likes: item.score || item.num_comments || 0
        }));
        setSocialList(socialItems);
      } else {
        console.error(`[CoinDetail] 소셜 데이터를 가져올 수 없습니다.`);
        setSocialList([]);
      }
      
      // 온체인 데이터 설정 (CoinGecko 데이터 사용)
      if (coinMarketData) {
        console.log(`[CoinDetail] 실제 CoinGecko 온체인 데이터 사용`);
        const onChainMetric = convertToOnChainMetric(coinMarketData);
        setOnChainData(onChainMetric);
      } else {
        console.error(`[CoinDetail] 온체인 데이터를 가져올 수 없습니다.`);
        setOnChainData(null);
      }
      
      window.scrollTo(0, 0);
    };
    
    loadData();
  }, [coin]);

  const isPositive = coin.change24h >= 0;
  
  // 차트 데이터 기반으로 상승/하락 판단 (1분 차트용)
  const chartIsPositive = historyData.length > 0 && timeFrame === '1min'
    ? historyData[historyData.length - 1].close >= historyData[0].close
    : isPositive;
  
  // 차트 색상 결정: 오름 = 빨간색, 내림 = 파란색 (1분 차트용)
  const chartColor = chartIsPositive ? '#ef4444' : '#3b82f6';
  
  // 캔들 차트용 커스텀 Shape 컴포넌트
  const CandleShape = (props: any) => {
    const { x, y, width, payload, yAxis } = props;
    if (!payload) return null;
    
    const { open, high, low, close } = payload;
    const isUp = close >= open;
    const color = isUp ? '#ef4444' : '#3b82f6'; // 상승: 빨간색, 하락: 파란색
    
    // Y축 스케일 계산
    let getY: (value: number) => number;
    
    if (yAxis && yAxis.scale) {
      // Recharts의 내부 스케일 사용
      getY = (value: number) => yAxis.scale(value);
    } else {
      // 폴백: 수동 계산
      const min = Math.min(...historyData.map(d => d.low));
      const max = Math.max(...historyData.map(d => d.high));
      const range = max - min || 1;
      const chartHeight = 250;
      const padding = 20;
      getY = (value: number) => {
        return ((max - value) / range) * (chartHeight - padding * 2) + padding;
      };
    }
    
    const openY = getY(open);
    const closeY = getY(close);
    const highY = getY(high);
    const lowY = getY(low);
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeightPx = Math.abs(closeY - openY) || 1;
    
    return (
      <g>
        {/* 심지 (위) */}
        <line
          x1={x + width / 2}
          y1={highY}
          x2={x + width / 2}
          y2={bodyTop}
          stroke={color}
          strokeWidth={1.5}
        />
        {/* 몸통 */}
        <rect
          x={x + width * 0.2}
          y={bodyTop}
          width={width * 0.6}
          height={bodyHeightPx}
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
        {/* 심지 (아래) */}
        <line
          x1={x + width / 2}
          y1={bodyBottom}
          x2={x + width / 2}
          y2={lowY}
          stroke={color}
          strokeWidth={1.5}
        />
      </g>
    );
  };
  const countSentiment = (items: { sentiment: SentimentType }[]) => {
    return items.reduce((acc, item) => { acc[item.sentiment]++; return acc; }, { positive: 0, neutral: 0, negative: 0 });
  };
  const newsStats = countSentiment(newsList);
  const socialStats = countSentiment(socialList);

  return (
    <div className="fixed inset-0 z-50 bg-[#F2F4F8] overflow-y-auto animate-fade-in-up">
      <div className="max-w-7xl mx-auto px-5 py-8 min-h-screen flex flex-col">
        
        {/* Nav */}
        <div className="flex justify-between items-center mb-8">
            <button 
              onClick={onBack} 
              className="w-12 h-12 rounded-2xl bg-white shadow-clay flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all border border-slate-100 hover:scale-105 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-right">
                <button className="w-12 h-12 rounded-2xl bg-white shadow-clay flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all border border-slate-100">
                    <Share2 className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Header Info */}
        <div className="flex justify-between items-end mb-8">
            <div>
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100 overflow-hidden p-1">
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
                               parent.innerHTML = `<span style="color: ${(coin as any).color}; font-size: 1.5rem; font-weight: bold;">${coin.symbol[0]}</span>`;
                             }
                           }}
                         />
                      </div>
                  <span className="text-xl font-bold text-slate-400 tracking-wide">{coin.symbol} / USD</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-none">{coin.name}</h1>
            </div>
            <div className="text-right">
               <div className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                  ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </div>
               <div className={`text-base font-bold flex items-center justify-end gap-1 px-3 py-1 rounded-xl mt-2 ${isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {coin.change24h > 0 ? '+' : ''}{coin.change24h}%
               </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
              
            {/* Left Col: Chart & AI */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Chart */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-clay border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-500"/> PRICE ACTION
                    </h3>
                    {/* 시간대 선택 버튼 */}
                    <div className="flex gap-2">
                      {(['1min', '1h', '1d', '1w', '1m'] as TimeFrame[]).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeFrame(tf)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            timeFrame === tf
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {tf === '1min' ? '1분' : tf === '1h' ? '1시간' : tf === '1d' ? '1일' : tf === '1w' ? '1주' : '1월'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    {loadingChart ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-slate-400 font-bold">로딩 중...</div>
                      </div>
                    ) : timeFrame === '1min' ? (
                      // 1분 차트: 일반 Area 차트
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData.map(d => ({ time: d.time, price: d.close }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPriceFull" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chartColor} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            interval={5}
                            minTickGap={30}
                            tickFormatter={(value: string) => {
                              const parts = value.split(':');
                              if (parts.length === 2) {
                                const minutes = parseInt(parts[1]);
                                // 5분 간격으로 표시 (00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
                                if (minutes % 5 === 0) {
                                  return value; // 5분 간격으로 표시
                                }
                              }
                              return '';
                            }}
                          />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke={chartColor} 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorPriceFull)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      // 나머지 차트: 캔들 차트
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            interval={timeFrame === '1h' ? 1 : timeFrame === '1d' ? 2 : timeFrame === '1w' ? 0 : 0}
                            minTickGap={50}
                            tickFormatter={(value: string, index: number) => {
                              // 1시간 차트: 시간 표시 (HH:00 형식)
                              if (timeFrame === '1h') {
                                return value; // "00:00", "01:00" 등
                              }
                              // 1달 차트: 모든 달 표시
                              if (timeFrame === '1m') {
                                return value; // 모든 MM 형식 표시
                              }
                              // 1일, 1주 차트: 날짜 표시 (MM/DD 형식, 중복 제거)
                              if (timeFrame === '1d' || timeFrame === '1w') {
                                // 같은 날짜가 연속으로 나오면 첫 번째만 표시
                                if (index === 0 || (index > 0 && historyData[index - 1]?.time !== value)) {
                                  return value;
                                }
                                return ''; // 중복 날짜는 표시하지 않음
                              }
                              return value;
                            }}
                          />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'transparent', border: 'none', padding: 0, boxShadow: 'none' }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length > 0) {
                                const data = payload[0].payload as CandleData;
                                const { open, high, low, close } = data;
                                const isUp = close >= open;
                                const change = close - open;
                                const changePercent = ((change / open) * 100).toFixed(2);
                                
                                // 한국 시장 색상: 상승=빨간색, 하락=파란색
                                const upColor = '#ef4444'; // 빨간색
                                const downColor = '#3b82f6'; // 파란색
                                
                                return (
                                  <div className="bg-white rounded-2xl p-4 shadow-clay border border-slate-100 min-w-[200px]">
                                    <p className="text-slate-500 font-bold mb-3 text-xs uppercase tracking-wider">{`시간: ${label}`}</p>
                                    <div className="space-y-2.5">
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-semibold">시가:</span>
                                        <span className="text-slate-800 font-bold text-xs">${open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-semibold">고가:</span>
                                        <span className="text-slate-800 font-bold text-xs">${high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-semibold">저가:</span>
                                        <span className="text-slate-800 font-bold text-xs">${low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-2.5">
                                        <span className="text-slate-400 text-xs font-semibold">종가:</span>
                                        <span className={`font-bold text-xs`} style={{ color: isUp ? upColor : downColor }}>
                                          ${close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-semibold">변동:</span>
                                        <span className={`font-bold text-xs`} style={{ color: isUp ? upColor : downColor }}>
                                          {change > 0 ? '+' : ''}{change.toFixed(2)} ({changePercent}%)
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {/* 캔들 차트를 위한 Bar (high 값을 기준으로 하되 커스텀 Shape 사용) */}
                          <Bar 
                            dataKey="high" 
                            shape={(props: any) => {
                              const { x, y, width, payload } = props;
                              if (!payload) return null;
                              
                              const { open, high, low, close } = payload;
                              const isUp = close >= open;
                              const upColor = '#ef4444'; // 상승: 빨간색
                              const downColor = '#3b82f6'; // 하락: 파란색
                              const color = isUp ? upColor : downColor;
                              
                              // Y축 스케일 계산 (Recharts의 실제 좌표계 사용)
                              const min = Math.min(...historyData.map(d => d.low));
                              const max = Math.max(...historyData.map(d => d.high));
                              const range = max - min || 1;
                              const chartHeight = 230; // 실제 차트 높이
                              const yMin = 10; // top margin
                              const yMax = chartHeight + yMin;
                              
                              const getY = (value: number) => {
                                return yMin + ((max - value) / range) * (yMax - yMin);
                              };
                              
                              const openY = getY(open);
                              const closeY = getY(close);
                              const highY = getY(high);
                              const lowY = getY(low);
                              const bodyTop = Math.min(openY, closeY);
                              const bodyBottom = Math.max(openY, closeY);
                              const bodyHeight = Math.abs(closeY - openY) || 2;
                              
                              // 캔들 너비 계산 (데이터 포인트 수에 따라 조정)
                              const candleWidth = Math.max(3, Math.min(10, width * 0.7));
                              const centerX = x + width / 2;
                              
                              return (
                                <g className="candle-group" style={{ cursor: 'pointer' }}>
                                  {/* 심지 (위) */}
                                  <line
                                    x1={centerX}
                                    y1={highY}
                                    x2={centerX}
                                    y2={bodyTop}
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                  />
                                  {/* 몸통 */}
                                  <rect
                                    x={centerX - candleWidth / 2}
                                    y={bodyTop}
                                    width={candleWidth}
                                    height={bodyHeight}
                                    fill={isUp ? upColor : 'transparent'}
                                    stroke={color}
                                    strokeWidth={isUp ? 0 : 2}
                                    rx={0.5}
                                  />
                                  {/* 심지 (아래) */}
                                  <line
                                    x1={centerX}
                                    y1={bodyBottom}
                                    x2={centerX}
                                    y2={lowY}
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                  />
                                </g>
                              );
                            }}
                            isAnimationActive={false}
                            fill="transparent"
                          />
                          {/* 툴팁용 투명 Bar (open, low, close) */}
                          <Bar dataKey="open" fill="transparent" />
                          <Bar dataKey="low" fill="transparent" />
                          <Bar dataKey="close" fill="transparent" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* AI Safety Analysis - IMPROVED GLASS LAYOUT */}
                <div className="relative overflow-hidden bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200">
                  <div className="relative z-10 flex flex-col gap-6">
                      {/* 1. Header & Risk Metrics (Stacked Left) */}
                      <div>
                          <div className="flex items-center gap-2 mb-4 opacity-90">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse"></div> 
                              <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">RISK GUARD ANALYSIS</span>
                          </div>
                          
                          <div className="flex flex-col gap-5">
                             {coin.analysis ? (
                               <>
                                 {/* Level Badge */}
                                 <div className="self-start inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
                                    <Info className="w-3.5 h-3.5 text-indigo-100" />
                                    <span className="text-xs font-bold text-indigo-50">
                                      Risk Level: {coin.analysis.riskScore === -1 ? '계산 불가' : coin.analysis.riskLevel}
                                    </span>
                                 </div>

                                 {/* Risk Score - Large Display */}
                                 {coin.analysis.riskScore === -1 ? (
                                   <div className="flex items-center gap-3">
                                     <span className="text-2xl font-bold text-slate-300">
                                       데이터를 가져올 수 없어 리스크 점수를 계산할 수 없습니다
                                     </span>
                                   </div>
                                 ) : (
                                   <div className="flex items-end gap-3">
                                      <span className="text-5xl font-black text-white leading-none tracking-tighter shadow-sm">
                                          {coin.analysis.riskScore}
                                      </span>
                                      <div className="pb-2">
                                          <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider block mb-1.5">Risk Score / 100</span>
                                          <div className="w-32 h-2 bg-black/20 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                  coin.analysis.riskScore > 70 ? 'bg-rose-400' : 
                                                  coin.analysis.riskScore > 40 ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`} 
                                                style={{width: `${coin.analysis.riskScore}%`}}
                                              />
                                          </div>
                                      </div>
                                   </div>
                                 )}
                               </>
                             ) : (
                               <div className="space-y-3">
                                 <div className="self-start inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
                                    <Info className="w-3.5 h-3.5 text-indigo-100" />
                                    <span className="text-xs font-bold text-indigo-50">현재 계산 불가</span>
                                 </div>
                                 <p className="text-sm text-indigo-50/80">
                                    데이터를 가져올 수 없어 리스크 점수를 계산할 수 없습니다.
                                 </p>
                               </div>
                             )}
                          </div>
                      </div>

                      {/* 2. Safety Guidelines */}
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                         <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1">Safety Guidelines</h4>
                                <p className="text-sm text-indigo-50 font-medium leading-relaxed">
                                  {coin.analysis?.analysisSummary 
                                    ? `"${coin.analysis.analysisSummary}"`
                                    : coin.analysis?.actionGuide 
                                      ? `"${coin.analysis.actionGuide}"`
                                      : '"Gathering safety data..."'}
                                </p>
                            </div>
                         </div>
                      </div>

                  </div>
                  
                  {/* Background Blobs */}
                  <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-purple-500 rounded-full blur-[100px] opacity-40 animate-pulse"></div>
                  <div className="absolute bottom-[-50%] left-[-10%] w-[300px] h-[300px] bg-blue-500 rounded-full blur-[100px] opacity-40 animate-pulse" style={{animationDelay: '2s'}}></div>
                </div>
            </div>

            {/* Right Col: Tabs */}
            <div className="lg:col-span-1 flex flex-col">
                <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 flex mb-6">
                   {(['news', 'social', 'onchain'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-4 rounded-3xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          activeTab === tab 
                            ? 'bg-slate-800 text-white shadow-md transform scale-105' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {tab === 'news' && <Globe className="w-4 h-4" />}
                        {tab === 'social' && <MessageCircle className="w-4 h-4" />}
                        {tab === 'onchain' && <Wallet className="w-4 h-4" />}
                        {tab}
                      </button>
                   ))}
                </div>

                <div className="flex-1 overflow-visible">
                  {activeTab === 'news' && (
                      <div className="animate-fade-in-up space-y-4">
                        {loadingNews ? (
                          <div className="text-center py-12 text-slate-400">
                            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
                            <p className="font-bold text-slate-500">뉴스 데이터를 불러오는 중...</p>
                          </div>
                        ) : newsList.length > 0 ? (
                          <>
                            <SentimentBar positive={newsStats.positive} neutral={newsStats.neutral} negative={newsStats.negative} />
                            {newsList.map(news => (
                          <a 
                            key={news.id} 
                            href={news.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer group"
                          >
                              <div className="flex justify-between mb-2">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                                    news.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600' :
                                    news.sentiment === 'negative' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                                }`}>{news.sentiment}</span>
                                <div className="flex items-center gap-2">
                                  {detectLanguage(news.title) === 'en' && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleTranslateNews(news.id, news.title);
                                      }}
                                      className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
                                      title="번역"
                                    >
                                      {newsTranslations.get(news.id)?.isTranslating ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Languages className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1 group-hover:text-indigo-500 transition-colors">
                                      {news.time} <ExternalLink className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                              <h4 className="font-bold text-slate-700 leading-snug mb-3 group-hover:text-indigo-600 transition-colors">{news.title}</h4>
                              {newsTranslations.get(news.id)?.translated && (
                                <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                  <p className="text-sm text-indigo-700 leading-relaxed">{newsTranslations.get(news.id)?.translated}</p>
                                </div>
                              )}
                              <div className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1">
                                 {news.source === 'Naver Finance' ? (
                                    <span className="text-emerald-500">네이버 금융</span>
                                 ) : news.source}
                              </div>
                          </a>
                            ))}
                          </>
                        ) : newsError ? (
                          <div className="text-center py-12 text-slate-400">
                            <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-bold text-slate-500">뉴스 데이터를 가져올 수 없습니다</p>
                            <p className="text-sm mt-2">API 연결을 확인해주세요.</p>
                          </div>
                        ) : null}
                      </div>
                  )}

                  {activeTab === 'social' && (
                      <div className="animate-fade-in-up space-y-4">
                        {loadingSocial ? (
                          <div className="text-center py-12 text-slate-400">
                            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
                            <p className="font-bold text-slate-500">소셜 데이터를 불러오는 중...</p>
                          </div>
                        ) : socialList.length > 0 ? (
                          <>
                            <SentimentBar positive={socialStats.positive} neutral={socialStats.neutral} negative={socialStats.negative} />
                            {socialList.map(post => (
                          <div key={post.id} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold">
                                  {post.user[1]}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{post.user}</div>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                  {detectLanguage(post.text) === 'en' && (
                                    <button
                                      onClick={() => handleTranslateSocial(post.id, post.text)}
                                      className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
                                      title="번역"
                                    >
                                      {socialTranslations.get(post.id)?.isTranslating ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Languages className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-xs text-slate-400 font-medium">{post.time}</span>
                                </div>
                              </div>
                              <p className="text-slate-600 font-medium leading-relaxed mb-4">
                                "{post.text}"
                              </p>
                              {socialTranslations.get(post.id)?.translated && (
                                <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100 mb-4">
                                  <p className="text-sm text-indigo-700 leading-relaxed">"{socialTranslations.get(post.id)?.translated}"</p>
                                </div>
                              )}
                              <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                                <span className={`text-xs font-black ${
                                    post.sentiment === 'positive' ? 'text-emerald-500' : 'text-rose-500'
                                }`}>#{post.sentiment}</span>
                                <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                  <Activity className="w-4 h-4"/> {post.likes}
                                </span>
                              </div>
                          </div>
                            ))}
                          </>
                        ) : socialError ? (
                          <div className="text-center py-12 text-slate-400">
                            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-bold text-slate-500">소셜 데이터를 가져올 수 없습니다</p>
                            <p className="text-sm mt-2">API 연결을 확인해주세요.</p>
                          </div>
                        ) : null}
                      </div>
                  )}

                  {activeTab === 'onchain' && (
                      <>
                        {loadingOnChain ? (
                          <div className="text-center py-12 text-slate-400">
                            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
                            <p className="font-bold text-slate-500">온체인 데이터를 불러오는 중...</p>
                          </div>
                        ) : onChainData ? (
                          <div className="space-y-4 animate-fade-in-up">
                        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                            <div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Market Volume Share (24h)</div>
                              <div className={`text-3xl font-black ${onChainData.volume_percentage > 5 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {onChainData.volume_percentage.toFixed(2)}%
                              </div>
                              <div className="mt-3 text-xs font-bold px-3 py-1 bg-slate-50 rounded-xl inline-block text-slate-500">
                                  {onChainData.volume_percentage > 20 ? 'High Market Share' : onChainData.volume_percentage < 2 ? 'Low Market Share' : 'Normal Share'}
                              </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">24h Volume</div>
                              <div className="text-xl font-black text-slate-700">
                                ${(onChainData.volume_24h_usd / 1e9).toFixed(2)}B
                              </div>
                              <div className="text-xs text-slate-400 font-bold mt-1">USD</div>
                          </div>
                          <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Market Volume</div>
                              <div className="text-xl font-black text-slate-700">
                                ${(onChainData.total_market_volume_usd / 1e9).toFixed(2)}B
                              </div>
                              <div className="text-xs text-slate-400 font-bold mt-1">All Markets</div>
                          </div>
                        </div>
                          </div>
                        ) : onChainError ? (
                          <div className="text-center py-12 text-slate-400">
                            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-bold text-slate-500">온체인 데이터를 가져올 수 없습니다</p>
                            <p className="text-sm mt-2">API 연결을 확인해주세요.</p>
                          </div>
                        ) : null}
                      </>
                  )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
