
export type SentimentType = 'positive' | 'neutral' | 'negative';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type MarketPhase = 'ACCUMULATION' | 'RISING' | 'CORRECTION' | 'PLUMMETING' | 'STABLE';

export interface AnalysisStats {
  news: {
    negativeCount: number;
    totalCount: number;
    riskTags: string[]; // e.g. 'hack', 'regulation'
  };
  social: {
    negativeCount: number;
    totalCount: number;
  };
  onChain: {
    netflowPercent: number;
    activeAddressChange: number;
  };
}

export interface AIAnalysisResult {
  marketPhase: MarketPhase;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100 (Calculated via algorithm)
  actionGuide: string; // 2-3 sentences of safety guidelines
  analysisSummary?: string; // GPT 종합 분석 요약
  stats?: AnalysisStats; // Raw stats used for calculation
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number; // Percentage
  volume24h: string;
  marketCap: string;
  newsHeadline?: string; // Latest simulated headline
  analysis?: AIAnalysisResult;
}

export interface PricePoint {
  time: string;
  price: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: SentimentType;
  url?: string;
}

export interface SocialPost {
  id: string;
  user: string;
  text: string;
  time: string;
  sentiment: SentimentType;
  likes: number;
}

export interface OnChainMetric {
  // CoinGecko에서 직접 제공하는 데이터
  volume_24h_usd: number;           // 24시간 거래량
  volume_percentage: number;         // 전체 시장 대비 거래량 비율 (%)
  total_market_volume_usd: number;  // 전체 시장 거래량
  price_usd: number;                // 현재 가격
  // 기존 필드 (하위 호환성을 위해 유지, CoinGecko 데이터 기반으로 계산)
  netflow?: number;                  // volume_percentage를 netflow로 사용
  activeAddresses?: number;          // 선택사항
  transactionCount?: number;         // 선택사항
  largeTransactions?: number;        // 선택사항
}

// Watch 모드 타입 정의
export type WatchConditionType = 
  | 'news_risk_tag' 
  | 'social_negative' 
  | 'onchain_netflow' 
  | 'onchain_active_address' 
  | 'price_change' 
  | 'risk_score'
  | 'risk_level';

export type WatchOperator = '>' | '<' | '>=' | '<=' | '==';

export interface WatchCondition {
  type: WatchConditionType;
  operator: WatchOperator;
  value: number | string; // number for numeric comparisons, string for risk_level
  riskTag?: string; // news_risk_tag일 때 사용
}

export interface WatchRule {
  id: string;
  name: string;
  enabled: boolean;
  coinSymbols: string[] | null; // null이면 전체 코인에 적용
  conditions: WatchCondition[];
  createdAt: string;
  lastTriggered?: string; // 마지막으로 알림이 발송된 시간
}

export interface WatchNotification {
  id: string;
  watchRuleId: string;
  watchRuleName: string;
  coinSymbol: string;
  coinName: string;
  message: string;
  triggeredAt: string;
  read: boolean;
}

export interface TranslationState {
  originalText: string;
  translatedText?: string;
  isTranslating: boolean;
  language: 'en' | 'ko' | 'auto';
}
