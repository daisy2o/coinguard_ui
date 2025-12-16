/**
 * 번역 서비스
 * 영어 텍스트를 한국어로 번역하는 기능 제공
 */

// 언어 감지: 간단한 휴리스틱 방법
export function detectLanguage(text: string): 'en' | 'ko' | 'auto' {
  if (!text || text.trim().length === 0) {
    return 'auto';
  }

  // 한글이 포함되어 있으면 한국어로 판단
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
  if (koreanRegex.test(text)) {
    return 'ko';
  }

  // 영어 문자 비율 확인
  const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) {
    return 'auto';
  }

  const englishRatio = englishChars / totalChars;
  
  // 영어 비율이 50% 이상이면 영어로 판단
  if (englishRatio > 0.5) {
    return 'en';
  }

  return 'auto';
}

// MyMemory Translation API를 사용한 번역
// 무료 티어: 일일 10,000자
async function translateWithMyMemory(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ko`;
    console.log('[Translation] API 호출:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[Translation] API 응답 실패:', response.status, response.statusText);
      throw new Error(`Translation API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Translation] API 응답 데이터:', data);
    
    // 응답 형식 확인
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      console.log('[Translation] 번역 성공:', translated);
      
      // 번역 결과가 원문과 같으면 실패로 간주
      if (translated.trim().toLowerCase() === text.trim().toLowerCase()) {
        console.warn('[Translation] 번역 결과가 원문과 동일합니다. 다른 API 시도...');
        throw new Error('Translation returned original text');
      }
      
      return translated;
    }
    
    // 다른 응답 형식 시도
    if (data.translatedText) {
      return data.translatedText;
    }
    
    console.error('[Translation] 응답 형식 오류:', data);
    throw new Error('Translation failed: invalid response format');
  } catch (error) {
    console.error('[Translation] MyMemory API 오류:', error);
    throw error;
  }
}

// LibreTranslate API (대안, 무료)
async function translateWithLibreTranslate(text: string): Promise<string> {
  try {
    // 여러 공개 LibreTranslate 서버 시도
    const servers = [
      'https://libretranslate.de/translate',
      'https://translate.argosopentech.com/translate',
      'https://libretranslate.com/translate'
    ];
    
    for (const server of servers) {
      try {
        const response = await fetch(server, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: 'en',
            target: 'ko',
            format: 'text'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Translation] LibreTranslate 응답:', data);
          
          if (data.translatedText && data.translatedText.trim() !== '') {
            return data.translatedText;
          }
        }
      } catch (serverError) {
        console.log(`[Translation] ${server} 실패, 다음 서버 시도...`);
        continue;
      }
    }
    
    throw new Error('All LibreTranslate servers failed');
  } catch (error) {
    console.error('[Translation] LibreTranslate 오류:', error);
    throw error;
  }
}

// Google Translate 웹 인터페이스 사용 (CORS 우회)
async function translateWithGoogleWeb(text: string): Promise<string> {
  try {
    // Google Translate의 웹 인터페이스를 통한 번역
    // 주의: 이 방법은 CORS 제한이 있을 수 있음
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Google Translate Web API failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Translation] Google Translate Web 응답:', data);
    
    // 응답 형식: [[["번역된 텍스트", "원문", null, null, 0]], null, "en"]
    if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
      const translatedParts = data[0]
        .filter((item: any) => item && item[0])
        .map((item: any) => item[0])
        .join('');
      
      if (translatedParts && translatedParts.trim() !== '') {
        return translatedParts;
      }
    }
    
    throw new Error('Google Translate Web: invalid response format');
  } catch (error) {
    console.error('[Translation] Google Translate Web 오류:', error);
    throw error;
  }
}

// Google Translate API (유료, 나중에 사용 가능)
// async function translateWithGoogle(text: string): Promise<string> {
//   const API_KEY = process.env.REACT_APP_GOOGLE_TRANSLATE_API_KEY;
//   if (!API_KEY) {
//     throw new Error('Google Translate API key not found');
//   }
//
//   const response = await fetch(
//     `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
//     {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         q: text,
//         source: 'en',
//         target: 'ko',
//       }),
//     }
//   );
//
//   if (!response.ok) {
//     throw new Error('Google Translate API request failed');
//   }
//
//   const data = await response.json();
//   return data.data.translations[0].translatedText;
// }

