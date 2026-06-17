# 레시피 인기 검색 웹

음식명을 입력하면 네이버 블로그 레시피 글 3개와 YouTube 레시피 영상 3개를 찾아서 클릭 가능한 카드로 보여주는 웹앱입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 배포

Render, Railway, Fly.io 같은 Node.js 배포 환경에서 그대로 배포할 수 있습니다.

- Build command: 비워두기 또는 `npm install`
- Start command: `npm start`
- Environment: `Node.js 18+`

## YouTube 정확도 높이기

YouTube에서 “최근 1년 + 조회수순”을 정확히 적용하려면 YouTube Data API 키를 발급하고 환경 변수로 설정하세요.

```bash
YOUTUBE_API_KEY=발급받은키 npm start
```

API 키가 없으면 공개 YouTube 검색 결과를 읽는 폴백을 사용합니다. 네이버 블로그는 공개 검색의 최근 1년 관련도순 결과를 사용합니다.
