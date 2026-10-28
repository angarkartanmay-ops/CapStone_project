// Picks the colour theme before the page paints, so dark mode never flashes light.
// Loaded as a plain blocking <script> in <head> (the CSP doesn't allow inline scripts).
// A saved choice wins; without one the system setting is followed, live.
(function () {
  var KEY = 'sw-theme';
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked: follow the system */ }

  function apply() {
    root.dataset.theme = saved === 'dark' || saved === 'light' ? saved : media.matches ? 'dark' : 'light';
  }
  apply();
  media.addEventListener('change', function () {
    if (saved) return;
    apply();
    window.dispatchEvent(new CustomEvent('themechange', { detail: root.dataset.theme }));
  });

  window.spillwayTheme = {
    current: function () { return root.dataset.theme; },
    set: function (theme) {
      saved = theme;
      try { localStorage.setItem(KEY, theme); } catch (e) { /* not saved, still applied */ }
      root.classList.add('theme-switching');
      apply();
      setTimeout(function () { root.classList.remove('theme-switching'); }, 400);
      window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
    },
  };
})();
