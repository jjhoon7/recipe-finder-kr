const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const normalizedPath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=600"
    });
    res.end(data);
  });
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'");
}

function stripTags(text) {
  return decodeHtml(String(text || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function oneYearAgoIso() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString();
}

function normalizeUrl(url) {
  try {
    return decodeHtml(url).replace(/\\u0026/g, "&");
  } catch {
    return url;
  }
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function searchNaverBlogs(foodName) {
  const query = `${foodName} 레시피`;
  const url = new URL("https://search.naver.com/search.naver");
  url.searchParams.set("where", "blog");
  url.searchParams.set("query", query);
  url.searchParams.set("sm", "tab_opt");
  url.searchParams.set("nso", "so:r,p:1y");

  const html = await fetchText(url.toString());
  const items = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) && items.length < 8) {
    const attrs = match[1];
    const body = match[2];
    const hrefMatch = attrs.match(/href="([^"]+)"/i);
    if (!hrefMatch) continue;

    const link = normalizeUrl(hrefMatch[1]);
    const isTitleAnchor = /headline|title_link|total_tit/i.test(attrs + body);
    if (!isTitleAnchor) continue;

    const title = stripTags(match[2]);
    if (!title || !/^https:\/\/blog\.naver\.com\//.test(link)) continue;

    items.push({
      title,
      url: link,
      source: "Naver Blog",
      badge: "최근 1년 관련도순"
    });
  }

  return {
    url: url.toString(),
    items: uniqueByUrl(items).slice(0, 3)
  };
}

async function searchYouTubeWithApi(foodName) {
  const query = `${foodName} 레시피`;
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "3");
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("publishedAfter", oneYearAgoIso());
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const data = JSON.parse(await fetchText(url.toString()));
  return {
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    items: (data.items || []).map((item) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      source: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
      badge: "최근 1년 조회수순"
    }))
  };
}

function findBalancedJson(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return "";

  const start = text.indexOf("{", markerIndex);
  if (start === -1) return "";

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return "";
}

function collectYouTubeVideos(node, items = []) {
  if (!node || typeof node !== "object" || items.length >= 10) return items;

  const renderer = node.videoRenderer;
  if (renderer?.videoId) {
    const titleRuns = renderer.title?.runs || [];
    const title = titleRuns.map((run) => run.text).join("").trim();
    const thumbnails = renderer.thumbnail?.thumbnails || [];
    const thumbnail = thumbnails[thumbnails.length - 1]?.url || "";

    if (title) {
      items.push({
        title,
        url: `https://www.youtube.com/watch?v=${renderer.videoId}`,
        source: renderer.ownerText?.runs?.[0]?.text || "YouTube",
        thumbnail,
        badge: "조회수 높은 검색 결과"
      });
    }
  }

  for (const value of Object.values(node)) {
    if (items.length >= 10) break;
    if (value && typeof value === "object") collectYouTubeVideos(value, items);
  }

  return items;
}

async function searchYouTubeFallback(foodName) {
  const query = `${foodName} 레시피`;
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", query);

  const html = await fetchText(url.toString());
  const jsonText = findBalancedJson(html, "ytInitialData");
  const data = jsonText ? JSON.parse(jsonText) : {};
  const items = uniqueByUrl(collectYouTubeVideos(data)).slice(0, 3);

  return {
    url: url.toString(),
    items
  };
}

async function searchYouTube(foodName) {
  if (YOUTUBE_API_KEY) {
    return searchYouTubeWithApi(foodName);
  }

  return searchYouTubeFallback(foodName);
}

async function handleSearch(req, res) {
  const { searchParams } = new URL(req.url, "http://localhost");
  const foodName = (searchParams.get("q") || "").trim();

  if (!foodName) {
    sendJson(res, 400, { error: "음식명을 입력해주세요." });
    return;
  }

  const [naverResult, youtubeResult] = await Promise.allSettled([
    searchNaverBlogs(foodName),
    searchYouTube(foodName)
  ]);

  const naver = naverResult.status === "fulfilled"
    ? naverResult.value
    : { url: "", items: [], error: "네이버 블로그 검색을 불러오지 못했습니다." };

  const youtube = youtubeResult.status === "fulfilled"
    ? youtubeResult.value
    : { url: "", items: [], error: "YouTube 검색을 불러오지 못했습니다." };

  sendJson(res, 200, {
    query: foodName,
    generatedAt: new Date().toISOString(),
    note: YOUTUBE_API_KEY
      ? "YouTube는 공식 API의 최근 1년 조회수순 결과를 사용합니다."
      : "YouTube API 키가 없어서 공개 검색 결과를 사용합니다. 정확한 최근 1년 조회수순 배포가 필요하면 YOUTUBE_API_KEY를 설정하세요.",
    naver,
    youtube
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/search") {
    handleSearch(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message || "검색 중 오류가 발생했습니다." });
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Recipe finder is running at http://localhost:${PORT}`);
});
