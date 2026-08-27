# Waga

Prywatny dziennik wagi ciała. Jedna strona, bez konta, bez serwera —
wpisy siedzą w pamięci przeglądarki na Twoim telefonie.

- **Tydzień** — każde ważenie od poniedziałku do niedzieli na wykresie, średnia tygodnia i różnica względem poprzedniego.
- **Ogólnie** — wykres średnich tygodniowych plus jedno zdanie podsumowania (o ile kg i w którą stronę).
- **Historia** — jeden wiersz na tydzień: zakres dat, liczba ważeń, średnia i różnica względem poprzedniego tygodnia. Dotknięcie wiersza przenosi do tego tygodnia; poszczególne ważenia (i ich kasowanie) są w zakładce **Tydzień**.

Tydzień zawsze liczy się od poniedziałku do niedzieli — pierwszy, niepełny
tydzień jest liczony osobno, a nie „siedem dni od pierwszego ważenia”.

## Wrzucenie na GitHub Pages

1. Załóż repozytorium na <https://github.com/new> (np. `waga`), publiczne, bez README.
2. Wgraj do niego zawartość tego folderu — na stronie repo **Add file → Upload files**,
   przeciągnij `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`,
   `.nojekyll` i cały folder `icons`. Potem **Commit changes**.
3. **Settings → Pages → Source: Deploy from a branch**, gałąź `main`, katalog `/ (root)`, **Save**.
4. Po 1–2 minutach strona żyje pod `https://TWOJ-LOGIN.github.io/waga/`.

Z konsoli, jeśli wolisz:

```
git init
git add .
git commit -m "Waga"
git branch -M main
git remote add origin https://github.com/TWOJ-LOGIN/waga.git
git push -u origin main
```

## Skrót na telefonie

- **Android / Chrome** — otwórz stronę, menu ⋮ → *Dodaj do ekranu głównego*.
- **iPhone / Safari** — otwórz stronę, przycisk *Udostępnij* → *Do ekranu początkowego*.

Ikona i nazwa wezmą się z `manifest.webmanifest`. Aplikacja odpali się bez paska
adresu i działa też bez internetu (service worker trzyma pliki w pamięci).

## Prywatność

Sama strona jest publiczna (darmowe GitHub Pages działa tylko z publicznych repo),
ale **dane nie**. Wpisy zapisują się w `localStorage` przeglądarki na Twoim urządzeniu
i nigdzie nie wychodzą — kto wejdzie na Twój adres, zobaczy pustą aplikację.
Strona ma też `noindex`, więc nie wpadnie do Google.

## Kopia zapasowa

`localStorage` znika, jeśli wyczyścisz dane strony albo zmienisz telefon.
W zakładce **Historia → Pobierz kopię** zapisujesz plik JSON ze wszystkimi wpisami,
a **Wczytaj kopię** wrzuca go z powrotem (możesz dołączyć do istniejących albo zastąpić).
Rób to raz na jakiś czas.

## Aktualizacja

Po podmianie plików w repo podbij numer w `sw.js`:

```js
const CACHE = 'waga-v2';
```

Inaczej telefon może jeszcze chwilę serwować starą wersję z pamięci.
