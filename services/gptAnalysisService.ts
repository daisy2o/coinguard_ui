// GPT를 이용한 종합 분석 서비스

interface AnalysisData {
  newsStats: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    negativePercent: number;
  };
  socialStats: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    negativePercent: number;
  };
  onChain?: {
    netflowPercent: number;
    activeAddressChange: number;
    volumePercentage?: number;
  };
  riskScore: {
    overall: number;
    riskLevel: string;
    score1h: number;
    score6h: number;
    score24h: number;
  };
  priceChange: number;
  coinName: string;
  coinSymbol: string;
}

// GPT API를 사용한 종합 분석 요약 생성 (100자 이내)
export const generateComprehensiveAnalysis = async (
  data: AnalysisData
): Promise<string> => {
  try {
    // OpenAI API 또는 다른 GPT API 사용
    // 여기서는 환경 변수에서 API 키를 가져옵니다
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    // 디버깅: 환경 변수 확인
    if (import.meta.env.DEV) {
      console.log('[GPT] 환경 변수 확인:', {
        hasKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : '없음'
      });
    }
    
    if (!apiKey) {
      console.warn('[GPT] OpenAI API 키가 없습니다. 기본 분석을 사용합니다.');
      return generateDefaultSummary(data);
    }

    const prompt = createSummaryPrompt(data);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 암호화폐 시장 분석가입니다. 리스크 점수가 왜 그 수준인지 해석하고, 중대한 이벤트나 이상점이 있으면 반드시 포함하세요. 점수 자체는 언급하지 말고, 점수가 나온 이유만 설명하세요. 100자 이내로 논리적이고 간결하게 요약해주세요. 격식 있는 표현("~입니다", "~해주세요") 없이 구어체로 작성해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 120  // 100자 요약을 위해 토큰 수 증가
      })
    });

    if (!response.ok) {
      console.error('[GPT] API 호출 실패:', response.statusText);
      return generateDefaultSummary(data);
    }

    const result = await response.json();
    let summary = result.choices[0]?.message?.content?.trim() || generateDefaultSummary(data);
    
    // 100자 제한
    if (summary.length > 100) {
      summary = summary.substring(0, 97) + '...';
    }
    
    return summary;
  } catch (error) {
    console.error('[GPT] 분석 생성 중 에러:', error);
    return generateDefaultSummary(data);
  }
};

