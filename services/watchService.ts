// Watch 모드 서비스

import { WatchRule, WatchCondition, WatchNotification, CoinData } from '../types';

const STORAGE_KEY = 'coinguard_watch_rules';
const NOTIFICATIONS_STORAGE_KEY = 'coinguard_watch_notifications';

// Watch 규칙 로드
export const loadWatchRules = (): WatchRule[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('[Watch] Failed to load watch rules:', error);
    return [];
  }
};

// Watch 규칙 저장
export const saveWatchRules = (rules: WatchRule[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error('[Watch] Failed to save watch rules:', error);
  }
};

// Watch 규칙 추가
export const addWatchRule = (rule: Omit<WatchRule, 'id' | 'createdAt'>): WatchRule => {
  const rules = loadWatchRules();
  const newRule: WatchRule = {
    ...rule,
    id: `watch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  rules.push(newRule);
  saveWatchRules(rules);
  return newRule;
};

// Watch 규칙 업데이트
export const updateWatchRule = (id: string, updates: Partial<WatchRule>): void => {
  const rules = loadWatchRules();
  const index = rules.findIndex(r => r.id === id);
  if (index !== -1) {
    rules[index] = { ...rules[index], ...updates };
    saveWatchRules(rules);
  }
};

// Watch 규칙 삭제
export const deleteWatchRule = (id: string): void => {
  const rules = loadWatchRules();
  const filtered = rules.filter(r => r.id !== id);
  saveWatchRules(filtered);
};

// 조건 체크 함수
const checkCondition = (condition: WatchCondition, coin: CoinData): boolean => {
  const { analysis, change24h } = coin;
  
  if (!analysis || !analysis.stats) {
    return false;
  }

  const { stats } = analysis;

  switch (condition.type) {
    case 'news_risk_tag':
      if (!condition.riskTag) return false;
      // riskTags가 없으면 false
      if (!stats.news.riskTags || stats.news.riskTags.length === 0) return false;
      return stats.news.riskTags.includes(condition.riskTag);
    
    case 'social_negative':
      if (stats.social.totalCount === 0) return false;
      const socialNegativePercent = (stats.social.negativeCount / stats.social.totalCount) * 100;
      return compareValues(socialNegativePercent, condition.operator, condition.value as number);
    
    case 'onchain_netflow':
      // onChain 데이터가 없으면 false
      if (!stats.onChain) return false;
      return compareValues(stats.onChain.netflowPercent, condition.operator, condition.value as number);
    
    case 'onchain_active_address':
      // onChain 데이터가 없으면 false
      if (!stats.onChain) return false;
      return compareValues(stats.onChain.activeAddressChange, condition.operator, condition.value as number);
    
    case 'price_change':
      // change24h가 undefined이면 false
      if (change24h === undefined || change24h === null) return false;
      return compareValues(change24h, condition.operator, condition.value as number);
    
    case 'risk_score':
      // riskScore가 -1이면 계산 불가 상태이므로 false
      if (analysis.riskScore === -1 || analysis.riskScore === undefined || analysis.riskScore === null) {
        return false;
      }
      return compareValues(analysis.riskScore, condition.operator, condition.value as number);
    
    case 'risk_level':
      // riskLevel이 없거나 유효하지 않으면 false
      if (!analysis.riskLevel || analysis.riskLevel === 'LOW' && analysis.riskScore === -1) {
        return false;
      }
      const riskLevelValue = getRiskLevelValue(analysis.riskLevel);
      const targetValue = getRiskLevelValue(condition.value as string);
      return compareValues(riskLevelValue, condition.operator, targetValue);
    
    default:
      return false;
  }
};

// 값 비교 헬퍼
const compareValues = (actual: number, operator: WatchCondition['operator'], target: number): boolean => {
  switch (operator) {
    case '>': return actual > target;
    case '<': return actual < target;
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    case '==': return Math.abs(actual - target) < 0.01; // 부동소수점 비교
    default: return false;
  }
};

// 리스크 레벨을 숫자로 변환
const getRiskLevelValue = (level: string): number => {
  switch (level) {
    case 'LOW': return 1;
    case 'MEDIUM': return 2;
    case 'HIGH': return 3;
    case 'EXTREME': return 4;
    default: return 0;
  }
};

// Watch 조건 체크 (모든 조건이 AND로 연결됨)
export const checkWatchConditions = (rule: WatchRule, coin: CoinData): boolean => {
  if (!rule.enabled) return false;
  
  // 코인 필터링
  if (rule.coinSymbols && rule.coinSymbols.length > 0) {
    if (!rule.coinSymbols.includes(coin.symbol)) {
      return false;
    }
  }
  
  // 모든 조건이 만족되어야 함 (AND)
  if (rule.conditions.length === 0) return false;
  
  return rule.conditions.every(condition => checkCondition(condition, coin));
};

// 알림 메시지 생성
const generateNotificationMessage = (rule: WatchRule, coin: CoinData): string => {
  const conditionDescriptions = rule.conditions.map(cond => {
    switch (cond.type) {
      case 'news_risk_tag':
        return `${cond.riskTag} 관련 뉴스 감지`;
      case 'social_negative':
        return `소셜 부정 ${cond.operator} ${cond.value}%`;
      case 'onchain_netflow':
        return `온체인 순유입/유출 ${cond.operator} ${cond.value}%`;
      case 'onchain_active_address':
        return `활성 주소 변화 ${cond.operator} ${cond.value}%`;
      case 'price_change':
        return `가격 변동 ${cond.operator} ${cond.value}%`;
      case 'risk_score':
        return `리스크 점수 ${cond.operator} ${cond.value}`;
      case 'risk_level':
        return `리스크 레벨 ${cond.operator} ${cond.value}`;
      default:
        return '';
    }
  }).filter(Boolean);
  
  return `${coin.name}(${coin.symbol}): ${conditionDescriptions.join(', ')}`;
};

// 브라우저 알림 권한 요청
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('[Watch] Browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    console.warn('[Watch] Notification permission denied');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// 브라우저 알림 발송
const sendBrowserNotification = (message: string, coin: CoinData): void => {
  if (Notification.permission !== 'granted') {
    return;
  }
  
  try {
    // CoinData의 id가 coingeckoId와 동일하다고 가정
    const coingeckoId = (coin as any).coingeckoId || coin.id;
    const notification = new Notification('CoinGuard 알림', {
      body: message,
      icon: `https://assets.coingecko.com/coins/images/${getCoinImagePath(coingeckoId)}/large/${coingeckoId}.png`,
      badge: '/favicon.ico',
      tag: `watch_${coin.symbol}_${Date.now()}`,
      requireInteraction: false,
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    // 5초 후 자동 닫기
    setTimeout(() => notification.close(), 5000);
  } catch (error) {
    console.error('[Watch] Failed to send browser notification:', error);
  }
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

// 알림 기록 저장
const saveNotification = (notification: WatchNotification): void => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const notifications: WatchNotification[] = stored ? JSON.parse(stored) : [];
    notifications.unshift(notification); // 최신이 앞에
    // 최대 100개만 저장
    const limited = notifications.slice(0, 100);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('[Watch] Failed to save notification:', error);
  }
};

