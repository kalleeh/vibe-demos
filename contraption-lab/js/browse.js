// contraption-lab/js/browse.js
// Community levels browse screen: tabs, canvas thumbnails, play, like.

import { cloud, listLevels, rateLevel, hasRated, likesCount } from "./cloud.js";
import { validateLevel } from "./level.js";
import { Sim } from "./engine.js";
import { drawWorld } from "./render.js";
import { fitTransform } from "./geom.js";
import { tokens } from "./theme.js";

/**
 * Draw a single frame of the level to the given canvas. No animation, pure thumbnail.
 * @param {object} levelData - level JSON (the `.data` field from a cloud level card)
 * @param {HTMLCanvasElement} canvas - target canvas (already sized)
 */
export function thumbnailFor(levelData, canvas) {
  // Only build a Sim from a structurally valid level (a malformed community blob
  // shouldn't even attempt construction — leave the card's canvas blank).
  if (!validateLevel(levelData).ok) return;
  try {
    // Build throwaway sim (no run, just the initial state)
    const sim = new Sim(levelData);
    const ctx = canvas.getContext("2d");
    const transform = fitTransform(1280, 720, canvas.width, canvas.height);
    const theme = tokens();

    drawWorld(ctx, sim, transform, theme, { themeId: document.documentElement.dataset.theme });
  } catch {
    // Bad/corrupt level → leave canvas blank (already zeroed by browser)
  }
}

const BROWSE_PER_PAGE = 24;

function appendLevelCard(container, level) {
  const card = document.createElement("div");
  card.className = "browsecard";

  // Thumbnail canvas
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  canvas.className = "browsethumb";
  thumbnailFor(level.data, canvas);

  // Metadata
  const meta = document.createElement("div");
  meta.className = "browsemeta";

  const title = document.createElement("h4");
  title.textContent = level.title;

  const author = document.createElement("p");
  author.className = "browseauthor";
  author.textContent = `by ${level.author_name}`;

  const stats = document.createElement("p");
  stats.className = "browsestats";
  stats.textContent = `${level.plays} plays · ${level.likes} likes`;

  // Play button
  const playBtn = document.createElement("button");
  playBtn.className = "browsebtn";
  playBtn.textContent = "Play";
  playBtn.onclick = () => {
    location.hash = `#/play/community/${level.id}`;
  };

  // Like button (heart)
  const likeBtn = document.createElement("button");
  likeBtn.className = "browsebtn likeBtn";
  likeBtn.dataset.levelId = level.id;
  likeBtn.dataset.likes = level.likes;

  meta.appendChild(title);
  meta.appendChild(author);
  meta.appendChild(stats);
  meta.appendChild(playBtn);
  meta.appendChild(likeBtn);

  card.appendChild(canvas);
  card.appendChild(meta);
  container.appendChild(card);

  // Mount like button async
  mountLikeButton(likeBtn, level.id);
}

/**
 * Render the browse screen: fetch community levels, show cards with thumbnails + metadata.
 * Appends a "Load more" button when a full page comes back (more may exist).
 * @param {HTMLElement} container - the #browseGrid element
 * @param {string} tab - "recent" | "played" | "rated"
 */
export async function renderBrowse(container, tab = "recent") {
  container.innerHTML = "";

  if (!cloud.available) {
    const msg = document.createElement("p");
    msg.className = "browsemsg";
    msg.textContent = "Sign in or connect to browse community levels.";
    container.appendChild(msg);
    return;
  }

  const levels = await listLevels(tab, 1, BROWSE_PER_PAGE);

  if (!levels || levels.length === 0) {
    const msg = document.createElement("p");
    msg.className = "browsemsg";
    msg.textContent = "No community levels yet — be the first to publish!";
    container.appendChild(msg);
    return;
  }

  for (const level of levels) appendLevelCard(container, level);

  if (levels.length === BROWSE_PER_PAGE) {
    mountLoadMoreButton(container, tab, 2);
  }
}

/**
 * Append a "Load more" button; clicking fetches the next page, appends its cards,
 * and re-mounts itself for the following page (or removes itself once a short
 * page comes back — the tab-sort re-sorts only within each fetched page, so
 * "most played"/"top rated" ordering is approximate past the first page, same
 * tradeoff as the original single-page fetch).
 */
function mountLoadMoreButton(container, tab, nextPage) {
  const btn = document.createElement("button");
  btn.className = "browsebtn loadmorebtn";
  btn.textContent = "Load more";
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const more = await listLevels(tab, nextPage, BROWSE_PER_PAGE);
      btn.remove();
      for (const level of more) appendLevelCard(container, level);
      if (more.length === BROWSE_PER_PAGE) {
        mountLoadMoreButton(container, tab, nextPage + 1);
      }
    } catch {
      btn.disabled = false;
      btn.textContent = "Load more";
    }
  };
  container.appendChild(btn);
}

/**
 * Wire up a like button: reflects initial state, toggles on click.
 * @param {HTMLButtonElement} el - the button element
 * @param {string} id - community level id
 */
export async function mountLikeButton(el, id) {
  if (!cloud.available) {
    el.textContent = "♡";
    el.disabled = true;
    return;
  }

  // Set initial state
  const rated = await hasRated(id);
  el.textContent = rated ? "♥" : "♡";

  // Wire click — disable while pending (no double-count) and revert on failure.
  el.onclick = async () => {
    if (!cloud.available || el.disabled) return;
    el.disabled = true;
    try {
      const newState = await rateLevel(id);
      el.textContent = newState ? "♥" : "♡";
      const currentLikes = parseInt(el.dataset.likes, 10) || 0;
      const newLikes = newState ? currentLikes + 1 : Math.max(0, currentLikes - 1);
      el.dataset.likes = newLikes;
      const card = el.closest(".browsecard");
      if (card) {
        const stats = card.querySelector(".browsestats");
        if (stats) {
          const match = stats.textContent.match(/(\d+)\s+plays/);
          const plays = match ? match[1] : "0";
          stats.textContent = `${plays} plays · ${newLikes} likes`;
        }
      }
    } catch { /* network hiccup: leave the prior state; user can retry */ }
    finally { el.disabled = false; }
  };
}
