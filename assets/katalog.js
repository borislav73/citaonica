(function () {
  const shelf = document.getElementById("shelf");
  const note = document.getElementById("catalog-note");

  function card(b) {
    const a = document.createElement("a");
    a.className = "book-card";
    a.href = b.href;
    a.innerHTML =
      '<p class="lang"></p><h2></h2><p class="sub"></p><p class="meta"></p>';
    a.querySelector(".lang").textContent = b.langLabel || b.lang || "";
    a.querySelector("h2").textContent = b.title || b.file;
    a.querySelector(".sub").textContent = b.subtitle || "";
    a.querySelector(".meta").textContent = b.author || "";
    if (!b.subtitle) a.querySelector(".sub").hidden = true;
    if (!b.author) a.querySelector(".meta").hidden = true;
    return a;
  }

  function empty(msg) {
    shelf.innerHTML = "";
    const p = document.createElement("p");
    p.className = "catalog-empty";
    p.textContent = msg;
    shelf.appendChild(p);
  }

  function render(list) {
    shelf.innerHTML = "";
    if (!list.length) {
      empty("Mapa knjige/ je prazna. Ubaci HTML knjige i osvježi stranicu.");
      return;
    }
    list.forEach(function (b) { shelf.appendChild(card(b)); });
  }

  fetch("api/knjige", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("nema popisa");
      return r.json();
    })
    .then(render)
    .catch(function () {
      empty("Katalog se puni sam samo kad čitaonicu pokreneš s poslužiteljem: python pokreni.py — zatim otvori http://127.0.0.1:8765/");
      if (note) {
        note.textContent =
          "Preglednik ne smije sam pročitati mapu s diska. Pokreni pokreni.py u ovoj mapi, pa osvježi ovu adresu.";
      }
    });
})();
