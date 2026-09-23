(function () {
  var nav = document.getElementById("chapbar");
  if (!nav) return;

  function barHeight() {
    var bar = document.querySelector(".topnav");
    return bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
  }

  function applyScrollPad() {
    document.documentElement.style.scrollPaddingTop = barHeight() + "px";
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

  function jumpTo(el) {
    if (!el) return;
    applyScrollPad();
    var y = window.scrollY + el.getBoundingClientRect().top - barHeight() - 1;
    window.scrollTo(0, Math.max(0, y));
  }

  function bind(links) {
    function sync() {
      applyScrollPad();
      var line = barHeight() + 28;
      var current = links[0];
      links.forEach(function (item) {
        if (!item.el) return;
        if (item.el.getBoundingClientRect().top <= line) current = item;
      });
      links.forEach(function (item) {
        item.a.classList.toggle("is-here", item === current);
      });
      if (current && current.a) {
        var a = current.a;
        var r = a.getBoundingClientRect();
        var nr = nav.getBoundingClientRect();
        if (r.left < nr.left + 8 || r.right > nr.right - 8) {
          a.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
        }
      }
    }

    nav.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[href^='#']");
      if (!a || !nav.contains(a)) return;
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      var el = id && document.getElementById(id);
      if (!el) return;
      ev.preventDefault();
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      jumpTo(el);
      requestAnimationFrame(sync);
    });

    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  if (nav.querySelector("a")) {
    bind([].slice.call(nav.querySelectorAll("a")).map(function (a) {
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      return { a: a, el: id ? document.getElementById(id) : null };
    }));
    return;
  }

  var nodes = document.querySelectorAll("h3.chapn[id], article.unit[id] > h2.sec");
  if (!nodes.length) {
    nav.hidden = true;
    return;
  }

  var links = [];
  nodes.forEach(function (el, i) {
    if (!el.id) {
      var art = el.closest("article.unit");
      el.id = (art && art.id) ? art.id : "sec-" + (i + 1);
    }
    var a = document.createElement("a");
    a.href = "#" + el.id;
    a.textContent = labelOf(el);
    nav.appendChild(a);
    links.push({ el: el, a: a });
  });
  bind(links);
})();