// 알림 기록 로드
export const loadNotifications = (): WatchNotification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('[Watch] Failed to load notifications:', error);
    return [];
  }
};

// 알림 읽음 처리
export const markNotificationAsRead = (id: string): void => {
  try {
    const notifications = loadNotifications();
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].read = true;
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('[Watch] Failed to mark notification as read:', error);
  }
};

// 알림 삭제
export const deleteNotification = (id: string): void => {
  try {
    const notifications = loadNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[Watch] Failed to delete notification:', error);
  }
};

// 알림 발송 (브라우저 + 인앱)
export const triggerNotification = (
  rule: WatchRule,
  coin: CoinData,
  onInAppNotification?: (notification: WatchNotification) => void
): void => {
  const message = generateNotificationMessage(rule, coin);
  
  // 브라우저 알림
  sendBrowserNotification(message, coin);
  
  // 인앱 알림 생성
  const notification: WatchNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    watchRuleId: rule.id,
    watchRuleName: rule.name,
    coinSymbol: coin.symbol,
    coinName: coin.name,
    message,
    triggeredAt: new Date().toISOString(),
    read: false,
  };
  
  // 알림 기록 저장
  saveNotification(notification);
  
  // 인앱 알림 콜백 호출
  if (onInAppNotification) {
    onInAppNotification(notification);
  }
  
  // Watch 규칙의 lastTriggered 업데이트
  updateWatchRule(rule.id, { lastTriggered: new Date().toISOString() });
};

// 모든 Watch 규칙 체크
export const checkAllWatchRules = (
  coins: CoinData[],
  onNotification?: (notification: WatchNotification) => void
): void => {
  const rules = loadWatchRules();
  const enabledRules = rules.filter(r => r.enabled);
  
  enabledRules.forEach(rule => {
    coins.forEach(coin => {
      if (checkWatchConditions(rule, coin)) {
        // 중복 알림 방지: 마지막 알림 후 1분 이내면 스킵
        if (rule.lastTriggered) {
          const lastTriggered = new Date(rule.lastTriggered);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastTriggered.getTime()) / (1000 * 60);
          if (diffMinutes < 1) {
            return; // 1분 이내면 스킵
          }
        }
        
        triggerNotification(rule, coin, onNotification);
      }
    });
  });
};

