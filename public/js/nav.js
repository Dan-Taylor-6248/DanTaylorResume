// Progressive-enhancement mobile nav toggle. The toggle button ships
// with the `hidden` attribute in HTML, and the menu itself has no
// hidden state at all, so without this script the nav just displays
// as a normal, always-visible list — nothing breaks if JS fails to load.
(function () {
  var toggles = document.querySelectorAll('.nav-toggle[aria-controls]');

  toggles.forEach(function (btn) {
    var menu = document.getElementById(btn.getAttribute('aria-controls'));
    if (!menu) return;

    btn.hidden = false;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', function () {
      var willOpen = menu.hidden;
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });
})();
