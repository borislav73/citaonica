(function () {
  var nav = document.getElementById("chapbar");
  if (!nav) return;

  function labelOf(el) {
    var t = (el.textContent || "").trim();
    var m = t.match(/Chapter\s+([IVXLCDM]+|\d+)/i);
    if (m) return m[1];
    m = t.match(/^(\d+)\./);
    if (m) return m[1];
    if (t.length <= 18) return t;
    return t.split(/\s+/).slice(0, 3).join(" ");
  }

  if (nav.querySelector("a")) {
    var existing = [].slice.call(nav.querySelectorAll("a"));
    function syncExisting() {
      var y = window.scrollY + 96;
      var current = existing[0];
      existing.forEach(function (a) {
        var id = (a.getAttribute("href") || "").replace(/^#/, "");
        var node = id && document.getElementById(id);
        if (node && node.getBoundingClientRect().top + window.scrollY <= y) current = a;
      });
      existing.forEach(function (a) {
        a.classList.toggle("is-here", a === current);
      });
    }
    window.addEventListener("scroll", syncExisting, { passive: true });
    syncExisting();
    return;
  }

  var nodes = document.querySelectorAll("h3.chapn[id], article.unit[id] > h2.sec");
  if (!nodes.length) {
    nav.hidden = true;
    return;
  }

  var links = [];
  nodes.forEach(function (el, i) {
    var id = el.id;
    if (!id) {
      var art = el.closest("article.unit");
      id = art && art.id ? art.id : "sec-" + (i + 1);
      if (!el.id) el.id = id + "-h";
    }
    var a = document.createElement("a");
    a.href = "#" + (el.id || id);
    a.textContent = labelOf(el);
    nav.appendChild(a);
    links.push({ el: el.id ? el : document.getElementById(id), a: a });
  });

  function sync() {
    var y = window.scrollY + 96;
    var current = links[0];
    links.forEach(function (item) {
      var node = item.el;
      if (!node) return;
      if (node.getBoundingClientRect().top + window.scrollY <= y) current = item;
    });
    links.forEach(function (item) {
      item.a.classList.toggle("is-here", item === current);
    });
    if (current && current.a && current.a.scrollIntoView) {
      current.a.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    }
  }

  window.addEventListener("scroll", sync, { passive: true });
  sync();
})();
