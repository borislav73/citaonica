(function () {
  var openBtn = document.getElementById("shelf-open");
  var closeBtn = document.getElementById("shelf-close");
  function setOpen(on) {
    document.body.classList.toggle("shelf-open", on);
  }
  if (openBtn) openBtn.addEventListener("click", function () { setOpen(true); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
})();