// 번역 캐시 (localStorage 사용)
const TRANSLATION_CACHE_KEY = 'coin_translations';
const MAX_CACHE_SIZE = 100; // 최대 캐시 항목 수

interface TranslationCache {
  [key: string]: {
    translatedText: string;
    timestamp: number;
  };
}

function getTranslationCache(): TranslationCache {
  try {
    const cached = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Failed to read translation cache:', error);
  }
  return {};
}

function setTranslationCache(cache: TranslationCache): void {
  try {
    // 캐시 크기 제한
    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_SIZE) {
      // 오래된 항목 제거 (타임스탬프 기준)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toKeep = entries.slice(-MAX_CACHE_SIZE);
      const newCache: TranslationCache = {};
      toKeep.forEach(([key, value]) => {
        newCache[key] = value;
      });
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(newCache));
    } else {
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Failed to save translation cache:', error);
  }
}

/**
 * 텍스트를 한국어로 번역
 * @param text 원문 텍스트
 * @returns 번역된 텍스트
 */
export async function translateToKorean(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // 언어 감지
  const detectedLang = detectLanguage(text);
  if (detectedLang === 'ko') {
    return text; // 이미 한국어면 번역 불필요
  }

  if (detectedLang !== 'en') {
    // 영어가 아니면 번역 시도하지 않음
    return text;
  }

  // 캐시 확인
  const cache = getTranslationCache();
  const cacheKey = text.trim().toLowerCase();
  
  if (cache[cacheKey]) {
    // 캐시된 번역이 7일 이내면 사용
    const cacheAge = Date.now() - cache[cacheKey].timestamp;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (cacheAge < sevenDays) {
      return cache[cacheKey].translatedText;
    }
  }

  // API 호출 (여러 번역 서비스 순차 시도)
  try {
    let translatedText: string;
    let lastError: Error | null = null;
    
    // 1. Google Translate Web 시도 (가장 안정적)
    try {
      translatedText = await translateWithGoogleWeb(text);
      console.log('[Translation] Google Translate Web 성공');
    } catch (googleError) {
      console.log('[Translation] Google Translate Web 실패, MyMemory 시도...');
      lastError = googleError as Error;
      
      // 2. MyMemory 시도
      try {
        translatedText = await translateWithMyMemory(text);
        console.log('[Translation] MyMemory 성공');
      } catch (myMemoryError) {
        console.log('[Translation] MyMemory 실패, LibreTranslate 시도...');
        lastError = myMemoryError as Error;
        
        // 3. LibreTranslate 시도
        try {
          translatedText = await translateWithLibreTranslate(text);
          console.log('[Translation] LibreTranslate 성공');
        } catch (libreError) {
          console.error('[Translation] 모든 번역 API 실패:', { googleError, myMemoryError, libreError });
          throw new Error('All translation APIs failed');
        }
      }
    }
    
    // 번역 결과가 원문과 같거나 비어있으면 실패로 간주
    if (!translatedText || translatedText.trim() === '' || 
        translatedText.trim().toLowerCase() === text.trim().toLowerCase()) {
      console.error('[Translation] 번역 결과가 유효하지 않습니다:', translatedText);
      throw new Error('Invalid translation result');
    }
    
    // 캐시에 저장
    cache[cacheKey] = {
      translatedText,
      timestamp: Date.now(),
    };
    setTranslationCache(cache);
    
    console.log('[Translation] 번역 완료 및 캐시 저장:', { original: text.substring(0, 50), translated: translatedText.substring(0, 50) });
    return translatedText;
  } catch (error) {
    console.error('[Translation] 번역 실패:', error);
    // 번역 실패 시 원문 반환 (에러 표시를 위해)
    throw error; // 에러를 throw하여 UI에서 처리할 수 있도록
  }
}

