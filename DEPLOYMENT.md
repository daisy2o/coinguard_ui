# Vercel 배포 가이드

## 1단계: GitHub 저장소 생성 및 푸시

1. GitHub에 로그인하고 새 저장소 생성:
   - https://github.com/new 접속
   - 저장소 이름 입력 (예: `coinguard-frontend`)
   - Public 또는 Private 선택
   - "Create repository" 클릭

2. 저장소 URL을 복사한 후 아래 명령어 실행:

```bash
cd /Users/daisy/Documents/GitHub/NewCoinguard/front_ui
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## 2단계: Vercel에서 배포

1. https://vercel.com 접속
2. "Sign Up" 또는 "Log In" 클릭
3. "Continue with GitHub" 선택하여 GitHub 계정으로 로그인
4. "Add New Project" 클릭
5. 방금 만든 GitHub 저장소 선택
6. 프로젝트 설정:
   - **Framework Preset**: Vite (자동 감지됨)
   - **Root Directory**: `./` (또는 비워두기)
   - **Build Command**: `npm run build` (자동 설정됨)
   - **Output Directory**: `dist` (자동 설정됨)
7. **Environment Variables** 추가:
   - `VITE_API_BASE_URL`: 백엔드 API URL (예: `https://your-backend.vercel.app` 또는 실제 백엔드 URL)
   - `VITE_OPENAI_API_KEY`: OpenAI API 키
   - `GEMINI_API_KEY`: Gemini API 키
8. "Deploy" 클릭
9. 배포 완료 후 생성된 URL (예: `https://your-project.vercel.app`)을 복사하여 제출

## 참고사항

- 백엔드가 로컬(`localhost:3000`)에만 있다면, 백엔드도 함께 배포해야 합니다.
- 환경 변수는 Vercel 대시보드에서 언제든지 수정할 수 있습니다.
- 코드를 푸시하면 자동으로 재배포됩니다.

