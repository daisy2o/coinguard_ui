// Sentiment API 서비스

// VITE_API_URL 또는 VITE_API_BASE_URL 지원 (Railway 배포용)
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 30000; // 30초 타임아웃 (Railway 백엔드 대응)

// 디버깅: API_BASE_URL 확인
console.log(`[API] API_BASE_URL 설정: ${API_BASE_URL}`);

// 타임아웃을 포함한 fetch 래퍼
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout: number = API_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

export interface SentimentStatsResponse {
  type: 'news' | 'social';
  total: number;
  stats: Array<{
    sentiment: 'positive' | 'neutral' | 'negative' | null;
    count: number;
    percentage: number;
  }>;
  timeRange: {
    hours: number;
    from: string;
    to: string;
  };
}

export interface RiskScoreResponse {
  coin: 'BTC' | 'ETH' | 'SOL';
  risk_score_1h: number;
  risk_score_6h: number;
  risk_score_24h: number;
  overall_risk_score: number;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'; // 백엔드에서 제공하는 경우
  calculated_at: string;
  data_points: {
    '1h': number;
    '6h': number;
    '24h': number;
  };
  price_data?: {
    available: boolean;
    current_price?: number;
    price_change_24h?: number;
    price_adjustment?: number;
  };
}

export interface NewsItemResponse {
  id: string;
  coin: 'BTC' | 'ETH' | 'SOL';
  title: string;
  content?: string;
  url: string;
  published_at: Date | string;
  sentiment_score?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_confidence?: number;
  category?: string;
  tags?: string[];
  provider: string;
  source_type: string;
}

export interface SocialItemResponse {
  id: string;
  coin: 'BTC' | 'ETH' | 'SOL';
  title?: string;
  content?: string;
  url: string;
  published_at?: Date | string;
  sentiment_score?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_confidence?: number;
  source: 'twitter' | 'reddit';
  author_name?: string;
  author_handle?: string;
  hashtags?: string[];
  subreddit?: string;
  author?: string;
  score?: number;
  num_comments?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 코인 심볼을 API 형식으로 변환 (BTC, ETH, SOL)
export const getCoinType = (symbol: string): 'BTC' | 'ETH' | 'SOL' | null => {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol === 'BTC' || upperSymbol === 'BITCOIN') return 'BTC';
  if (upperSymbol === 'ETH' || upperSymbol === 'ETHEREUM') return 'ETH';
  if (upperSymbol === 'SOL' || upperSymbol === 'SOLANA') return 'SOL';
  return null;
};

// 감정 통계 가져오기
// 주의: 백엔드 API는 coin 파라미터를 받지 않으므로 전체 데이터를 반환합니다
export const fetchSentimentStats = async (
  symbol: string,
  type: 'news' | 'social' = 'news',
  hours: number = 24
): Promise<SentimentStatsResponse | null> => {
  try {
    const coinType = getCoinType(symbol);
    const url = `${API_BASE_URL}/api/sentiment/stats?type=${type}&hours=${hours}`;
    console.log(`[API] 호출: ${url} (${symbol} -> ${coinType || 'N/A'})`);
    
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[API] Sentiment stats API error:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // 응답 형식 검증
    if (!data || typeof data !== 'object' || !Array.isArray(data.stats)) {
      console.error(`[API] Invalid response format for sentiment stats`);
      return null;
    }
    
    console.log(`[API] 응답 성공:`, { type: data.type, total: data.total });
    
    // API 응답의 문자열을 숫자로 변환
    return {
      ...data,
      total: typeof data.total === 'string' ? parseInt(data.total, 10) : (data.total || 0),
      stats: data.stats.map((stat: any) => ({
        ...stat,
        count: typeof stat.count === 'string' ? parseInt(stat.count, 10) : (stat.count || 0),
        percentage: typeof stat.percentage === 'string' ? parseFloat(stat.percentage) : (stat.percentage || 0)
      }))
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        console.error(`[API] Timeout fetching sentiment stats for ${symbol}`);
      } else if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        console.error(`[API] CORS 또는 네트워크 에러: ${symbol} - 백엔드 서버가 실행 중인지 확인하세요. (${API_BASE_URL})`);
      } else {
        console.error(`[API] Error fetching sentiment stats for ${symbol}:`, error.message);
      }
    } else {
      console.error(`[API] Unknown error fetching sentiment stats for ${symbol}:`, error);
    }
    return null;
  }
};

