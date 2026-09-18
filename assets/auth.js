(function () {
  const cfg = window.CITAONICA || {};
  const publicKey = cfg.supabaseAnonKey || cfg.supabasePublishableKey || "";
  const ready = !!(cfg.supabaseUrl && publicKey && window.supabase);
  const sr = (document.documentElement.lang || "").indexOf("sr") === 0;
  const t = {
    login: sr ? "Пријава преко Googleа" : "Prijava preko Googlea",
    logout: sr ? "Одјава" : "Odjava",
    guest: sr ? "Гост" : "Gost",
    local: sr ? "Bilješke se čuvaju na ovom uređaju." : "Bilješke se čuvaju na ovom uređaju.",
    needCfg: sr
      ? "Google prijava još nije podešena (Supabase)."
      : "Google prijava još nije podešena (Supabase).",
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
    let el = document.getElementById("auth-slot");
    if (el) return el;
    const inner = document.querySelector(".topnav-inner");
    if (!inner) return null;
    el = document.createElement("div");
    el.id = "auth-slot";
    el.className = "auth-slot";
    inner.appendChild(el);
    return el;
  }

  function render() {
    const el = slot();
    if (!el) return;
    el.innerHTML = "";
    if (user) {
      const name = document.createElement("span");
      name.className = "auth-name";
      name.textContent = displayName(user);
      name.title = user.email || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "auth-btn";
      btn.textContent = t.logout;
      btn.addEventListener("click", signOut);
      el.appendChild(name);
      el.appendChild(btn);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "auth-btn";
      btn.textContent = t.login;
      btn.title = ready ? t.login : t.needCfg + " " + t.local;
      btn.addEventListener("click", signIn);
      el.appendChild(btn);
    }
  }

  async function signIn() {
    if (!ready || !client) {
      alert(t.needCfg + "\n" + t.local);
      return;
    }
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    user = null;
    emit();
  }

  window.CitaonicaAuth = {
    ready: ready,
    getUser: function () { return user; },
    onChange: function (fn) { listeners.push(fn); if (user !== undefined) fn(user); },
    client: function () { return client; },
  };

  async function start() {
    render();
    if (!ready) return;
    client = window.supabase.createClient(cfg.supabaseUrl, publicKey);
    window.CitaonicaAuth.client = function () { return client; };
    const { data } = await client.auth.getSession();
    user = data && data.session ? data.session.user : null;
    emit();
    client.auth.onAuthStateChange(function (_evt, session) {
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
