MAPA SZKOŁY V5 – WSPÓLNY MOTYW CSS

1. Rozpakuj cały ZIP, zachowując strukturę folderów.
2. Otwórz mapa.html w przeglądarce. Nie wymaga serwera.
3. Edytuj style.css. Na początku pliku, w sekcji :root, znajdziesz wspólną paletę 10 kolorów, rozmiary tekstu interfejsu i etykiet SVG oraz ustawienia linii i układu. Zapisz plik i odśwież mapę.

Przykład: `--route` ustawia kolor trasy, `--text-body` rozmiar tekstu formularza, a `--map-text` rozmiar standardowej etykiety sali.

Pliki SVG także odwołują się do style.css poprzez xml-stylesheet. Otwieraj je bezpośrednio lub osadzaj jako inline SVG / object; zewnętrzny CSS zwykle nie jest pobierany przez SVG użyte jako img lub background-image.

mapa.html – struktura strony, osadzone SVG i dane grafu (offline)
style.css – wspólny wygląd
nawigacja.js – wyszukiwarka, Dijkstra i obsługa interfejsu
graf.json – graf połączeń do dalszej edycji; aplikacja korzysta z jego kopii w HTML
pomieszczenia.json – dane pomieszczeń
pomieszczenia/ – pojedyncze SVG

LINKI DO MAPY I KODY QR

Do adresu mapa.html można dodać parametry:
- mapa.html?start=wejscie ustawia wejście główne jako start i zostawia pole celu puste.
- mapa.html?start=wejscie&cel=pietro-2-201 od razu wyznacza trasę do sali 201.
- mapa.html?cel=201 korzysta z domyślnego wejścia głównego.

Parametry przyjmują identyfikator z graf.json albo jednoznaczny numer lub nazwę. Przy powtarzających się numerach i nazwach użyj identyfikatora, np. parter-wc. Do kodu QR wpisz pełny adres opublikowanej mapy z parametrami.

Graf i geometria V4 nie zostały zmienione.

MAPA SZKOŁY — GRAF PRZEJŚĆ V2

Otwórz mapa.html lokalnie, wpisz numer sali, wybierz podpowiedź. Start domyślny: wejście główne. Można zmienić start lub kliknąć salę.

Graf.json: ręcznie zadeklarowane korytarze, drzwi, przejścia między sąsiednimi pomieszczeniami, schody i wagi. Algorytm Dijkstry wybiera najkrótszą trasę w grafie, najpierw bez niepotwierdzonych krawędzi. Każdy odcinek na jednej kondygnacji jest zweryfikowany geometrycznie względem wielokątów SVG: nie przecina wnętrza obcego zamkniętego pomieszczenia. To nie jest automatyczna weryfikacja wszystkich ścian oryginalnego PDF.

Domyślnie przejścia niepotwierdzone są wyłączone. Szczególnie łącznik między budynkiem głównym a pracowniami, przejście do wolnostojącej sali 051 oraz wejścia niewidoczne na rysunku wymagają sprawdzenia na miejscu. Po zaznaczeniu opcji można obejrzeć wariant orientacyjny, zaznaczony pomarańczowo. Nie należy traktować go jako rzeczywistej drogi bez weryfikacji. Zaznacz Pokaż graf przejść i drzwi, aby obejrzeć krawędzie i węzły.

Odległości: jednostki SVG, schody mają szacunkowe wagi 45/38. Przeliczenie na metry wymaga rzeczywistej skali. Nie jest to mapa ewakuacyjna.

API: schoolNavigation.route('parter-24','pietro-2-209') zwraca trasę bez niepotwierdzonych połączeń. Trzeci argument true dopuszcza wariant orientacyjny w razie braku zwykłej trasy.

Generator-grafu.py: ręczne deklaracje topologii i test geometryczny (Python + shapely). Regeneruje graf.json; po zmianie osadź zaktualizowany JSON w elemencie #graph-data w mapa.html.
Testy: 19044 uporządkowane pary (138 punktów wraz z wejściem) osiągalne w wariancie orientacyjnym; 5776 par w głównej składowej bez niepotwierdzonych przejść. Test w Chromium: autocomplete, rysowanie trasy, przełączanie pięter i przejścia niepotwierdzone.

V3 – KLATKI SCHODOWE
A: zachodnia (przy salach 24, 101, 201), B: centralna (przy WC). Obie klatki mają osobne, dwukierunkowe połączenia Niski parter ↔ Parter ↔ I piętro ↔ II piętro. Nie ma bezpośredniego skoku z parteru na II piętro. Kliknij aktywną klatkę na mapie lub przycisk Dalej, aby przejść do kolejnego etapu; na piętrze pośrednim wyświetla się polecenie kontynuacji na tej samej klatce. W graf.json: stairwells, floorOrder i stairId na krawędziach schodów. Zgodność klatek wywnioskowana z planu, długości nadal szacunkowe.

V4 – WYSZUKIWANIE NUMEREM LUB NAZWĄ
Każdy punkt w graf.json ma niezależne pola id (unikalne, techniczne), number (numer jako tekst lub null), name (sama nazwa lub null), displayName (etykieta). Zera w numerach pozostają widoczne. Numer i nazwa nie są kluczami grafu, ponieważ mogą się powtarzać. W pomieszczenia.json zachowano dotychczasowe name i dodano number, roomName, displayName. SVG mają data-number i data-room-name. W obu polach wyszukiwania działają fragmenty nazw, numery, polskie znaki i ich odpowiedniki. Wpisanie powtarzającej się nazwy wymaga wyboru konkretnej sali. API: schoolNavigation.search('matematyka') zwraca wszystkie pasujące rekordy; exactMatches('203') zwraca tablicę dokładnych dopasowań. route() nadal przyjmuje techniczne ID. Graf węzłów, krawędzi i schodów pozostaje taki sam jak w V3.
