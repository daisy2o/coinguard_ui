
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CoinData, AIAnalysisResult, RiskLevel, MarketPhase, AnalysisStats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to calculate risk score based on the specific algorithm provided
const calculateRiskScore = (stats: AnalysisStats): { score: number, level: RiskLevel } => {
  // 1. News Score (0-100)
  // Formula: (NegRatio * 60) + (RiskTagStrength * 40)
  const newsNegRatio = stats.news.totalCount > 0 ? stats.news.negativeCount / stats.news.totalCount : 0;
  const negScore = newsNegRatio * 60;

  const tagWeights: Record<string, number> = {
    'hack': 40, 'exploit': 40, 'fraud': 35, 'market_crash': 30,
    'exchange_issue': 25, 'regulation': 20, 'lawsuit': 20, 'technical': 15
  };

  let maxTagWeight = 0;
  stats.news.riskTags.forEach(tag => {
    const w = tagWeights[tag] || 10;
    if (w > maxTagWeight) maxTagWeight = w;
  });

  // Risk Tag Strength = min(40, max(weights) * (1 + count * 0.1))
  const riskTagStrength = Math.min(40, maxTagWeight * (1 + (stats.news.riskTags.length - 1) * 0.1));
  const newsScore = negScore + (stats.news.riskTags.length > 0 ? riskTagStrength : 0);

  // 2. Social Score (0-100)
  // Formula: NegRatio * 100
  const socialNegRatio = stats.social.totalCount > 0 ? stats.social.negativeCount / stats.social.totalCount : 0;
  const socialScore = socialNegRatio * 100;

  // 3. OnChain Score (0-100)
  // Formula: (NetflowScore * 0.6) + (ActiveScore * 0.4)
  const nf = stats.onChain.netflowPercent;
  let nfScore = 40;
  if (nf >= 30) nfScore = 100;
  else if (nf >= 20) nfScore = 80;
  else if (nf >= 10) nfScore = 60;
  else if (nf >= 0) nfScore = 40;
  else if (nf >= -10) nfScore = 30;
  else if (nf >= -20) nfScore = 20;
  else nfScore = 10; // Outflow is safe

  const aa = stats.onChain.activeAddressChange;
  let aaScore = 50;
  if (aa <= -20) aaScore = 100; // Drop in activity = High Risk
  else if (aa <= -10) aaScore = 70;
  else if (aa <= 0) aaScore = 50;
  else if (aa <= 10) aaScore = 40;
  else if (aa <= 20) aaScore = 30;
  else aaScore = 20; // Increase in activity = Safe

  const onChainScore = (nfScore * 0.6) + (aaScore * 0.4);

  // 4. Total Score
  // Weights: News 40%, Social 30%, OnChain 30%
  const totalScore = (newsScore * 0.4) + (socialScore * 0.3) + (onChainScore * 0.3);

  // 5. Level Classification
  let level: RiskLevel = 'LOW';
  if (totalScore >= 70) level = 'HIGH';
  else if (totalScore >= 40) level = 'MEDIUM';
  else level = 'LOW';

  return { score: Math.round(totalScore), level };
};