// 요약 프롬프트 생성 (100자 이내, 간결하고 자연스러운 톤)
const createSummaryPrompt = (data: AnalysisData): string => {
  // 큰 이벤트 감지
  const hasHighNegativeNews = data.newsStats.negativePercent > 30;
  const hasHighNegativeSocial = data.socialStats.negativePercent > 30;
  const hasHighPositiveNews = data.newsStats.positive > data.newsStats.negative * 2 && data.newsStats.positive > 5;
  const hasHighPositiveSocial = data.socialStats.positive > data.socialStats.negative * 2 && data.socialStats.positive > 10;
  const hasLargePriceDrop = data.priceChange < -5;
  const hasLargePriceRise = data.priceChange > 5;
  const hasModeratePriceDrop = data.priceChange < -2 && data.priceChange >= -5;
  const hasModeratePriceRise = data.priceChange > 2 && data.priceChange <= 5;
  const hasHighNetflow = data.onChain && Math.abs(data.onChain.netflowPercent) > 20;
  const hasModerateNetflow = data.onChain && Math.abs(data.onChain.netflowPercent) > 10 && Math.abs(data.onChain.netflowPercent) <= 20;
  const hasActiveAddressDrop = data.onChain && data.onChain.activeAddressChange < -15;
  const hasActiveAddressRise = data.onChain && data.onChain.activeAddressChange > 15;
  const hasHighVolume = data.onChain && data.onChain.volumePercentage && data.onChain.volumePercentage > 20;

  // 이상점 감지 (중대한 이벤트)
  const anomalies: string[] = [];
  if (hasHighNegativeNews) anomalies.push(`뉴스 부정 ${data.newsStats.negativePercent.toFixed(1)}%로 급증`);
  if (hasHighNegativeSocial) anomalies.push(`소셜 부정 ${data.socialStats.negativePercent.toFixed(1)}%로 급증`);
  if (hasLargePriceDrop) anomalies.push(`가격 ${Math.abs(data.priceChange).toFixed(1)}% 급락`);
  if (hasLargePriceRise) anomalies.push(`가격 ${data.priceChange.toFixed(1)}% 급등`);
  if (hasHighNetflow) {
    const direction = data.onChain!.netflowPercent > 0 ? '대량 유입' : '대량 유출';
    anomalies.push(`온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% ${direction}`);
  }
  if (hasActiveAddressDrop) anomalies.push(`활성 주소 ${Math.abs(data.onChain!.activeAddressChange).toFixed(1)}% 급감`);
  if (hasActiveAddressRise) anomalies.push(`활성 주소 ${data.onChain!.activeAddressChange.toFixed(1)}% 급증`);
  if (hasHighVolume) anomalies.push(`거래량 비율 ${data.onChain!.volumePercentage!.toFixed(1)}%로 비정상적 증가`);

  // 리스크 점수 해석을 위한 주요 요인 분석
  const riskFactors: string[] = [];
  
  // 뉴스 요인
  if (data.newsStats.negativePercent > 30) {
    riskFactors.push(`뉴스 부정 ${data.newsStats.negativePercent.toFixed(1)}%`);
  } else if (data.newsStats.negativePercent > 20) {
    riskFactors.push(`뉴스 부정 ${data.newsStats.negativePercent.toFixed(1)}%`);
  }
  
  // 소셜 요인
  if (data.socialStats.negativePercent > 30) {
    riskFactors.push(`소셜 부정 ${data.socialStats.negativePercent.toFixed(1)}%`);
  } else if (data.socialStats.negativePercent > 20) {
    riskFactors.push(`소셜 부정 ${data.socialStats.negativePercent.toFixed(1)}%`);
  }
  
  // 온체인 요인
  if (data.onChain) {
    if (Math.abs(data.onChain.netflowPercent) > 20) {
      const direction = data.onChain.netflowPercent > 0 ? '대량 유입' : '대량 유출';
      riskFactors.push(`온체인 ${Math.abs(data.onChain.netflowPercent).toFixed(1)}% ${direction}`);
    } else if (Math.abs(data.onChain.netflowPercent) > 10) {
      const direction = data.onChain.netflowPercent > 0 ? '유입' : '유출';
      riskFactors.push(`온체인 ${Math.abs(data.onChain.netflowPercent).toFixed(1)}% ${direction}`);
    }
    
    if (data.onChain.activeAddressChange < -15) {
      riskFactors.push(`활성 주소 ${Math.abs(data.onChain.activeAddressChange).toFixed(1)}% 감소`);
    }
  }
  
  // 가격 변동 요인
  if (Math.abs(data.priceChange) > 5) {
    riskFactors.push(`가격 ${data.priceChange > 0 ? '+' : ''}${data.priceChange.toFixed(1)}% 변동`);
  }

  // 시장 상황 맥락 분석
  const sentimentPriceMatch = (hasHighPositiveNews || hasHighPositiveSocial) && hasLargePriceRise;
  const sentimentPriceMismatch = (hasHighNegativeNews || hasHighNegativeSocial) && hasLargePriceRise;
  const positiveButDrop = (hasHighPositiveNews || hasHighPositiveSocial) && hasLargePriceDrop;

  let contextNote = '';
  if (sentimentPriceMatch) contextNote = '긍정 감정과 가격 상승이 일치해 강세 추세. ';
  if (sentimentPriceMismatch) contextNote = '부정 감정인데 가격 상승 중이라 과매수 구간 가능. ';
  if (positiveButDrop) contextNote = '긍정 감정인데 가격 하락 중이라 기술적 조정 가능. ';

  const anomaliesText = anomalies.length > 0 
    ? `\n\n중대한 이벤트/이상점: ${anomalies.join(', ')}`
    : '';

  const riskFactorsText = riskFactors.length > 0
    ? `\n\n리스크 점수 주요 요인: ${riskFactors.join(', ')}`
    : '';

  return `
${data.coinName}(${data.coinSymbol}) 현재 리스크 ${data.riskScore.riskLevel} 수준

뉴스: 총 ${data.newsStats.total}개, 긍정 ${data.newsStats.positive}개, 부정 ${data.newsStats.negative}개 (부정 ${data.newsStats.negativePercent.toFixed(1)}%)
소셜: 총 ${data.socialStats.total}개, 긍정 ${data.socialStats.positive}개, 부정 ${data.socialStats.negative}개 (부정 ${data.socialStats.negativePercent.toFixed(1)}%)
${data.onChain ? `온체인: 순유입/유출 ${data.onChain.netflowPercent > 0 ? '+' : ''}${data.onChain.netflowPercent.toFixed(1)}%, 활성 주소 ${data.onChain.activeAddressChange > 0 ? '+' : ''}${data.onChain.activeAddressChange.toFixed(1)}%${data.onChain.volumePercentage ? `, 거래량 ${data.onChain.volumePercentage.toFixed(1)}%` : ''}` : ''}
가격: ${data.priceChange > 0 ? '+' : ''}${data.priceChange.toFixed(2)}%
${anomaliesText}${riskFactorsText}${contextNote ? `\n\n맥락: ${contextNote}` : ''}

위 데이터를 바탕으로 리스크 점수가 ${data.riskScore.riskLevel} 수준인 이유를 해석해줘. 점수 자체는 언급하지 말고, 왜 이런 리스크 수준인지 설명해줘.${anomalies.length > 0 ? ' 중대한 이벤트나 이상점이 있으면 반드시 포함하고,' : ''} 논리적이면서 간결하게 100자 이내로 요약해줘. 자연스러운 구어체로 작성하고, 가장 중요한 정보부터 언급해줘.
  `.trim();
};

