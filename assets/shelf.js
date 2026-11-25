(function () {
  var openBtn = document.getElementById("shelf-open");
  var closeBtn = document.getElementById("shelf-close");
  function isTouch() {
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }
  function setOpen(on) {
    document.body.classList.toggle("shelf-open", on);
  }
  if (openBtn) openBtn.addEventListener("click", function () { setOpen(true); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
  if (!isTouch()) setOpen(true);
  window.CitaonicaShelf = {
    close: function () { setOpen(false); },
    open: function () { setOpen(true); }
  };
})();

/* Klik na natpis "Ad fontes!" u bočnoj traci vodi na naslovnicu. */
(function () {
  var head = document.querySelector(".shelfbar-head");
  if (!head) return;
  var brand = document.querySelector("a.brand");
  var home = brand ? brand.getAttribute("href") : "index.html";
  head.setAttribute("title", "Početna");
  head.addEventListener("click", function (e) {
    if (e.target !== head) return;
    window.location.href = home;
  });
})();
