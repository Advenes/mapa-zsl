Interaktywna mapa Zespołu Szkół Łączności w Poznaniu

Mapa pomaga znaleźć salę i wyznaczyć trasę między pomieszczeniami, również na różnych piętrach. Tryb działania zależy od tego, jakie informacje zawiera link.

1. Wyszukiwanie sali
   Otwórz mapa.html i wpisz numer lub nazwę sali w polu „Wyszukaj”. Po wybraniu wyniku mapa przełączy się na właściwe piętro, przybliży salę i ją podświetli. Aby wyznaczyć trasę, rozwiń górny pasek strzałką, wybierz punkt startowy w polu „Skąd?” i zatwierdź.

2. Link z punktem startowym
   Link przykładowy — mapa.html?start=wejscie
   Mapa ustawi wejście główne jako start. Wybierz cel w polu „Dokąd?”, a mapa od razu wyznaczy trasę.

3. Link z punktem startowym i celem
   Link przykładowy — mapa.html?start=wejscie&cel=pietro-2-201
   Mapa od razu wyznaczy i pokaże trasę od wejścia głównego do sali 201.

Do kodu QR wpisz pełny adres opublikowanej mapy wraz z parametrami. Jeśli numer lub nazwa się powtarza, użyj identyfikatora pomieszczenia, np. pietro-2-201.
Wszystkie ID znajdują się w pliku pomieszczenia.json

Etykiety na mapie
W pliku mapa-config.js ustaw roomLabels na 'numbers', aby pokazywać same numery, lub na 'numbers-and-names', aby pokazywać numery i nazwy. W alwaysShowRoomNames wpisz nazwy, które mają pozostać widoczne w trybie samych numerów, np. WC lub Portiernia. Po zmianie odśwież stronę. W obu trybach nazwy działają w wyszukiwarce i pojawiają się po kliknięciu pomieszczenia.
