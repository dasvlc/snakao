(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-setlang]");
  const setLanguage = lang => {
    const next = lang === "ja" ? "ja" : "en";
    root.lang = next;
    root.dataset.language = next;
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.setlang === next)));
    try { localStorage.setItem("site-language", next); } catch (e) {}
  };
  let saved = null;
  try { saved = localStorage.getItem("site-language"); } catch (e) {}
  setLanguage(saved || (navigator.language.startsWith("ja") ? "ja" : "en"));
  buttons.forEach(button => button.addEventListener("click", () => setLanguage(button.dataset.setlang)));
})();
