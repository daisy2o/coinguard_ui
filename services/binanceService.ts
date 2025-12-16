// Binance API 서비스
export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// 코인 심볼을 Binance 심볼로 변환
const getBinanceSymbol = (symbol: string): string => {
  return `${symbol}USDT`;
};

// Binance에서 단일 코인 가격 정보 가져오기
export const fetchBinancePrice = async (symbol: string): Promise<BinanceTicker | null> => {
  try {
    const binanceSymbol = getBinanceSymbol(symbol);
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
    
    if (!response.ok) {
      console.error(`Binance API error for ${symbol}:`, response.statusText);
      return null;
    }
    
    const data: BinanceTicker = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Binance price for ${symbol}:`, error);
    return null;
  }
};

// 여러 코인 가격 정보 한번에 가져오기 (병렬 요청)
export const fetchMultipleBinancePrices = async (symbols: string[]): Promise<Map<string, BinanceTicker>> => {
  const priceMap = new Map<string, BinanceTicker>();
  
  try {
    // 모든 코인을 병렬로 요청
    const promises = symbols.map(async (symbol) => {
      const ticker = await fetchBinancePrice(symbol);
      if (ticker) {
        priceMap.set(symbol, ticker);
      }
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching multiple Binance prices:', error);
  }
  
  return priceMap;
};

// 가격 정보를 포맷팅
export const formatBinanceData = (ticker: BinanceTicker) => {
  const price = parseFloat(ticker.lastPrice);
  const change24h = parseFloat(ticker.priceChangePercent);
  const volume = parseFloat(ticker.quoteVolume);
  const marketCap = price * parseFloat(ticker.volume); // 대략적인 시가총액 계산
  
  return {
    price,
    change24h,
    volume24h: `$${(volume / 1000000).toFixed(2)}M`,
    marketCap: `$${(marketCap / 1000000000).toFixed(2)}B`,
  };
};

// 시간대별 타입 정의
export type TimeFrame = '1min' | '1h' | '1d' | '1w' | '1m';

// Binance Kline 데이터 타입
export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  ignore: string;
}

// PricePoint 타입 (types.ts와 일치)
export interface PricePoint {
  time: string;
  price: number;
}

// 캔들 데이터 타입
export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// 시간대별 설정
const TIME_FRAME_CONFIG: Record<TimeFrame, { interval: string; limit: number; label: string }> = {
  '1min': { interval: '1m', limit: 60, label: '1분' }, // 1분 간격 60개 (1시간)
  '1h': { interval: '1h', limit: 24, label: '1시간' }, // 1시간 간격 24개 (24시간)
  '1d': { interval: '1d', limit: 30, label: '1일' }, // 1일 간격 30개 (30일)
  '1w': { interval: '1w', limit: 15, label: '1주' }, // 1주 간격 15개 (약 3.5개월, 현재 주 포함)
  '1m': { interval: '1M', limit: 12, label: '1월' } // 1달 간격 12개 (12달)
};

// Binance에서 시간대별 캔들 데이터 가져오기
export const fetchBinancePriceHistory = async (
  symbol: string, 
  timeFrame: TimeFrame = '1d'
): Promise<CandleData[]> => {
  try {
    const binanceSymbol = getBinanceSymbol(symbol);
    const config = TIME_FRAME_CONFIG[timeFrame];
    
    // Binance API는 완료된 캔들만 반환하므로, 현재 진행 중인 데이터를 포함하기 위해 limit을 약간 늘림
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${config.interval}&limit=${config.limit}`
    );
    
    if (!response.ok) {
      console.error(`Binance Klines API error for ${symbol}:`, response.statusText);
      return [];
    }
    
    const data: any[][] = await response.json();
    
    // Kline 데이터를 CandleData로 변환
    const candleData: CandleData[] = data.map((kline) => {
      const timestamp = kline[0]; // openTime
      const open = parseFloat(kline[1]); // open price
      const high = parseFloat(kline[2]); // high price
      const low = parseFloat(kline[3]); // low price
      const close = parseFloat(kline[4]); // close price
      
      // 시간 포맷팅
      const date = new Date(timestamp);
      let timeLabel = '';
      
      if (timeFrame === '1min') {
        // 1분 간격: HH:MM 형식
        timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else if (timeFrame === '1h') {
        // 1시간 간격: HH:00 형식
        timeLabel = `${date.getHours().toString().padStart(2, '0')}:00`;
      } else if (timeFrame === '1d') {
        // 1일 간격: MM/DD 형식
        timeLabel = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      } else if (timeFrame === '1w') {
        // 1주 간격: MM/DD 형식
        timeLabel = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      } else {
        // 1달 간격: MM 형식 (월만 표시)
        timeLabel = `${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      
      return {
        time: timeLabel,
        open,
        high,
        low,
        close
      };
    });
    
    // 최신 가격 데이터 가져와서 차트 끝에 추가
    try {
      const ticker = await fetchBinancePrice(symbol);
      if (ticker) {
        const currentPrice = parseFloat(ticker.lastPrice);
        const now = new Date();
        let currentTimeLabel = '';
        
        if (timeFrame === '1min') {
          // 현재 시간의 분
          currentTimeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        } else if (timeFrame === '1h') {
          // 현재 시간의 정시
          currentTimeLabel = `${now.getHours().toString().padStart(2, '0')}:00`;
        } else if (timeFrame === '1d') {
          // 오늘 날짜
          currentTimeLabel = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
        } else if (timeFrame === '1w') {
          // 오늘 날짜
          currentTimeLabel = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
        } else {
          // 현재 월
          currentTimeLabel = `${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        
        // 마지막 데이터와 시간 레이블이 다르면 최신 데이터 추가
        const lastData = candleData[candleData.length - 1];
        if (!lastData || lastData.time !== currentTimeLabel) {
          candleData.push({
            time: currentTimeLabel,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice
          });
        } else {
          // 같은 시간 레이블이면 가격만 업데이트
          const last = candleData[candleData.length - 1];
          last.close = currentPrice;
          last.high = Math.max(last.high, currentPrice);
          last.low = Math.min(last.low, currentPrice);
        }
      }
    } catch (error) {
      console.error('Error fetching current price:', error);
      // 최신 가격을 가져오지 못해도 기존 데이터는 반환
    }
    
    return candleData;
  } catch (error) {
    console.error(`Error fetching Binance price history for ${symbol}:`, error);
    return [];
  }
};

