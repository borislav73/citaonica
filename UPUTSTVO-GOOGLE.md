# Google prijava (Supabase)

Prijava radi, ali Google te vraća na adresu koja stoji u Supabaseu
kao **Site URL**. Ako tamo piše `http://localhost:3000`, a Čitaonica
nije pokrenuta na tom portu, preglednik kaže „can't reach this page“.

## 1. Ispravi URL-ove u Supabaseu

Otvori:
https://supabase.com/dashboard/project/moacpptrhzuvregskjfh/auth/url-configuration

**Site URL** (jedna adresa — tamo te vraća nakon Googlea):

- lokalno, s `python pokreni.py`:
  `http://127.0.0.1:8765`
- ili GitHub Pages, npr.:
  `https://tvoj-nalog.github.io/citaonica`

**Redirect URLs** (sve adrese s kojih se smije vratiti). Ubaci svaku
posebno, pa Save:

```
http://127.0.0.1:8765/**
http://localhost:8765/**
http://127.0.0.1:8765
http://localhost:8765
```

Plus produkcija, npr.:

```
https://tvoj-nalog.github.io/citaonica/**
https://tvoj-nalog.github.io/citaonica/
```

Bez `localhost:3000`, osim ako stvarno slušaš na 3000.

## 2. Pokreni Čitaonicu na tom portu

U mapi `citaonica`:

```
python pokreni.py
```

Otvori **točno**:
http://127.0.0.1:8765/

Ne otvaraj HTML dvostrukim klikom (`file://`). Google OAuth to ne
prihvaća.

## 3. config.js

```
window.CITAONICA = {
  supabaseUrl: "https://moacpptrhzuvregskjfh.supabase.co",
  supabaseAnonKey: "sb_publishable_....cijeli ključ...."
};
```

Secret key (`sb_secret_...`) ne ide ovdje.

## 4. Google Cloud

Authorized redirect URI ostaje samo:
`https://moacpptrhzuvregskjfh.supabase.co/auth/v1/callback`

To nije localhost. Localhost ide u Supabase Redirect URLs, ne u Google.

## Zašto je u adresi bilo `#access_token=...`

Google i Supabase su prijavu završili. Token je ubačen u URL, ali
preglednik je otvorio krivi host (`localhost:3000`) gdje ništa ne radi.
Kad Site URL i Redirect URLs budu 8765 (ili Pages), ista prijava
otvori Čitaonicu i `auth.js` preuzme token.