// 기본 요약 생성 (GPT API 실패 시, 100자 이내)
const generateDefaultSummary = (data: AnalysisData): string => {
  const riskLevel = data.riskScore.riskLevel;
  const negativeNewsPercent = data.newsStats.negativePercent;
  const negativeSocialPercent = data.socialStats.negativePercent;
  const hasLargePriceDrop = data.priceChange < -5;
  const hasLargePriceRise = data.priceChange > 5;
  const hasModeratePriceDrop = data.priceChange < -2 && data.priceChange >= -5;
  const hasModeratePriceRise = data.priceChange > 2 && data.priceChange <= 5;
  const hasHighNetflow = data.onChain && Math.abs(data.onChain.netflowPercent) > 20;
  const hasModerateNetflow = data.onChain && Math.abs(data.onChain.netflowPercent) > 10 && Math.abs(data.onChain.netflowPercent) <= 20;
  const hasActiveAddressDrop = data.onChain && data.onChain.activeAddressChange < -15;
  const hasActiveAddressRise = data.onChain && data.onChain.activeAddressChange > 15;
  
  // 리스크 요인 분석
  const riskFactors: string[] = [];
  if (negativeNewsPercent > 30) riskFactors.push(`뉴스 부정 ${negativeNewsPercent.toFixed(1)}%`);
  if (negativeSocialPercent > 30) riskFactors.push(`소셜 부정 ${negativeSocialPercent.toFixed(1)}%`);
  if (hasHighNetflow) {
    const direction = data.onChain!.netflowPercent > 0 ? '대량 유입' : '대량 유출';
    riskFactors.push(`온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% ${direction}`);
  }
  if (hasLargePriceDrop) riskFactors.push(`가격 ${Math.abs(data.priceChange).toFixed(1)}% 급락`);
  if (hasLargePriceRise) riskFactors.push(`가격 ${data.priceChange.toFixed(1)}% 급등`);
  
  // 큰 이벤트 우선 언급 (간결하고 자연스럽게, 리스크 해석 중심)
  if (hasLargePriceDrop) {
    if (negativeNewsPercent > 30 || negativeSocialPercent > 30) {
      return `부정 뉴스·소셜 증가(${Math.max(negativeNewsPercent, negativeSocialPercent).toFixed(1)}%)와 가격 ${Math.abs(data.priceChange).toFixed(1)}% 급락으로 리스크 상승. 신중 접근 필요`;
    }
    if (hasHighNetflow) {
      const direction = data.onChain!.netflowPercent > 0 ? '대량 유입' : '대량 유출';
      return `가격 ${Math.abs(data.priceChange).toFixed(1)}% 급락과 온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% ${direction}로 리스크 상승. 단기 조정 가능성`;
    }
    return `가격 ${Math.abs(data.priceChange).toFixed(1)}% 급락으로 리스크 상승. 변동성 커서 신중 접근 필요`;
  }
  
  if (hasLargePriceRise) {
    if (data.newsStats.positive > data.newsStats.negative * 2) {
      return `긍정 뉴스 우세(${data.newsStats.positive}개)와 가격 ${data.priceChange.toFixed(1)}% 급등으로 강세. 과열 가능성 있어 주의`;
    }
    if (hasHighNetflow && data.onChain!.netflowPercent < 0) {
      return `가격 ${data.priceChange.toFixed(1)}% 급등인데 온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% 대량 유출로 과매수 구간 가능`;
    }
    return `가격 ${data.priceChange.toFixed(1)}% 급등으로 변동성 증가. 관찰하며 신중 접근 필요`;
  }

  if (hasModeratePriceDrop) {
    if (negativeNewsPercent > 20 || negativeSocialPercent > 20) {
      return `부정 감정 증가(${Math.max(negativeNewsPercent, negativeSocialPercent).toFixed(1)}%)와 가격 ${Math.abs(data.priceChange).toFixed(1)}% 하락으로 리스크 중간 수준`;
    }
    return `가격 ${Math.abs(data.priceChange).toFixed(1)}% 하락. 시장 상황 지속 관찰 필요`;
  }

  if (hasModeratePriceRise) {
    return `가격 ${data.priceChange.toFixed(1)}% 상승. 긍정 신호지만 계속 관찰 필요`;
  }
  
  if (hasHighNetflow) {
    const direction = data.onChain!.netflowPercent > 0 ? '대량 유입' : '대량 유출';
    return `온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% ${direction}로 리스크 ${direction === '대량 유입' ? '하락' : '상승'} 가능. 주의 관찰 필요`;
  }

  if (hasModerateNetflow) {
    const direction = data.onChain!.netflowPercent > 0 ? '유입' : '유출';
    return `온체인 ${Math.abs(data.onChain!.netflowPercent).toFixed(1)}% ${direction} 있음. 시장 움직임 관찰 필요`;
  }
  
  if (hasActiveAddressDrop) {
    return `활성 주소 ${Math.abs(data.onChain!.activeAddressChange).toFixed(1)}% 급감으로 네트워크 활동 저하. 시장 관심도 하락 가능`;
  }

  if (hasActiveAddressRise) {
    return `활성 주소 ${data.onChain!.activeAddressChange.toFixed(1)}% 증가로 네트워크 활동 활발. 긍정 신호`;
  }
  
  if (riskLevel === 'LOW') {
    if (negativeNewsPercent < 10 && negativeSocialPercent < 10) {
      return `긍정 뉴스·소셜(부정 ${Math.max(negativeNewsPercent, negativeSocialPercent).toFixed(1)}%)로 안정적 시장 환경. 리스크 낮음`;
    }
    return `낮은 부정 감정(뉴스 ${negativeNewsPercent.toFixed(1)}%, 소셜 ${negativeSocialPercent.toFixed(1)}%)과 안정 가격으로 리스크 낮음`;
  } else if (riskLevel === 'MEDIUM') {
    if (negativeNewsPercent > 20 || negativeSocialPercent > 20) {
      return `부정 감정 증가(뉴스 ${negativeNewsPercent.toFixed(1)}%, 소셜 ${negativeSocialPercent.toFixed(1)}%)로 리스크 중간 수준. 주의 관찰 필요`;
    }
    return `혼재된 시장 신호로 리스크 중간 수준. 긍정과 부정이 섞여 있어 주의 관찰 필요`;
  } else {
    if (negativeNewsPercent > 30 || negativeSocialPercent > 30) {
      return `부정 감정 급증(뉴스 ${negativeNewsPercent.toFixed(1)}%, 소셜 ${negativeSocialPercent.toFixed(1)}%)으로 리스크 높음. 신중 접근 강력 권장`;
    }
    if (hasLargePriceDrop || hasHighNetflow) {
      return `가격 급락 또는 온체인 이상으로 리스크 높음. 신중 접근 권장`;
    }
    return `높은 부정 감정으로 리스크 높음. 신중 접근 권장`;
  }
};

