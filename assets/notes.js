(function () {
  const sr = (document.documentElement.lang || "").indexOf("sr") === 0;
  const bookTitle = (document.querySelector('meta[name="book-title"]') || {}).content
    || document.title
    || location.pathname;
  const pageName = (location.pathname.split("/").pop() || "index.html");
  const bookId = bookTitle + "::" + pageName;
  const KEY = "citaonica-notes:" + bookId;
  const OLD_KEY = "citaonica-notes:" + bookTitle;
  const COLORS = [
    { id: "rose", hex: "#f8c5d6" },
    { id: "orange", hex: "#ffd9a3" },
    { id: "gold", hex: "#fff3b0" },
    { id: "green", hex: "#c6ebc8" },
    { id: "blue", hex: "#b7e0fb" },
    { id: "violet", hex: "#d4c4ee" }
  ];
  const t = {
    hint: sr ? "Одабери боју, затим означи текст." : "Odaberi boju, zatim označi tekst.",
    hintTouch: sr ? "Одабери боју за означавање текста." : "Odaberi boju za označavanje teksta.",
    note: sr ? "Биљешка" : "Bilješka",
    remove: sr ? "Уклони" : "Ukloni",
    list: sr ? "Означено" : "Označeno",
    markBtn: sr ? "Означи" : "Označi",
    empty: sr ? "Нема ознака на овој књизи." : "Nema oznaka na ovoj knjizi.",
    prompt: sr ? "Биљешка уз овај одломак:" : "Bilješka uz ovaj odlomak:",
    clear: sr ? "Уклони ознаку" : "Ukloni oznaku",
    copy: sr ? "Копирај" : "Kopiraj",
    addNote: sr ? "Биљешка" : "Bilješka",
    highlight: sr ? "Означи" : "Označi"
  };

  let pendingQuote = "";
  let sheetMode = "actions";

  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { items = []; }
  if (!items.length) {
    try { items = JSON.parse(localStorage.getItem(OLD_KEY) || "[]") || []; } catch (e) { items = []; }
  }

  let active = "";
  let modeOn = false;

  function sb() {
    try {
      return window.CitaonicaAuth && window.CitaonicaAuth.client && window.CitaonicaAuth.client();
    } catch (e) { return null; }
  }
  function userId() {
    const u = window.CitaonicaAuth && window.CitaonicaAuth.getUser && window.CitaonicaAuth.getUser();
    return u && u.id;
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(items));
    pushCloud();
  }
  async function pushCloud() {
    const client = sb();
    const uid = userId();
    if (!client || !uid) return;
    const rows = items.map(function (it) {
      return {
        id: it.id,
        user_id: uid,
        book_id: bookId,
        quote: it.quote || "",
        note: it.text || "",
        color: it.color || "gold",
        kind: it.kind || "mark",
        updated_at: new Date(it.at || Date.now()).toISOString()
      };
    });
    try {
      await client.from("highlights").delete().eq("user_id", uid).eq("book_id", bookId);
      if (rows.length) await client.from("highlights").insert(rows);
    } catch (e) {
      console.warn("highlights push", e);
    }
  }
  async function pullCloud() {
    const client = sb();
    const uid = userId();
    if (!client || !uid) return;
    try {
      const res = await client.from("highlights").select("*").eq("book_id", bookId);
      if (res.error) {
        console.warn("highlights pull", res.error);
        return;
      }
      const byId = {};
      items.forEach(function (it) { byId[it.id] = it; });
      (res.data || []).forEach(function (row) {
        const it = {
          id: row.id,
          kind: row.kind || "mark",
          quote: row.quote,
          text: row.note || "",
          color: row.color || "gold",
          at: row.updated_at ? Date.parse(row.updated_at) : Date.now()
        };
        const local = byId[it.id];
        if (!local || it.at >= (local.at || 0)) byId[it.id] = it;
      });
      items = Object.keys(byId).map(function (k) { return byId[k]; });
      localStorage.setItem(KEY, JSON.stringify(items));
      paint();
      renderList();
    } catch (e) {
      console.warn("highlights pull", e);
    }
  }
  function uid() { return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function colorHex(id) {
    const c = COLORS.find(function (x) { return x.id === id; });
    return c ? c.hex : "#fff3b0";
  }

  function tray() {
    let el = document.getElementById("hl-tray");
    if (el) return el;
    el = document.createElement("div");
    el.id = "hl-tray";
    el.className = "hl-tray is-closed";
    el.hidden = true;
    document.body.appendChild(el);
    enableTrayDrag(el);
    return el;
  }

  function syncDockHeight() {
    const bar = document.getElementById("tts-bar");
    const open = document.body.classList.contains("tts-open") && bar && !bar.hidden;
    const h = open ? Math.ceil(bar.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--tts-bar-h", h ? h + "px" : "0px");
  }

  function closeShelf() {
    document.body.classList.remove("shelf-open");
    if (window.CitaonicaShelf && window.CitaonicaShelf.close) window.CitaonicaShelf.close();
  }

  function wordCount(s) {
    return String(s || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function placeTrayMobile() {
    const el = tray();
    if (!el || el.dataset.dragged === "1") return;
    const nav = document.querySelector(".topnav");
    const top = nav ? Math.ceil(nav.getBoundingClientRect().bottom) + 8 : 56;
    el.style.top = top + "px";
    el.style.bottom = "auto";
    el.style.left = "50%";
    el.style.right = "auto";
    el.style.transform = "translateX(-50%)";
  }

  function enableTrayDrag(el) {
    if (el.dataset.dragReady === "1") return;
    el.dataset.dragReady = "1";
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest("button")) return;
      dragging = true;
      el.dataset.dragged = "1";
      const r = el.getBoundingClientRect();
      sx = ev.clientX;
      sy = ev.clientY;
      ox = r.left;
      oy = r.top;
      try { el.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    el.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      ev.preventDefault();
      el.style.left = (ox + ev.clientX - sx) + "px";
      el.style.top = (oy + ev.clientY - sy) + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transform = "none";
    });
    function stop() { dragging = false; }
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
  }

  function setTrayOpen(on) {
    modeOn = on;
    const el = tray();
    el.hidden = !on;
    el.classList.toggle("is-closed", !on);
    if (!on) active = "";
    else if (!active) active = "gold";
    renderTray();
    document.body.classList.toggle("hl-dock-open", on);
    if (on && isTouch()) placeTrayMobile();
    syncDockHeight();
  }

  function renderTray() {
    const el = tray();
    el.innerHTML = "";
    const top = document.createElement("div");
    top.className = "hl-tray-top";
    const hint = document.createElement("span");
    hint.className = "hl-hint";
    hint.textContent = isTouch() ? t.hintTouch : t.hint;
    top.appendChild(hint);
    const x = document.createElement("button");
    x.type = "button";
    x.className = "hl-x";
    x.setAttribute("aria-label", "Zatvori");
    x.textContent = "×";
    x.addEventListener("mousedown", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    x.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      setTrayOpen(false);
    });
    top.appendChild(x);
    el.appendChild(top);
    const dots = document.createElement("div");
    dots.className = "hl-tray-dots";
    COLORS.forEach(function (c) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hl-dot" + (active === c.id ? " is-on" : "");
      b.style.background = c.hex;
      b.title = c.id;
      b.addEventListener("mousedown", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        active = c.id;
        renderTray();
        if (currentQuote() || pendingQuote) applyCurrentSelection();
      });
      dots.appendChild(b);
    });
    const eraser = document.createElement("button");
    eraser.type = "button";
    eraser.className = "hl-dot hl-erase" + (active === "erase" ? " is-on" : "");
    eraser.title = t.clear;
    eraser.addEventListener("mousedown", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    eraser.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      active = "erase";
      renderTray();
      if (currentQuote() || pendingQuote) applyCurrentSelection();
    });
    dots.appendChild(eraser);
    el.appendChild(dots);
    const foot = document.createElement("div");
    foot.className = "hl-tray-foot";
    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "hl-list-btn";
    listBtn.textContent = t.list;
    listBtn.addEventListener("mousedown", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    listBtn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isTouch()) closeShelf();
      document.body.classList.add("notes-open");
      renderList();
    });
    foot.appendChild(listBtn);
    el.appendChild(foot);
  }

  function currentQuote() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    return String(sel).replace(/\s+/g, " ").trim();
  }

  function applyColor(colorId, quote) {
    const found = items.find(function (it) { return it.quote === quote; });
    if (found) found.color = colorId;
    else {
      items.push({
        id: uid(),
        kind: "mark",
        quote: quote.slice(0, 500),
        text: "",
        color: colorId,
        at: Date.now()
      });
    }
    persist();
    paint();
    renderList();
  }

  function eraseQuote(quote) {
    items = items.filter(function (it) {
      return quote.indexOf(it.quote) === -1 && it.quote.indexOf(quote) === -1;
    });
    persist();
    paint();
    renderList();
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
      if (!it.quote || it.quote.length < 4) return;
      highlightFirst(root, it);
    });
  }

  function highlightFirst(root, it) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest("script, style, .tts-bar, .shelfbar, .topnav, .hl-tray, .notes-panel, mark.user-hl")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(it.quote);
      if (idx === -1) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, Math.min(node.nodeValue.length, idx + it.quote.length));
      const mark = document.createElement("mark");
      mark.className = "user-hl";
      mark.dataset.color = it.color || "gold";
      mark.dataset.id = it.id;
      mark.style.background = colorHex(it.color);
      mark.title = it.text || "";
      try { range.surroundContents(mark); } catch (e) {}
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
    const head = document.createElement("div");
    head.className = "notes-panel-head";
    const h = document.createElement("p");
    h.className = "notes-panel-title";
    h.textContent = t.list;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "notes-panel-x";
    close.setAttribute("aria-label", "Zatvori");
    close.textContent = "×";
    close.addEventListener("click", function () {
      document.body.classList.remove("notes-open");
    });
    head.appendChild(h);
    head.appendChild(close);
    panel.appendChild(head);
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "notes-empty";
      p.textContent = t.empty;
      panel.appendChild(p);
      return;
    }
    items.slice().reverse().forEach(function (it) {
      const card = document.createElement("div");
      card.className = "note-card";
      const sw = document.createElement("span");
      sw.className = "note-swatch";
      sw.style.background = colorHex(it.color);
      const q = document.createElement("p");
      q.className = "note-quote";
      q.textContent = it.quote;
      q.addEventListener("click", function () {
        const m = document.querySelector('mark.user-hl[data-id="' + it.id + '"]');
        if (m) m.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      card.appendChild(sw);
      card.appendChild(q);
      if (it.text) {
        const body = document.createElement("p");
        body.className = "note-body";
        body.textContent = it.text;
        card.appendChild(body);
      }
      const row = document.createElement("div");
      row.className = "note-actions";
      const nb = document.createElement("button");
      nb.type = "button";
      nb.textContent = t.note;
      nb.addEventListener("click", function () {
        const text = window.prompt(t.prompt, it.text || "");
        if (text === null) return;
        it.text = text;
        it.kind = text ? "note" : "mark";
        persist();
        paint();
        renderList();
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = t.remove;
      rm.addEventListener("click", function () { removeItem(it.id); });
      row.appendChild(nb);
      row.appendChild(rm);
      card.appendChild(row);
      panel.appendChild(card);
    });
  }

  function isTouch() {
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }

  function inChrome(el) {
    return !!(el && el.closest && el.closest(".hl-tray, .notes-panel, .tts-bar, .shelfbar, .topnav, .auth-slot, .account-slot, .auth-modal"));
  }

  function applyCurrentSelection() {
    if (!loggedIn() || !modeOn || !active) return false;
    const quote = currentQuote() || pendingQuote;
    if (!quote || wordCount(quote) < 2) return false;
    if (active === "erase") eraseQuote(quote);
    else applyColor(active, quote);
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    pendingQuote = "";
    hideSheet();
    return true;
  }

  function sheet() {
    let el = document.getElementById("hl-sheet");
    if (el) return el;
    el = document.createElement("div");
    el.id = "hl-sheet";
    el.className = "hl-sheet";
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function hideSheet() {
    const el = document.getElementById("hl-sheet");
    if (el) {
      el.hidden = true;
      el.classList.add("is-closed");
    }
    document.body.classList.remove("hl-sheet-open");
    sheetMode = "actions";
  }

  function needLogin() {
    if (loggedIn()) return false;
    if (window.CitaonicaAuth && window.CitaonicaAuth.openSignIn) window.CitaonicaAuth.openSignIn();
    return true;
  }

  function showSheet(quote) {
    if (!quote || quote.length < 2) return;
    pendingQuote = quote;
    sheetMode = "actions";
    closeShelf();
    renderSheet();
    const el = sheet();
    el.hidden = false;
    el.classList.remove("is-closed");
    document.body.classList.add("hl-sheet-open");
  }

  function renderSheet() {
    const el = sheet();
    el.innerHTML = "";
    const x = document.createElement("button");
    x.type = "button";
    x.className = "hl-sheet-x";
    x.textContent = "×";
    x.addEventListener("click", function (ev) {
      ev.preventDefault();
      hideSheet();
    });
    el.appendChild(x);
    if (sheetMode === "colors") {
      const row = document.createElement("div");
      row.className = "hl-sheet-colors";
      COLORS.forEach(function (c) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hl-sheet-swatch";
        b.style.background = c.hex;
        b.addEventListener("click", function (ev) {
          ev.preventDefault();
          if (needLogin()) return;
          applyColor(c.id, pendingQuote);
          const sel = window.getSelection();
          if (sel) sel.removeAllRanges();
          pendingQuote = "";
          hideSheet();
        });
        row.appendChild(b);
      });
      el.appendChild(row);
      return;
    }
    const row = document.createElement("div");
    row.className = "hl-sheet-actions";
    function action(label, fn) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hl-sheet-btn";
      b.textContent = label;
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        fn();
      });
      row.appendChild(b);
    }
    action(t.copy, function () {
      const q = pendingQuote || currentQuote();
      if (q && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(q).catch(function () {});
      }
      hideSheet();
    });
    action(t.addNote, function () {
      if (needLogin()) return;
      const q = pendingQuote || currentQuote();
      if (!q) return;
      const text = window.prompt(t.prompt, "");
      if (text === null) return;
      applyColor("gold", q);
      const last = items[items.length - 1];
      if (last && last.quote === q.slice(0, 500)) {
        last.text = text || "";
        last.kind = text ? "note" : "mark";
        persist();
        paint();
        renderList();
      }
      hideSheet();
    });
    action(t.highlight, function () {
      if (needLogin()) return;
      sheetMode = "colors";
      renderSheet();
    });
    el.appendChild(row);
  }

  function textNodeAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || inChrome(el) || !el.closest("main")) return null;
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode) {
        node = pos.offsetNode;
        offset = pos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) {
        node = r.startContainer;
        offset = r.startOffset;
      }
    }
    if (!node) return null;
    if (node.nodeType !== 3) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      node = walker.nextNode();
      offset = 0;
    }
    if (!node || node.nodeType !== 3) return null;
    return { node: node, offset: offset };
  }

  function selectWordAt(x, y) {
    const hit = textNodeAt(x, y);
    if (!hit) return "";
    const text = hit.node.nodeValue || "";
    let a = hit.offset;
    let b = hit.offset;
    const ok = /[0-9A-Za-zÀ-žА-яЁёЂђЈјЉљЊњЋћЏџІіЇїЄєҐґ'’-]/;
    while (a > 0 && ok.test(text.charAt(a - 1))) a--;
    while (b < text.length && ok.test(text.charAt(b))) b++;
    if (b - a < 2) {
      a = Math.max(0, hit.offset - 12);
      b = Math.min(text.length, hit.offset + 24);
    }
    if (b - a < 2) return "";
    try {
      const range = document.createRange();
      range.setStart(hit.node, a);
      range.setEnd(hit.node, b);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
    return text.slice(a, b).replace(/\s+/g, " ").trim();
  }

  function considerSelection() {
    if (inChrome(document.activeElement)) return;
    const q = currentQuote();
    if (wordCount(q) >= 2) {
      pendingQuote = q;
      if (isTouch()) {
        if (loggedIn()) setTrayOpen(true);
        hideSheet();
        return;
      }
    } else if (!pendingQuote) hideSheet();
  }

  document.addEventListener("contextmenu", function (ev) {
    if (!isTouch()) return;
    if (ev.target && ev.target.closest && ev.target.closest("main")) ev.preventDefault();
  });

  document.addEventListener("mouseup", function (ev) {
    if (inChrome(ev.target)) return;
    if (isTouch()) {
      setTimeout(considerSelection, 30);
      return;
    }
    applyCurrentSelection();
  });

  document.addEventListener("touchend", function (ev) {
    if (inChrome(ev.target)) return;
    setTimeout(considerSelection, 80);
  }, { passive: true });

  document.addEventListener("selectionchange", function () {
    if (!isTouch()) return;
    const q = currentQuote();
    if (q && q.length >= 2) pendingQuote = q;
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") setTrayOpen(false);
  });

  document.addEventListener("click", function (ev) {
    const mark = ev.target.closest && ev.target.closest("mark.user-hl");
    if (!mark) return;
    if (!loggedIn()) {
      if (window.CitaonicaAuth && window.CitaonicaAuth.openSignIn) window.CitaonicaAuth.openSignIn();
      return;
    }
    if (modeOn && active === "erase") {
      const it = items.find(function (x) { return x.id === mark.dataset.id; });
      if (it) removeItem(it.id);
      return;
    }
    const it = items.find(function (x) { return x.id === mark.dataset.id; });
    if (!it) return;
    const text = window.prompt(t.prompt, it.text || "");
    if (text === null) return;
    it.text = text;
    it.kind = text ? "note" : "mark";
    persist();
    paint();
    renderList();
  });

  function loggedIn() {
    return !!(window.CitaonicaAuth && window.CitaonicaAuth.getUser && window.CitaonicaAuth.getUser());
  }

  function addToggle() {
    document.querySelectorAll("#notes-toggle").forEach(function (n) {
      if (n.closest && n.closest(".topnav")) n.remove();
    });
    const tools = document.getElementById("markup-tools");
    if (!tools) return;
    tools.innerHTML = "";
    const markBtn = document.createElement("button");
    markBtn.type = "button";
    markBtn.id = "notes-toggle";
    markBtn.className = "markup-link";
    markBtn.textContent = t.markBtn;
    markBtn.addEventListener("click", function () {
      if (!loggedIn()) {
        if (window.CitaonicaAuth && window.CitaonicaAuth.openSignIn) window.CitaonicaAuth.openSignIn();
        return;
      }
      if (isTouch()) closeShelf();
      if (isTouch()) {
        setTrayOpen(false);
        return;
      }
      setTrayOpen(!modeOn);
    });
    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "markup-link";
    listBtn.textContent = t.list;
    listBtn.addEventListener("click", function () {
      if (!loggedIn()) {
        if (window.CitaonicaAuth && window.CitaonicaAuth.openSignIn) window.CitaonicaAuth.openSignIn();
        return;
      }
      if (isTouch()) closeShelf();
      document.body.classList.add("notes-open");
      renderList();
    });
    tools.appendChild(markBtn);
    tools.appendChild(listBtn);
  }

  window.CitaonicaNotes = {
    syncAuth: function () {
      addToggle();
      if (!loggedIn()) {
        setTrayOpen(false);
        document.body.classList.remove("notes-open");
      } else {
        pullCloud();
      }
    }
  };

  function boot() {
    renderTray();
    setTrayOpen(false);
    addToggle();
    if (window.CitaonicaAuth && window.CitaonicaAuth.onChange) {
      window.CitaonicaAuth.onChange(function () { addToggle(); });
    }
    paint();
    renderList();
    syncDockHeight();
    window.addEventListener("resize", syncDockHeight);
    const bar = document.getElementById("tts-bar");
    if (bar && typeof MutationObserver !== "undefined") {
      new MutationObserver(syncDockHeight).observe(bar, { attributes: true, attributeFilter: ["hidden", "class"] });
    }
    document.body.addEventListener("click", function () {
      setTimeout(syncDockHeight, 50);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