// 리스크 점수 가져오기
export const fetchRiskScore = async (
  symbol: string,
  forceRefresh: boolean = false
): Promise<RiskScoreResponse | null> => {
  try {
    const coinType = getCoinType(symbol);
    // coinType이 없어도 백엔드에 시도 (백엔드가 symbol을 직접 지원할 수 있음)
    const coinParam = coinType || symbol.toUpperCase();
    
    const url = `${API_BASE_URL}/api/sentiment/risk-score?coin=${coinParam}&forceRefresh=${forceRefresh}`;
    console.log(`[API] 호출: ${url} (${symbol} -> ${coinParam}${coinType ? '' : ' [coinType 없음, symbol 직접 사용]'})`);
    
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[API] Risk score API error:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // 응답 형식 검증
    if (!data || typeof data !== 'object' || typeof data.overall_risk_score !== 'number') {
      console.error(`[API] Invalid response format for risk score`);
      return null;
    }
    
    console.log(`[API] 응답 성공:`, { coin: data.coin, overall_risk_score: data.overall_risk_score });
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        console.error(`[API] Timeout fetching risk score for ${symbol}`);
      } else if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        console.error(`[API] CORS 또는 네트워크 에러: ${symbol} - 백엔드 서버가 실행 중인지 확인하세요. (${API_BASE_URL})`);
      } else {
        console.error(`[API] Error fetching risk score for ${symbol}:`, error.message);
      }
    } else {
      console.error(`[API] Unknown error fetching risk score for ${symbol}:`, error);
    }
    return null;
  }
};

// 최신 뉴스/소셜 미디어 데이터 가져오기
export const fetchLatestData = async (
  symbol: string,
  type: 'news' | 'social',
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResponse<NewsItemResponse | SocialItemResponse> | null> => {
  try {
    const coinType = getCoinType(symbol);
    const coinParam = coinType ? `&coin=${coinType}` : '';
    const url = `${API_BASE_URL}/api/sentiment/latest?type=${type}&page=${page}&limit=${limit}${coinParam}`;
    
    console.log(`[API] 호출: ${url} (${symbol} -> ${coinType || 'N/A'})`);
    
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[API] Latest data API error:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // 응답 형식 검증
    if (!data || !Array.isArray(data.data) || !data.pagination) {
      console.error(`[API] Invalid response format for latest data`);
      return null;
    }
    
    console.log(`[API] 응답 성공:`, { type, dataCount: data.data.length, total: data.pagination.total });
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        console.error(`[API] Timeout fetching latest data for ${symbol}`);
      } else if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        console.error(`[API] CORS 또는 네트워크 에러: ${symbol} - 백엔드 서버가 실행 중인지 확인하세요. (${API_BASE_URL})`);
      } else {
        console.error(`[API] Error fetching latest data for ${symbol}:`, error.message);
      }
    } else {
      console.error(`[API] Unknown error fetching latest data for ${symbol}:`, error);
    }
    return null;
  }
};

// CoinGecko PriceData 인터페이스
export interface PriceDataResponse {
  id: string;
  coin: 'BTC' | 'ETH' | 'SOL';
  price_usd: number;
  volume_24h_usd: number;
  volume_percentage: number;
  total_market_volume_usd: number;
  timestamp: string;
  created_at: string;
}

export interface MarketDataResponse {
  data: PriceDataResponse[];
  total: number;
}