// AI 요약 생성 공통 함수
const generateAnalysisSummary = async (
  coin: CoinData,
  stats: AnalysisStats,
  riskLevel: RiskLevel,
  overallScore: number,
  newsStats?: any,
  socialStats?: any,
  coinMarketData?: any
): Promise<string | undefined> => {
  try {
    const { generateComprehensiveAnalysis } = await import('./gptAnalysisService');
    const { convertToOnChainMetric } = await import('./sentimentService');
    
    // 온체인 데이터 추출
    const onChainData = (() => {
      if (coinMarketData) {
        const onChainMetric = convertToOnChainMetric(coinMarketData);
        return {
          netflowPercent: onChainMetric.netflow || stats.onChain.netflowPercent,
          activeAddressChange: stats.onChain.activeAddressChange,
          volumePercentage: onChainMetric.volume_percentage
        };
      }
      return {
        netflowPercent: stats.onChain.netflowPercent,
        activeAddressChange: stats.onChain.activeAddressChange
      };
    })();

    const analysisData = {
      newsStats: {
        total: newsStats?.total || stats.news.totalCount,
        positive: newsStats?.stats.find((s: any) => s.sentiment === 'positive')?.count || (stats.news.totalCount - stats.news.negativeCount),
        neutral: newsStats?.stats.find((s: any) => s.sentiment === 'neutral')?.count || 0,
        negative: newsStats?.stats.find((s: any) => s.sentiment === 'negative')?.count || stats.news.negativeCount,
        // percentage가 명시적으로 제공되면 사용 (0도 유효한 값), 없으면 계산
        negativePercent: (() => {
          if (newsStats?.stats) {
            const negativeStat = newsStats.stats.find((s: any) => s.sentiment === 'negative');
            if (negativeStat && negativeStat.percentage !== undefined && negativeStat.percentage !== null) {
              return negativeStat.percentage;
            }
          }
          // 폴백: 직접 계산
          const negativeCount = newsStats?.stats.find((s: any) => s.sentiment === 'negative')?.count || stats.news.negativeCount;
          const total = newsStats?.total || stats.news.totalCount;
          return total > 0 ? (negativeCount / total) * 100 : 0;
        })()
      },
      socialStats: {
        total: socialStats?.total || stats.social.totalCount,
        positive: socialStats?.stats.find((s: any) => s.sentiment === 'positive')?.count || (stats.social.totalCount - stats.social.negativeCount),
        neutral: socialStats?.stats.find((s: any) => s.sentiment === 'neutral')?.count || 0,
        negative: socialStats?.stats.find((s: any) => s.sentiment === 'negative')?.count || stats.social.negativeCount,
        // 동일한 로직 적용
        negativePercent: (() => {
          if (socialStats?.stats) {
            const negativeStat = socialStats.stats.find((s: any) => s.sentiment === 'negative');
            if (negativeStat && negativeStat.percentage !== undefined && negativeStat.percentage !== null) {
              return negativeStat.percentage;
            }
          }
          // 폴백: 직접 계산
          const negativeCount = socialStats?.stats.find((s: any) => s.sentiment === 'negative')?.count || stats.social.negativeCount;
          const total = socialStats?.total || stats.social.totalCount;
          return total > 0 ? (negativeCount / total) * 100 : 0;
        })()
      },
      onChain: onChainData,
      riskScore: {
        overall: Math.round(overallScore),
        riskLevel: riskLevel,
        score1h: Math.round(overallScore),
        score6h: Math.round(overallScore),
        score24h: Math.round(overallScore)
      },
      priceChange: coin.change24h,
      coinName: coin.name,
      coinSymbol: coin.symbol
    };

    const analysisSummary = await generateComprehensiveAnalysis(analysisData);
    console.log('[GPT] 종합 분석 생성 완료');
    return analysisSummary;
  } catch (error) {
    console.error('[GPT] 종합 분석 생성 실패:', error);
    return undefined;
  }
};

