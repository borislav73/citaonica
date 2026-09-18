(function () {
  const sr = (document.documentElement.lang || "").indexOf("sr") === 0;
  const bookId = (document.querySelector('meta[name="book-title"]') || {}).content
    || document.title
    || location.pathname;
  const KEY = "citaonica-notes:" + bookId;
  const t = {
    mark: sr ? "Означи" : "Označi",
    note: sr ? "Биљешка" : "Bilješka",
    save: sr ? "Сачувај" : "Spremi",
    cancel: sr ? "Одустани" : "Odustani",
    remove: sr ? "Уклони" : "Ukloni",
    list: sr ? "Биљешке" : "Bilješke",
    empty: sr ? "Нема сачуваних биљешки на овој књизи." : "Nema spremljenih bilješki na ovoj knjizi.",
    prompt: sr ? "Упиши биљешку уз овај одломак:" : "Upiši bilješku uz ovaj odlomak:",
  };

  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(KEY) || "[]") || [];
  } catch (e) {
    items = [];
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function uid() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function popover(x, y, quote, range) {
    closePop();
    const box = document.createElement("div");
    box.className = "note-pop";
    box.id = "note-pop";
    box.style.left = Math.min(window.innerWidth - 220, Math.max(8, x)) + "px";
    box.style.top = Math.min(window.innerHeight - 80, Math.max(8, y)) + "px";
    const b1 = document.createElement("button");
    b1.type = "button";
    b1.textContent = t.mark;
    b1.addEventListener("click", function () {
      addItem({ kind: "mark", quote: quote });
      paint();
      closePop();
    });
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.textContent = t.note;
    b2.addEventListener("click", function () {
      const text = window.prompt(t.prompt, "");
      if (text === null) return;
      addItem({ kind: "note", quote: quote, text: text });
      paint();
      renderList();
      closePop();
    });
    box.appendChild(b1);
    box.appendChild(b2);
    document.body.appendChild(box);
  }

  function closePop() {
    const el = document.getElementById("note-pop");
    if (el) el.remove();
  }

  function addItem(partial) {
    items.push({
      id: uid(),
      kind: partial.kind,
      quote: (partial.quote || "").slice(0, 400),
      text: partial.text || "",
      at: Date.now(),
    });
    persist();
  }

  function removeItem(id) {
    items = items.filter(function (it) { return it.id !== id; });
    persist();
    paint();
    renderList();
  }

  function paint() {
    document.querySelectorAll("mark.user-hl").forEach(function (m) {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
    const root = document.querySelector("main") || document.body;
    items.forEach(function (it) {
      if (!it.quote || it.quote.length < 8) return;
      highlightFirst(root, it.quote);
    });
  }

  function highlightFirst(root, quote) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest("script, style, .tts-bar, .shelfbar, .topnav, .note-pop, .notes-panel, mark.user-hl")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(quote);
      if (idx === -1) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + quote.length);
      const mark = document.createElement("mark");
      mark.className = "user-hl";
      try {
        range.surroundContents(mark);
      } catch (e) {}
      return;
    }
  }

  function renderList() {
    let panel = document.getElementById("notes-panel");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "notes-panel";
      panel.className = "notes-panel";
      document.body.appendChild(panel);
    }
    panel.innerHTML = "";
    const h = document.createElement("p");
    h.className = "notes-panel-title";
    h.textContent = t.list;
    panel.appendChild(h);
    const notes = items.filter(function (it) { return it.kind === "note"; });
    if (!notes.length) {
      const p = document.createElement("p");
      p.className = "notes-empty";
      p.textContent = t.empty;
      panel.appendChild(p);
      return;
    }
    notes.forEach(function (it) {
      const card = document.createElement("div");
      card.className = "note-card";
      const q = document.createElement("p");
      q.className = "note-quote";
      q.textContent = "«" + it.quote + "»";
      const body = document.createElement("p");
      body.textContent = it.text;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = t.remove;
      rm.addEventListener("click", function () { removeItem(it.id); });
      card.appendChild(q);
      card.appendChild(body);
      card.appendChild(rm);
      panel.appendChild(card);
    });
  }

  document.addEventListener("mouseup", function (ev) {
    if (ev.target.closest && ev.target.closest(".note-pop, .notes-panel, .tts-bar, .shelfbar, .topnav, .auth-slot")) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      closePop();
      return;
    }
    const quote = String(sel).replace(/\s+/g, " ").trim();
    if (quote.length < 8) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    popover(rect.left + window.scrollX, rect.bottom + window.scrollY + 6, quote);
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closePop();
  });

  function addToggle() {
    let btn = document.getElementById("notes-toggle");
    if (btn) return;
    const slot = document.getElementById("auth-slot") || document.querySelector(".topnav-inner");
    if (!slot) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "notes-toggle";
    btn.className = "auth-btn";
    btn.textContent = t.list;
    btn.addEventListener("click", function () {
      document.body.classList.toggle("notes-open");
    });
    slot.appendChild(btn);
  }

  function boot() {
    addToggle();
    paint();
    renderList();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
