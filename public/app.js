const form = document.querySelector("#search-form");
const input = document.querySelector("#food-input");
const statusEl = document.querySelector("#status");
const naverResults = document.querySelector("#naver-results");
const youtubeResults = document.querySelector("#youtube-results");
const template = document.querySelector("#result-card-template");

function setStatus(message) {
  statusEl.textContent = message;
}

function clearResults() {
  naverResults.replaceChildren();
  youtubeResults.replaceChildren();
}

function createEmptyState(message, linkUrl) {
  const box = document.createElement(linkUrl ? "a" : "div");
  box.className = "empty-state";
  box.textContent = message;

  if (linkUrl) {
    box.href = linkUrl;
    box.target = "_blank";
    box.rel = "noopener noreferrer";
  }

  return box;
}

function renderCards(container, items, options) {
  container.replaceChildren();

  if (!items.length) {
    container.append(createEmptyState(options.emptyMessage, options.searchUrl));
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const card = template.content.firstElementChild.cloneNode(true);
    const thumb = card.querySelector(".thumb");
    const badge = card.querySelector(".badge");
    const title = card.querySelector("h3");
    const source = card.querySelector("p");

    card.href = item.url;
    badge.textContent = item.badge || options.badge;
    title.textContent = item.title;
    source.textContent = item.source || options.source;

    if (item.thumbnail) {
      thumb.style.backgroundImage = `url("${item.thumbnail}")`;
    } else {
      thumb.classList.add("blog");
    }

    fragment.append(card);
  }

  container.append(fragment);
}

async function runSearch(foodName) {
  const button = form.querySelector("button");
  button.disabled = true;
  clearResults();
  setStatus(`"${foodName}" 레시피를 찾는 중입니다.`);

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(foodName)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "검색에 실패했습니다.");
    }

    renderCards(naverResults, data.naver.items || [], {
      badge: "최근 1년 관련도순",
      source: "Naver Blog",
      emptyMessage: data.naver.error || "네이버 블로그 결과가 없습니다. 검색 페이지로 이동합니다.",
      searchUrl: data.naver.url
    });

    renderCards(youtubeResults, data.youtube.items || [], {
      badge: "최근 1년 조회수순",
      source: "YouTube",
      emptyMessage: data.youtube.error || "YouTube 결과가 없습니다. 검색 페이지로 이동합니다.",
      searchUrl: data.youtube.url
    });

    const count = (data.naver.items || []).length + (data.youtube.items || []).length;
    setStatus(count ? `${count}개의 결과를 찾았습니다. 카드를 누르면 바로 열립니다.` : "결과를 찾지 못했습니다.");
  } catch (error) {
    setStatus(error.message || "검색 중 오류가 발생했습니다.");
  } finally {
    button.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const foodName = input.value.trim();
  if (foodName) runSearch(foodName);
});
