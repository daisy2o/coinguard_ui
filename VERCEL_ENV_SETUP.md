# Vercel 환경 변수 설정 가이드

## 현재 상태
- ✅ Production: VITE_OPENAI_API_KEY 설정됨
- ❌ Preview: VITE_OPENAI_API_KEY 없음

## Preview 환경에 API 키 추가하기

### 방법 1: Vercel 대시보드 (권장)
1. https://vercel.com/daisy2os-projects/front_ui/settings/environment-variables 접속
2. "Add New" 클릭
3. 다음 정보 입력:
   - **Key**: `VITE_OPENAI_API_KEY`
   - **Value**: `YOUR_OPENAI_API_KEY_HERE` (실제 API 키를 입력하세요)
   - **Environment**: Preview 선택
   - **Mark as sensitive**: 체크
4. "Save" 클릭

### 방법 2: 터미널에서 수동 실행
```bash
# Preview 환경에 추가
echo "YOUR_OPENAI_API_KEY_HERE" | vercel env add VITE_OPENAI_API_KEY preview
```

프롬프트가 나타나면:
1. "Mark as sensitive? (y/N)": `y` 입력
2. "Add to which Git branch?": 엔터만 누르기 (모든 Preview 브랜치에 적용)

## 환경 변수 확인
```bash
vercel env ls
```

## 중요 사항
- 환경 변수를 추가한 후 **새로운 배포가 필요**합니다
- 기존 배포는 환경 변수 변경을 자동으로 반영하지 않습니다
- 새로운 커밋을 푸시하거나 Vercel 대시보드에서 "Redeploy"를 클릭하세요