export const analyzeCoinSignal = async (coin: CoinData): Promise<AIAnalysisResult | null> => {
  try {
    // 모든 코인에 대해 API 호출 시도
    const { fetchSentimentStats, fetchRiskScore, getCoinType, fetchCoinMarketData, convertToOnChainMetric } = await import('./sentimentService');
    
    const coinType = getCoinType(coin.symbol);
    console.log(`[API] ${coin.symbol}${coinType ? ` (${coinType})` : ''} 데이터를 가져오는 중...`);
    console.log(`[API] API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`);
    
    // 모든 코인에 대해 API 호출 시도 (coinType이 없어도 시도)
    const [newsStats, socialStats, riskData, coinMarketData] = await Promise.all([
      fetchSentimentStats(coin.symbol, 'news', 24).catch(err => {
        console.error(`[API] fetchSentimentStats(news) 실패:`, err);
        return null;
      }),
      fetchSentimentStats(coin.symbol, 'social', 24).catch(err => {
        console.error(`[API] fetchSentimentStats(social) 실패:`, err);
        return null;
      }),
      // 모든 코인에 대해 백엔드 API 호출 시도 (coinType이 없어도 시도)
      fetchRiskScore(coin.symbol).catch(err => {
        console.error(`[API] fetchRiskScore 실패:`, err);
        return null;
      }),
      fetchCoinMarketData(coin.symbol).catch(err => {
        console.error(`[API] fetchCoinMarketData 실패:`, err);
        return null;
      })
    ]);

    console.log(`[API] 응답 결과:`, { 
      newsStats: newsStats ? `성공 (total: ${newsStats.total})` : '실패', 
      socialStats: socialStats ? `성공 (total: ${socialStats.total})` : '실패', 
      riskData: riskData ? `성공 (score: ${riskData.overall_risk_score})` : '실패',
      coinMarketData: coinMarketData ? `성공 (volume: ${coinMarketData.volume_24h_usd})` : '실패'
    });

    // 필수 데이터 확인: 최소한 뉴스 또는 소셜 데이터가 있어야 분석 가능
    const hasRequiredData = newsStats || socialStats;
    
    if (!hasRequiredData) {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      console.error(`[API] ${coin.symbol}: 필수 데이터(뉴스/소셜)가 없어 분석할 수 없습니다.`);
      console.error(`[API] 백엔드 서버가 실행 중인지 확인하세요: ${apiUrl}`);
      console.error(`[API] CORS 에러가 발생한 경우, 백엔드에서 CORS 헤더를 설정해야 합니다.`);
      return null;
    }
    
    if (hasRequiredData) {
      console.log(`[API] 실제 API 데이터 사용 (부분 데이터 포함 가능)`);
      // API 응답을 AnalysisStats 형식으로 변환
      // newsStats나 socialStats가 없으면 기본값 사용
      const stats: AnalysisStats = {
        news: newsStats ? {
          negativeCount: newsStats.stats.find(s => s.sentiment === 'negative')?.count || 0,
          totalCount: newsStats.total,
          riskTags: [] // API에서 tags 정보를 가져와야 함
        } : {
          negativeCount: 0,
          totalCount: 0,
          riskTags: []
        },
        social: socialStats ? {
          negativeCount: socialStats.stats.find(s => s.sentiment === 'negative')?.count || 0,
          totalCount: socialStats.total
        } : {
          negativeCount: 0,
          totalCount: 0
        },
        onChain: (() => {
          // CoinGecko 데이터가 있으면 변환하여 사용
          if (coinMarketData) {
            const onChainMetric = convertToOnChainMetric(coinMarketData);
            // OnChainMetric을 AnalysisStats.onChain 형식으로 변환
            // netflow는 이미 퍼센트 단위로 계산되므로 그대로 사용
            // activeAddressChange는 기준값 대비 변화율로 계산
            // CoinGecko 데이터에는 activeAddresses가 없으므로, volume_percentage를 기반으로 추정
            const baseActiveAddresses = 10000; // 기준 활성 주소 수
            const activeAddresses = onChainMetric.activeAddresses || baseActiveAddresses;
            return {
              netflowPercent: onChainMetric.netflow || 0, // 이미 퍼센트 단위
              activeAddressChange: activeAddresses ? ((activeAddresses - baseActiveAddresses) / baseActiveAddresses) * 100 : 0
            };
          }
          // CoinGecko 데이터가 없으면 0으로 설정
          return {
            netflowPercent: 0,
            activeAddressChange: 0
          };
        })()
      };

      // Risk score를 RiskLevel로 변환
      // 백엔드 API가 없으면 리스크 점수를 계산할 수 없음
      let overallScore: number | null = null;
      let riskLevel: RiskLevel | null = null;
      
      if (riskData?.overall_risk_score !== undefined && riskData.overall_risk_score !== null) {
        // 백엔드에서 받은 점수 사용
        overallScore = riskData.overall_risk_score;
        
        // 백엔드에서 risk_level을 제공하면 그것을 사용, 없으면 점수로 계산
        if (riskData.risk_level) {
          riskLevel = riskData.risk_level as RiskLevel;
          console.log(`[API] ${coin.symbol}: 백엔드에서 risk_level 사용: ${riskLevel}`);
        } else {
          // 백엔드에서 risk_level이 없으면 점수로 계산 (하위 호환성)
          if (overallScore >= 70) riskLevel = 'HIGH';
          else if (overallScore >= 40) riskLevel = 'MEDIUM';
          else riskLevel = 'LOW';
          console.log(`[API] ${coin.symbol}: 점수로 risk_level 계산: ${riskLevel} (${overallScore}점)`);
        }
      } else {
        // 백엔드 API가 없으면 계산 불가
        console.warn(`[API] ${coin.symbol}: 백엔드 API가 없어 리스크 점수를 계산할 수 없습니다.`);
        // overallScore와 riskLevel은 null로 유지
      }

      // Market phase 결정 (변동률 기반)
      let marketPhase: MarketPhase = 'STABLE';
      if (coin.change24h > 5) marketPhase = 'RISING';
      else if (coin.change24h < -5) marketPhase = 'PLUMMETING';
      else if (coin.change24h > 2) marketPhase = 'ACCUMULATION';
      else if (coin.change24h < -2) marketPhase = 'CORRECTION';

      const actionGuides = {
        LOW: "Indicators suggest a safe environment. Consider Dollar Cost Averaging (DCA) if you believe in the long-term value.",
        MEDIUM: "Market signals are mixed. It is recommended to observe price action and avoid large lump-sum entries.",
        HIGH: "High risk detected due to negative sentiment or network anomalies. Avoid entering now; wait for volatility to settle.",
        EXTREME: "Extreme danger. Major negative signals triggered. Do not catch a falling knife."
      };

      // GPT 종합 분석 생성 (리스크 점수가 있을 때만)
      const { generateComprehensiveAnalysis } = await import('./gptAnalysisService');
      
      // AI 요약 생성 (리스크 점수가 있을 때만)
      const analysisSummary = overallScore !== null && riskLevel !== null
        ? await generateAnalysisSummary(
            coin,
            stats,
            riskLevel,
            overallScore,
            newsStats,
            socialStats,
            coinMarketData
          )
        : undefined;

      return {
        marketPhase,
        riskLevel: riskLevel || 'LOW', // 타입 호환성을 위해 기본값 제공 (UI에서 -1 체크)
        riskScore: overallScore ?? -1, // -1은 "계산 불가"를 의미
        actionGuide: riskLevel ? actionGuides[riskLevel] : "백엔드 API가 없어 리스크 점수를 계산할 수 없습니다.",
        analysisSummary,
        stats
      };
    }

    // 여기 도달하면 안 됨 (hasRequiredData가 false면 위에서 return null)
    return null;
  } catch (error) {
    console.error(`[API] ${coin.symbol} 분석 중 에러 발생:`, error);
    return null;
  }
};
