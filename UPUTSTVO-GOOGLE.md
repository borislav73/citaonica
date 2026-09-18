# Google prijava (Supabase)

Sve je već ubačeno u HTML i JS. Ti samo popuni ključeve.

1. Napravi projekt na https://supabase.com
2. Authentication → Providers → Google → uključi
3. U Google Cloud Console napravi OAuth klijenta (Web) i dodaj
   Authorized redirect URI koji ti Supabase pokaže
   (obično `https://<projekt>.supabase.co/auth/v1/callback`)
4. U `assets/config.js` unesi:

```
window.CITAONICA = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ....",
};
```

Do tada prijava javlja da još nije podešena, a označavanja i bilješke
rade lokalno: označi tekst mišem → „Označi“ ili „Bilješka“.
Panel se otvara gumbom „Bilješke“ u gornjoj traci.
