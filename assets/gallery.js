document.addEventListener("DOMContentLoaded", () => {
  const zoom = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m14.2 14.2 4.8 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const lightbox = document.createElement("div");
  lightbox.className = "photo-lightbox";
  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `<div class="photo-lightbox-content" role="dialog" aria-modal="true" aria-label="Photo viewer"><img class="photo-lightbox-image" alt=""><p class="photo-lightbox-caption"></p></div><button type="button" class="photo-lightbox-close" aria-label="Close photo viewer">&times;</button>`;
  document.body.append(lightbox);
  const image = lightbox.querySelector(".photo-lightbox-image");
  const caption = lightbox.querySelector(".photo-lightbox-caption");
  const closeButton = lightbox.querySelector(".photo-lightbox-close");
  let previousFocus = null;
  function close() {
    lightbox.classList.remove("is-open");
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    image.removeAttribute("src");
    previousFocus?.focus();
  }
  function open(src, text) {
    previousFocus = document.activeElement;
    image.src = src;
    image.alt = text;
    caption.textContent = text;
    caption.hidden = !text;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    requestAnimationFrame(() => lightbox.classList.add("is-open"));
    closeButton.focus();
  }
  for (const list of document.querySelectorAll(".photo-list")) {
    const folder = list.dataset.folder || "";
    const first = Number(list.dataset.first);
    const last = Number(list.dataset.last);
    let captions = {};
    try { captions = JSON.parse(list.dataset.captions || "{}"); } catch (error) { console.warn("Invalid photo captions", error); }
    if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) continue;
    for (let n = first; n <= last; n++) {
      const number = String(n).padStart(2, "0");
      const src = `${folder}IMG_${number}.jpg`;
      const text = captions[String(n)] || "";
      const link = document.createElement("a");
      link.className = "photo-link";
      link.href = src;
      link.setAttribute("aria-label", text ? `View photo: ${text}` : `View photo ${n}`);
      const img = document.createElement("img");
      img.className = "photo-thumb";
      img.src = src;
      img.alt = text;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        link.classList.add("is-missing");
        link.removeAttribute("href");
        link.tabIndex = -1;
        link.setAttribute("aria-label", `Placeholder for IMG_${number}.jpg`);
        if (!link.querySelector(".photo-missing")) {
          const fallback = document.createElement("span");
          fallback.className = "photo-missing";
          fallback.textContent = `IMG_${number}.jpg`;
          link.append(fallback);
        }
      });
      const icon = document.createElement("span");
      icon.className = "photo-zoom-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = zoom;
      link.append(img, icon);
      link.addEventListener("click", event => {
        event.preventDefault();
        if (!link.classList.contains("is-missing")) open(src, text);
      });
      list.append(link);
    }
  }
  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", event => { if (event.target === lightbox) close(); });
  document.addEventListener("keydown", event => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "Tab") { event.preventDefault(); closeButton.focus(); }
  });
});
