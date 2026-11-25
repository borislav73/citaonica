(function () {
  const cfg = window.CITAONICA || {};
  const publicKey = cfg.supabaseAnonKey || cfg.supabasePublishableKey || "";
  const ready = !!(cfg.supabaseUrl && publicKey && window.supabase);
  const sr = (document.documentElement.lang || "").indexOf("sr") === 0;
  const t = {
    login: sr ? "Пријава" : "Prijava",
    logout: sr ? "Одјава" : "Odjava",
    guest: sr ? "Гост" : "Gost",
    section: sr ? "Означавање" : "Označavanje",
    modalTitle: sr ? "Пријава за означавање" : "Prijava za označavanje",
    modalBody: sr
      ? "Пријави се да бис означио текст и писао биљешке. Ознаке се вежу за твој рачун."
      : "Prijavi se da bi označio tekst i pisao bilješke. Oznake se vežu uz tvoj račun.",
    google: sr ? "Prijava preko Googlea" : "Prijava preko Googlea",
    consent: sr
      ? "Пријавом пристајеш да се твоје ознаке и биљешке чувају уз твој рачун. Будући да могу откривати твоја вјерска увјерења, видљиве су само теби и не дијелимо их ни с ким."
      : "Prijavom pristaješ da se tvoje oznake i bilješke spremaju uz tvoj račun. Budući da mogu otkrivati tvoja vjerska uvjerenja, vidljive su samo tebi i ne dijelimo ih ni s kim.",
    privacy: sr ? "Политика приватности" : "Politika privatnosti",
    needCfg: sr
      ? "Google prijava još nije podešena (Supabase)."
      : "Google prijava još nije podešena (Supabase)."
  };

  let client = null;
  let user = null;
  const listeners = [];

  function displayName(u) {
    if (!u) return t.guest;
    const m = u.user_metadata || {};
    const raw = (m.given_name || m.full_name || m.name || "").trim();
    if (raw) return raw.split(/\s+/)[0];
    if (u.email) return u.email.split("@")[0];
    return t.guest;
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(user); } catch (e) {}
    });
    render();
  }

  function slot() {
    document.querySelectorAll(".topnav .auth-slot, .topnav #auth-slot, .topnav #account-slot").forEach(function (n) {
      n.remove();
    });
    let el = document.getElementById("account-slot");
    const side = document.querySelector(".shelfbar");
    if (side) {
      if (!el || !side.contains(el)) {
        el = document.createElement("div");
        el.id = "account-slot";
        el.className = "account-slot";
        side.appendChild(el);
      }
      return el;
    }
    return el;
  }

  function ensureModal() {
    let ov = document.getElementById("auth-modal");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "auth-modal";
    ov.className = "auth-modal";
    ov.hidden = true;
    ov.innerHTML =
      '<div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">' +
        '<button type="button" class="auth-modal-x" id="auth-modal-x" aria-label="Zatvori">×</button>' +
        '<h2 id="auth-modal-title"></h2>' +
        '<p class="auth-modal-body"></p>' +
        '<button type="button" class="auth-google" id="auth-google"></button>' +
        '<p class="auth-error" id="auth-error" hidden></p>' +
        '<p class="auth-consent" id="auth-consent"></p>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector("#auth-modal-title").textContent = t.modalTitle;
    ov.querySelector(".auth-modal-body").textContent = t.modalBody;
    ov.querySelector("#auth-google").textContent = t.google;
    // Obavijest uz prijavu (čl. 9 GDPR): klik na prijavu je potvrdna radnja.
    // Kuka za poveznicu: kad stranica s politikom privatnosti postoji, dodaj u config.js
    //   privacyUrl: "/politika-privatnosti.html"  (put od korijena stranice)
    const consent = ov.querySelector("#auth-consent");
    consent.textContent = t.consent;
    if (cfg.privacyUrl) {
      consent.appendChild(document.createTextNode(" "));
      const a = document.createElement("a");
      a.href = cfg.privacyUrl;
      a.textContent = t.privacy;
      consent.appendChild(a);
    }
    ov.addEventListener("click", function (ev) {
      if (ev.target === ov) hideModal();
    });
    ov.querySelector("#auth-modal-x").addEventListener("click", hideModal);
    ov.querySelector("#auth-google").addEventListener("click", signIn);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") hideModal();
    });
    return ov;
  }

  function showModal() {
    ensureModal().hidden = false;
    document.body.classList.add("auth-modal-open");
  }

  function hideModal() {
    const ov = document.getElementById("auth-modal");
    if (ov) ov.hidden = true;
    document.body.classList.remove("auth-modal-open");
  }

  function render() {
    const el = slot();
    if (!el) return;
    el.innerHTML = "";
    const block = document.createElement("div");
    block.className = "markup-block";
    const kicker = document.createElement("p");
    kicker.className = "markup-kicker";
    kicker.textContent = t.section;
    block.appendChild(kicker);

    if (user) {
      const tools = document.createElement("div");
      tools.id = "markup-tools";
      tools.className = "markup-tools";
      block.appendChild(tools);
      const name = document.createElement("p");
      name.className = "auth-name";
      name.textContent = displayName(user);
      name.title = user.email || "";
      const out = document.createElement("button");
      out.type = "button";
      out.className = "markup-link";
      out.textContent = t.logout;
      out.addEventListener("click", signOut);
      block.appendChild(name);
      block.appendChild(out);
    } else {
      const inn = document.createElement("button");
      inn.type = "button";
      inn.className = "markup-link";
      inn.textContent = t.login;
      inn.addEventListener("click", showModal);
      block.appendChild(inn);
    }
    el.appendChild(block);
    hideModal();
    if (window.CitaonicaNotes && window.CitaonicaNotes.syncAuth) {
      window.CitaonicaNotes.syncAuth(user);
    }
  }

  async function signIn() {
    if (!ready || !client) {
      const err = document.getElementById("auth-error");
      if (err) { err.textContent = t.needCfg; err.hidden = false; }
      return;
    }
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href.split("#")[0] }
    });
  }

  // Odjava: lokalne oznake i bilješke brišu se s uređaja (i s prikaza), da ih sljedeći korisnik ne vidi.
  function clearLocalNotes() {
    if (window.CitaonicaNotes && window.CitaonicaNotes.clearLocal) window.CitaonicaNotes.clearLocal();
  }

  async function signOut() {
    try {
      if (client) await client.auth.signOut();
    } finally {
      clearLocalNotes();
      user = null;
      emit();
    }
  }

  window.CitaonicaAuth = {
    ready: ready,
    getUser: function () { return user; },
    onChange: function (fn) { listeners.push(fn); if (user !== undefined) fn(user); },
    client: function () { return client; },
    openSignIn: showModal
  };

  async function start() {
    ensureModal();
    render();
    if (!ready) return;
    client = window.supabase.createClient(cfg.supabaseUrl, publicKey);
    window.CitaonicaAuth.client = function () { return client; };
    const { data } = await client.auth.getSession();
    user = data && data.session ? data.session.user : null;
    emit();
    client.auth.onAuthStateChange(function (evt, session) {
      if (evt === "SIGNED_OUT") clearLocalNotes();   // i odjava iz druge kartice / istek sesije
      user = session ? session.user : null;
      emit();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
