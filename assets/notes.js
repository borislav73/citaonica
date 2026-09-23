(function () {
  const sr = (document.documentElement.lang || "").indexOf("sr") === 0;
  const bookId = (document.querySelector('meta[name="book-title"]') || {}).content
    || document.title
    || location.pathname;
  const KEY = "citaonica-notes:" + bookId;
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
    hintTouch: sr ? "Одабери боју, затим дуго притисни текст." : "Odaberi boju, zatim dugo pritisni tekst.",
    note: sr ? "Биљешка" : "Bilješka",
    remove: sr ? "Уклони" : "Ukloni",
    list: sr ? "Означено" : "Označeno",
    markBtn: sr ? "Означи" : "Označi",
    empty: sr ? "Нема ознака на овој књизи." : "Nema oznaka na ovoj knjizi.",
    prompt: sr ? "Биљешка уз овај одломак:" : "Bilješka uz ovaj odlomak:",
    clear: sr ? "Уклони ознаку" : "Ukloni oznaku"
  };

  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { items = []; }

  let active = "";
  let modeOn = false;

  function persist() { localStorage.setItem(KEY, JSON.stringify(items)); }
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
    return el;
  }

  function syncDockHeight() {
    const bar = document.getElementById("tts-bar");
    const open = document.body.classList.contains("tts-open") && bar && !bar.hidden;
    const h = open ? Math.ceil(bar.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--tts-bar-h", h ? h + "px" : "0px");
  }

  function setTrayOpen(on) {
    modeOn = on;
    const el = tray();
    el.hidden = !on;
    el.classList.toggle("is-closed", !on);
    if (!on) active = "";
    renderTray();
    document.body.classList.toggle("hl-dock-open", on);
    syncDockHeight();
  }

  function renderTray() {
    const el = tray();
    el.innerHTML = "";
    const hint = document.createElement("span");
    hint.className = "hl-hint";
    hint.textContent = isTouch() ? t.hintTouch : t.hint;
    el.appendChild(hint);
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
      });
      el.appendChild(b);
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
    });
    el.appendChild(eraser);
    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "hl-list-btn";
    listBtn.textContent = t.list;
    listBtn.addEventListener("mousedown", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    listBtn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      document.body.classList.toggle("notes-open");
      renderList();
    });
    el.appendChild(listBtn);
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
    el.appendChild(x);
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
    const quote = currentQuote();
    if (!quote || quote.length < 2) return false;
    if (active === "erase") eraseQuote(quote);
    else applyColor(active, quote);
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    return true;
  }

  function rangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos || !pos.offsetNode) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
    return null;
  }

  function selectWordAt(x, y) {
    const r = rangeFromPoint(x, y);
    if (!r || r.startContainer.nodeType !== 3) return "";
    const text = r.startContainer.nodeValue || "";
    let a = r.startOffset;
    let b = r.startOffset;
    while (a > 0 && /[^\s.,;:!?()«»""\[\]]/.test(text.charAt(a - 1))) a--;
    while (b < text.length && /[^\s.,;:!?()«»""\[\]]/.test(text.charAt(b))) b++;
    if (b - a < 2) return "";
    const range = document.createRange();
    range.setStart(r.startContainer, a);
    range.setEnd(r.startContainer, b);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return text.slice(a, b).replace(/\s+/g, " ").trim();
  }

  document.addEventListener("mouseup", function (ev) {
    if (inChrome(ev.target)) return;
    applyCurrentSelection();
  });

  document.addEventListener("touchend", function (ev) {
    if (inChrome(ev.target)) return;
    setTimeout(applyCurrentSelection, 40);
  }, { passive: true });

  let holdTimer = null;
  let holdX = 0;
  let holdY = 0;

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  document.addEventListener("touchstart", function (ev) {
    clearHold();
    if (!loggedIn()) return;
    if (inChrome(ev.target)) return;
    const tch = ev.touches && ev.touches[0];
    if (!tch) return;
    holdX = tch.clientX;
    holdY = tch.clientY;
    holdTimer = setTimeout(function () {
      holdTimer = null;
      if (!loggedIn()) return;
      if (!modeOn) setTrayOpen(true);
      if (!active) return;
      const quote = currentQuote() || selectWordAt(holdX, holdY);
      if (!quote || quote.length < 2) return;
      if (active === "erase") eraseQuote(quote);
      else applyColor(active, quote);
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }, 480);
  }, { passive: true });

  document.addEventListener("touchmove", function (ev) {
    if (!holdTimer) return;
    const tch = ev.touches && ev.touches[0];
    if (!tch) return;
    if (Math.abs(tch.clientX - holdX) > 12 || Math.abs(tch.clientY - holdY) > 12) clearHold();
  }, { passive: true });

  document.addEventListener("touchcancel", clearHold, { passive: true });
  document.addEventListener("touchend", clearHold, { passive: true });

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
      document.body.classList.toggle("notes-open");
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
