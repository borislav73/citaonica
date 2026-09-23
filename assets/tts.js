(function () {
  const synth = window.speechSynthesis;
  const toggle = document.getElementById("tts-toggle-nav") || document.getElementById("tts-toggle-fab");
  const toggles = [document.getElementById("tts-toggle-nav"), document.getElementById("tts-toggle-fab")].filter(Boolean);
  const bar = document.getElementById("tts-bar");
  const playBtn = document.getElementById("tts-play");
  const pauseBtn = document.getElementById("tts-pause");
  const stopBtn = document.getElementById("tts-stop");
  const fromSel = document.getElementById("tts-from");
  const rateSel = document.getElementById("tts-rate");
  const voiceSel = document.getElementById("tts-voice");
  const statusEl = document.getElementById("tts-status");

  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    toggles.forEach(function (btn) { btn.hidden = true; });
    bar.hidden = false;
    bar.classList.add("is-open");
    document.body.classList.add("tts-open");
    bar.removeAttribute("hidden");
    const noTts = (document.documentElement.lang || "").indexOf("sr") === 0
      ? "Ваш прегледач не подржава уграђено читање наглас (Web Speech API)."
      : "Vaš preglednik ne podržava ugrađeno čitanje naglas (Web Speech API).";
    bar.innerHTML = '<div class="tts-bar-inner"><span class="tts-unsupported">' + noTts + '</span></div>';
    return;
  }

  function loadSections() {
    const pack = document.getElementById("tts-sections");
    if (pack) {
      try {
        const parsed = JSON.parse(pack.textContent);
        if (parsed && parsed.length) return parsed;
      } catch (e) {}
    }
    const fromNav = [];
    document.querySelectorAll(".topnav nav a[href^='#']").forEach(function (a) {
      const id = (a.getAttribute("href") || "").replace(/^#/, "");
      if (id) fromNav.push({ id: id, label: a.textContent.trim() });
    });
    if (fromNav.length) return fromNav;
    return [{ id: "top", label: "Naslovnica" }];
  }
  const sections = loadSections();
  sections.forEach(function (s, i) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    if (i === 2) opt.selected = true;
    fromSel.appendChild(opt);
  });

  const BLOCK_SEL = "h1, h2.sub, h2.sec, p, blockquote, .enote";
  let queue = [];
  let index = 0;
  let speaking = false;
  let paused = false;
  let voices = [];
  let wrapped = false;
  let nextSid = 0;

  const topnav = document.querySelector(".topnav");
  function syncNavHeight() {
    if (!topnav) return;
    const h = Math.ceil(topnav.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--nav-h", h + "px");
  }
  syncNavHeight();
  window.addEventListener("resize", syncNavHeight);

  function skipTextNode(node) {
    const p = node.parentElement;
    if (!p) return true;
    return !!p.closest("sup.fnref, a.backref, aside.footnotes, p.fn, [hidden], .attr, .toc, .footer-nav, .tts-bar");
  }

  function sentenceBounds(text) {
    const bounds = [];
    const re = /[.!?…]["»”’']*(?:\s+|$)/g;
    let start = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const end = m.index + m[0].length;
      if (text.slice(start, end).trim()) bounds.push([start, end]);
      start = end;
    }
    if (start < text.length && text.slice(start).trim()) bounds.push([start, text.length]);
    return bounds;
  }

  function wrapBlock(el) {
    if (el.dataset.ttsWrapped) return;
    el.dataset.ttsWrapped = "1";
    if (el.classList.contains("running") || el.closest(".toc") || el.closest(".footer-nav")) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (skipTextNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) return;

    let full = "";
    const pieces = nodes.map(function (n) {
      const rec = { node: n, start: full.length, len: n.nodeValue.length };
      full += n.nodeValue;
      return rec;
    });
    const bounds = sentenceBounds(full);
    if (!bounds.length) return;

    const sidOf = bounds.map(function () { return String(nextSid++); });

    pieces.forEach(function (p) {
      const nodeStart = p.start;
      const nodeEnd = p.start + p.len;
      const cuts = [];
      bounds.forEach(function (b, i) {
        const a = Math.max(b[0], nodeStart);
        const c = Math.min(b[1], nodeEnd);
        if (a < c) cuts.push({ localStart: a - nodeStart, localEnd: c - nodeStart, sid: sidOf[i] });
      });
      for (let i = cuts.length - 1; i >= 0; i--) {
        const cut = cuts[i];
        if (cut.localStart === 0 && cut.localEnd === p.node.nodeValue.length && p.node.parentElement && p.node.parentElement.matches("span.tts-sent")) {
          p.node.parentElement.dataset.sid = cut.sid;
          continue;
        }
        const rest = p.node.splitText(cut.localStart);
        rest.splitText(cut.localEnd - cut.localStart);
        const span = document.createElement("span");
        span.className = "tts-sent";
        span.dataset.sid = cut.sid;
        rest.parentNode.insertBefore(span, rest);
        span.appendChild(rest);
      }
    });
  }

  function ensureWrapped() {
    if (wrapped) return;
    const root = document.querySelector("main.wrap");
    root.querySelectorAll(BLOCK_SEL).forEach(wrapBlock);
    wrapped = true;
  }

  function blockOf(span) {
    return span.closest("p, blockquote, li, h1, h2, h3, .enote, .arg") || span.parentElement;
  }

  function buildQueue(startId) {
    ensureWrapped();
    const start = document.getElementById(startId);
    if (!start) return [];
    const root = document.querySelector("main.wrap");
    const all = Array.prototype.slice.call(root.querySelectorAll(".tts-sent"));
    let begun = false;
    const blocks = [];
    let cur = null;
    all.forEach(function (span) {
      if (!begun) {
        if (start.contains(span) || span === start) begun = true;
        else return;
      }
      const block = blockOf(span);
      if (!cur || cur.block !== block) {
        cur = { block: block, parts: [] };
        blocks.push(cur);
      }
      const last = cur.parts[cur.parts.length - 1];
      if (!last || last.sid !== span.dataset.sid) {
        cur.parts.push({ sid: span.dataset.sid, els: [span] });
      } else {
        last.els.push(span);
      }
    });
    return blocks.map(function (b) {
      let text = "";
      const sents = [];
      b.parts.forEach(function (p) {
        const piece = p.els.map(function (s) { return s.textContent; }).join("").replace(/\s+/g, " ").trim();
        if (!piece) return;
        if (text) text += " ";
        const startAt = text.length;
        text += piece;
        sents.push({ sid: p.sid, els: p.els, start: startAt, end: text.length });
      });
      return { text: text, sents: sents };
    }).filter(function (g) { return g.text; });
  }

  function sliceBlockFrom(block, sid) {
    const cut = block.sents.findIndex(function (s) { return s.sid === sid; });
    if (cut <= 0) return block;
    let text = "";
    const sents = block.sents.slice(cut).map(function (s) {
      const piece = block.text.slice(s.start, s.end);
      if (text) text += " ";
      const startAt = text.length;
      text += piece;
      return { sid: s.sid, els: s.els, start: startAt, end: text.length };
    });
    return { text: text, sents: sents };
  }

  function preferredVoice() {
    const chosen = voiceSel.value;
    if (chosen) {
      const exact = voices.find(function (v) { return v.name === chosen; });
      if (exact) return exact;
    }
    const hr = voices.find(function (v) {
      return /^hr(-|$)/i.test(v.lang) || /croat/i.test(v.name);
    });
    if (hr) return hr;
    const sl = voices.find(function (v) { return /^sl(-|$)/i.test(v.lang); });
    if (sl) return sl;
    const sr = voices.find(function (v) { return /^(sr|bs)(-|$)/i.test(v.lang); });
    if (sr) return sr;
    return voices.find(function (v) { return /^en/i.test(v.lang); }) || voices[0] || null;
  }

  function fillVoices() {
    voices = synth.getVoices() || [];
    const prev = voiceSel.value;
    voiceSel.innerHTML = "";
    if (!voices.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Zadani glas sustava";
      voiceSel.appendChild(opt);
      return;
    }
    const pageLang = (document.documentElement.lang || "hr").toLowerCase();
    const ranked = voices.slice().sort(function (a, b) {
      const score = function (v) {
        const L = (v.lang || "").toLowerCase();
        const N = (v.name || "").toLowerCase();
        if (pageLang.indexOf("sr") === 0) {
          if (/^sr/i.test(L) || /serb/i.test(N)) return 0;
          if (/^(hr|bs)/i.test(L) || /croat/i.test(N)) return 1;
        } else {
          if (/^hr/i.test(L) || /croat/i.test(N)) return 0;
          if (/^(sl|sr|bs)/i.test(L) || /serb/i.test(N)) return 1;
        }
        if (/^en/i.test(L)) return 2;
        return 3;
      };
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
    ranked.forEach(function (v) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name + " (" + v.lang + ")";
      voiceSel.appendChild(opt);
    });
    const prefer = ranked.find(function (v) {
      const L = (v.lang || "");
      const N = (v.name || "");
      if (pageLang.indexOf("sr") === 0) return /^sr/i.test(L) || /serb/i.test(N);
      return /^hr/i.test(L) || /croat/i.test(N);
    });
    if (prev && ranked.some(function (v) { return v.name === prev; })) {
      voiceSel.value = prev;
    } else if (prefer) {
      voiceSel.value = prefer.name;
    }
    updateVoiceHint();
  }

  function pageLangIsSr() {
    return (document.documentElement.lang || "").toLowerCase().indexOf("sr") === 0;
  }

  function hasBookVoice() {
    return voices.some(function (v) {
      const L = (v.lang || "").toLowerCase();
      const N = (v.name || "").toLowerCase();
      if (pageLangIsSr()) return /^sr/.test(L) || /serb/.test(N);
      return /^hr/.test(L) || /croat/.test(N);
    });
  }

  function ensureVoiceHint() {
    if (document.getElementById("tts-voice-hint")) return document.getElementById("tts-voice-hint");
    if (!bar) return null;
    const hint = document.createElement("div");
    hint.id = "tts-voice-hint";
    hint.className = "tts-voice-hint";
    hint.hidden = true;
    const sr = pageLangIsSr();
    hint.innerHTML = sr
      ? '<p>На овом уређају нема српског гласа. Читање ће звучати на другом језику док не преузмете језични пакет.</p>'
        + '<a class="tts-voice-store" href="https://play.google.com/store/apps/details?id=com.google.android.tts" target="_blank" rel="noopener">Отвори Google гласове</a>'
        + '<ol>'
        + '<li>Инсталирајте или ажурирајте <em>Speech Services by Google</em>.</li>'
        + '<li>У тој апликацији отворите језик и преузмите српски глас.</li>'
        + '<li>Вратите се овамо и поново одаберите глас.</li>'
        + '</ol>'
        + '<p class="tts-voice-alt">iPhone: Подешавања → Приступачност → Изговорени садржај → Гласови.</p>'
      : '<p>Na ovom uređaju nema hrvatskog glasa. Čitanje će zvučati na drugom jeziku dok ne preuzmete jezični paket.</p>'
        + '<a class="tts-voice-store" href="https://play.google.com/store/apps/details?id=com.google.android.tts" target="_blank" rel="noopener">Otvori Google glasove</a>'
        + '<ol>'
        + '<li>Instalirajte ili ažurirajte <em>Speech Services by Google</em>.</li>'
        + '<li>U toj aplikaciji otvorite jezik i preuzmite hrvatski glas.</li>'
        + '<li>Vratite se ovamo i ponovo odaberite glas.</li>'
        + '</ol>'
        + '<p class="tts-voice-alt">iPhone: Postavke → Pristupačnost → Izgovoreni sadržaj → Glasovi.</p>';
    bar.appendChild(hint);
    return hint;
  }

  function updateVoiceHint() {
    const hint = ensureVoiceHint();
    if (!hint) return;
    hint.hidden = hasBookVoice();
  }

  fillVoices();
  if (typeof synth.onvoiceschanged !== "undefined") {
    synth.onvoiceschanged = fillVoices;
  }

  function setHighlight(els) {
    document.querySelectorAll(".tts-current").forEach(function (n) {
      n.classList.remove("tts-current");
    });
    if (els && els.length) {
      els.forEach(function (el) { el.classList.add("tts-current"); });
      els[0].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function updateActiveNav() {
    const links = document.querySelectorAll(".topnav nav a[href^='#']");
    if (!links.length) return;
    const mark = (window.scrollY || 0) + (topnav ? topnav.getBoundingClientRect().height : 56) + 8;
    let current = null;
    links.forEach(function (a) {
      const id = a.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= mark) current = a;
    });
    links.forEach(function (a) {
      a.classList.toggle("is-here", a === current);
    });
  }
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("hashchange", updateActiveNav);
  updateActiveNav();

  function stopAll() {
    speaking = false;
    paused = false;
    synth.cancel();
    setHighlight(null);
    playBtn.classList.remove("is-active");
    setStatus("");
  }

  function speakNext() {
    if (!speaking || paused) return;
    if (index >= queue.length) {
      stopAll();
      setStatus("Kraj.");
      return;
    }
    const item = queue[index];
    if (item.sents && item.sents[0]) setHighlight(item.sents[0].els);
    const u = new SpeechSynthesisUtterance(item.text);
    const voice = preferredVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = document.documentElement.lang === "sr" ? "sr-RS" : "hr-HR";
    }
    u.rate = parseFloat(rateSel.value) || 1;
    u.pitch = 1;
    u.onboundary = function (ev) {
      if (!item.sents || !item.sents.length) return;
      if (ev.name && ev.name !== "word" && ev.name !== "sentence") return;
      const pos = typeof ev.charIndex === "number" ? ev.charIndex : 0;
      let hit = item.sents[0];
      for (let i = 0; i < item.sents.length; i++) {
        if (pos >= item.sents[i].start) hit = item.sents[i];
      }
      setHighlight(hit.els);
    };
    u.onend = function () {
      if (!speaking || paused) return;
      index += 1;
      speakNext();
    };
    u.onerror = function (e) {
      if (e.error === "interrupted" || e.error === "canceled") return;
      index += 1;
      speakNext();
    };
    setStatus("");
    synth.speak(u);
  }

  function chapterIdFor(el) {
    const ids = sections.map(function (s) { return s.id; }).reverse();
    for (let i = 0; i < ids.length; i++) {
      const sec = document.getElementById(ids[i]);
      if (sec && sec.contains(el)) return ids[i];
    }
    return fromSel.value;
  }

  function startFrom(id, sid) {
    synth.cancel();
    queue = buildQueue(id);
    index = 0;
    if (sid) {
      const found = queue.findIndex(function (g) {
        return g.sents && g.sents.some(function (s) { return s.sid === sid; });
      });
      if (found >= 0) {
        queue = queue.slice(found);
        queue[0] = sliceBlockFrom(queue[0], sid);
      }
    }
    speaking = true;
    paused = false;
    playBtn.classList.add("is-active");
    if (!queue.length) {
      stopAll();
      setStatus("Nema teksta za čitanje.");
      return;
    }
    speakNext();
  }

  function setBarOpen(open) {
    bar.classList.toggle("is-open", open);
    document.body.classList.toggle("tts-open", open);
    if (open) {
      bar.removeAttribute("hidden");
      ensureWrapped();
      fillVoices();
      updateVoiceHint();
    } else {
      bar.setAttribute("hidden", "");
    }
    toggles.forEach(function (btn) { btn.setAttribute("aria-pressed", open ? "true" : "false"); });
  }
  toggles.forEach(function (btn) {
    btn.addEventListener("click", function () { setBarOpen(true); });
  });
  const closeBtn = document.getElementById("tts-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      if (typeof stopAll === "function") stopAll();
      setBarOpen(false);
    });
  }

  document.querySelector("main.wrap").addEventListener("click", function (e) {
    if (!bar.classList.contains("is-open")) return;
    if (e.target.closest("a, button, select, sup.fnref")) return;
    const sent = e.target.closest(".tts-sent");
    if (!sent) return;
    const chap = chapterIdFor(sent);
    if (fromSel.querySelector('option[value="' + chap + '"]')) fromSel.value = chap;
    startFrom(chap, sent.dataset.sid);
  });

  playBtn.addEventListener("click", function () {
    if (paused && speaking) {
      paused = false;
      playBtn.classList.add("is-active");
      if (synth.paused) synth.resume();
      else speakNext();
      return;
    }
    if (speaking && !paused) return;
    startFrom(fromSel.value);
  });

  pauseBtn.addEventListener("click", function () {
    if (!speaking || paused) return;
    paused = true;
    playBtn.classList.remove("is-active");
    synth.pause();
    if (!synth.paused) {
      synth.cancel();
    }
    setStatus("Pauza.");
  });

  stopBtn.addEventListener("click", stopAll);

  fromSel.addEventListener("change", function () {
    if (speaking) startFrom(fromSel.value);
  });

  rateSel.addEventListener("change", function () {
    if (speaking && !paused) {
      synth.cancel();
      speakNext();
    }
  });

  voiceSel.addEventListener("change", function () {
    if (speaking && !paused) {
      synth.cancel();
      speakNext();
    }
  });

  window.addEventListener("beforeunload", function () {
    synth.cancel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === "KeyK" && (e.altKey || e.metaKey)) {
      e.preventDefault();
      if (!bar.classList.contains("is-open")) setBarOpen(true);
      playBtn.click();
    }
  });
})();
