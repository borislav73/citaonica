(function () {
  var nav = document.getElementById("chapbar");
  if (!nav) return;

  function navOffset() {
    var bar = document.querySelector(".topnav");
    var h = bar ? bar.getBoundingClientRect().height : 0;
    document.documentElement.style.scrollPaddingTop = Math.ceil(h + 8) + "px";
    return h + 12;
  }

  function labelOf(el) {
    var t = (el.textContent || "").trim();
    var m = t.match(/Chapter\s+([IVXLCDM]+|\d+)/i);
    if (m) return m[1];
    m = t.match(/^(\d+)\./);
    if (m) return m[1];
    if (t.length <= 18) return t;
    return t.split(/\s+/).slice(0, 3).join(" ");
  }

  function bind(links) {
    function sync() {
      var line = navOffset();
      var current = links[0];
      links.forEach(function (item) {
        if (!item.el) return;
        if (item.el.getBoundingClientRect().top <= line + 1) current = item;
      });
      links.forEach(function (item) {
        item.a.classList.toggle("is-here", item === current);
      });
      if (current && current.a && current.a.scrollIntoView) {
        var a = current.a;
        var r = a.getBoundingClientRect();
        var nr = nav.getBoundingClientRect();
        if (r.left < nr.left + 8 || r.right > nr.right - 8) {
          a.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
        }
      }
    }
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  if (nav.querySelector("a")) {
    var existing = [].slice.call(nav.querySelectorAll("a")).map(function (a) {
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      return { a: a, el: id ? document.getElementById(id) : null };
    });
    bind(existing);
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
      el.id = id;
    }
    var a = document.createElement("a");
    a.href = "#" + el.id;
    a.textContent = labelOf(el);
    nav.appendChild(a);
    links.push({ el: el, a: a });
  });
  bind(links);
})();
