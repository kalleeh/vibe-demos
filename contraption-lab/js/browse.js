// contraption-lab/js/browse.js
// Community levels browse screen: tabs, canvas thumbnails, play, like.

import { cloud, listLevels, rateLevel, hasRated, likesCount } from "./cloud.js";
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

/**
 * Render the browse screen: fetch community levels, show cards with thumbnails + metadata.
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

  const levels = await listLevels(tab);

  if (!levels || levels.length === 0) {
    const msg = document.createElement("p");
    msg.className = "browsemsg";
    msg.textContent = "No community levels yet — be the first to publish!";
    container.appendChild(msg);
    return;
  }

  // Build a card for each level
  for (const level of levels) {
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

  // Wire click
  el.onclick = async () => {
    if (!cloud.available) return;

    const newState = await rateLevel(id);
    el.textContent = newState ? "♥" : "♡";

    // Update displayed like count (optimistic: read from button's dataset + ±1)
    const currentLikes = parseInt(el.dataset.likes, 10) || 0;
    const newLikes = newState ? currentLikes + 1 : Math.max(0, currentLikes - 1);
    el.dataset.likes = newLikes;

    // Update the stats text in the sibling .browsestats
    const card = el.closest(".browsecard");
    if (card) {
      const stats = card.querySelector(".browsestats");
      if (stats) {
        const match = stats.textContent.match(/(\d+)\s+plays/);
        const plays = match ? match[1] : "0";
        stats.textContent = `${plays} plays · ${newLikes} likes`;
      }
    }
  };
}