// CoinGecko 시장 데이터 가져오기
export const fetchMarketData = async (): Promise<MarketDataResponse | null> => {
  try {
    const url = `${API_BASE_URL}/api/sentiment/market`;
    console.log(`[API] 호출: ${url}`);
    
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[API] Market data API error:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // 응답 형식 검증
    if (!data || !Array.isArray(data.data) || typeof data.total !== 'number') {
      console.error(`[API] Invalid response format for market data`);
      return null;
    }
    
    // 백엔드에서 숫자가 문자열로 올 수 있으므로 변환
    const convertedData = {
      ...data,
      data: data.data.map((item: any) => ({
        ...item,
        price_usd: typeof item.price_usd === 'string' ? parseFloat(item.price_usd) : item.price_usd,
        volume_24h_usd: typeof item.volume_24h_usd === 'string' ? parseFloat(item.volume_24h_usd) : item.volume_24h_usd,
        volume_percentage: typeof item.volume_percentage === 'string' ? parseFloat(item.volume_percentage) : item.volume_percentage,
        total_market_volume_usd: typeof item.total_market_volume_usd === 'string' ? parseFloat(item.total_market_volume_usd) : item.total_market_volume_usd,
      }))
    };
    
    console.log(`[API] 응답 성공:`, { total: convertedData.total, coins: convertedData.data.length });
    return convertedData;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        console.error(`[API] Timeout fetching market data`);
      } else {
        console.error(`[API] Error fetching market data:`, error.message);
      }
    } else {
      console.error(`[API] Unknown error fetching market data:`, error);
    }
    return null;
  }
};

// 특정 코인의 CoinGecko 데이터 가져오기
export const fetchCoinMarketData = async (
  symbol: string
): Promise<PriceDataResponse | null> => {
  try {
    const marketData = await fetchMarketData();
    if (!marketData || !marketData.data || !Array.isArray(marketData.data)) {
      console.log(`[API] Market data가 없거나 형식이 올바르지 않습니다.`);
      return null;
    }

    // 먼저 coinType으로 찾기 시도 (BTC, ETH, SOL)
    const coinType = getCoinType(symbol);
    let coinData = coinType ? marketData.data.find((item) => item.coin === coinType) : null;
    
    // coinType으로 찾지 못했으면 symbol로 직접 찾기 시도
    if (!coinData) {
      const upperSymbol = symbol.toUpperCase();
      // 백엔드에서 반환하는 coin 필드가 symbol과 일치할 수 있음
      coinData = marketData.data.find((item) => 
        item.coin === upperSymbol || 
        item.coin === symbol ||
        (item as any).symbol === upperSymbol ||
        (item as any).symbol === symbol
      );
    }
    
    if (!coinData) {
      console.log(`[API] ${symbol}에 대한 시장 데이터를 찾을 수 없습니다. 사용 가능한 코인: ${marketData.data.map((d: any) => d.coin || d.symbol).join(', ')}`);
      return null;
    }
    
    // 데이터 유효성 검증
    if (
      typeof coinData.volume_24h_usd !== 'number' ||
      typeof coinData.volume_percentage !== 'number' ||
      typeof coinData.total_market_volume_usd !== 'number'
    ) {
      console.error(`[API] Invalid coin market data format for ${symbol}`);
      return null;
    }
    
    console.log(`[API] ${symbol} 시장 데이터 찾음:`, { coin: coinData.coin, volume: coinData.volume_24h_usd });
    return coinData;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        console.error(`[API] CORS 또는 네트워크 에러: ${symbol} - 백엔드 서버가 실행 중인지 확인하세요. (${API_BASE_URL})`);
      } else {
        console.error(`[API] Error fetching coin market data for ${symbol}:`, error.message);
      }
    } else {
      console.error(`[API] Unknown error fetching coin market data for ${symbol}:`, error);
    }
    return null;
  }
};

// CoinGecko 데이터를 OnChainMetric으로 직접 매핑 (변환 없이)
export const convertToOnChainMetric = (
  currentData: PriceDataResponse
): import('../types').OnChainMetric => {
  // CoinGecko에서 제공하는 데이터를 그대로 사용
  return {
    volume_24h_usd: currentData.volume_24h_usd,
    volume_percentage: currentData.volume_percentage,
    total_market_volume_usd: currentData.total_market_volume_usd,
    price_usd: currentData.price_usd,
    // 기존 필드 (하위 호환성, volume_percentage를 netflow로 사용)
    netflow: currentData.volume_percentage,
  };
};

