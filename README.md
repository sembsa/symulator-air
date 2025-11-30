# Symulator Przepływu Powietrza 2D

Interaktywny symulator przepływu powietrza w 2D, który wizualizuje jak strumień powietrza opływa różne kształty i przeszkody.

## Funkcje

- **Wizualizacja przepływu powietrza** - System cząsteczek pokazujący ruch powietrza
- **Pole wektorowe** - Opcjonalna wizualizacja kierunków i prędkości przepływu
- **Interaktywne kształty** - Dodawaj i przeciągaj koła, prostokąty i trójkąty
- **Regulowalne parametry**:
  - Prędkość wiatru (0-20)
  - Turbulencja (0-2)
- **Fizyka kolizji** - Realistyczne odbicia cząsteczek od przeszkód
- **Efekty wizualne** - Kolorowe cząsteczki reagujące na prędkość przepływu

## Jak używać

1. **Otwórz plik `index.html` w przeglądarce**

2. **Dodawaj kształty**:
   - Kliknij przyciski "Koło", "Prostokąt" lub "Trójkąt"
   - Kształty pojawiają się na środku ekranu

3. **Przesuń kształty**:
   - Kliknij i przeciągnij kształt w dowolne miejsce
   - Obserwuj jak powietrze zmienia swój przepływ

4. **Dostosuj parametry**:
   - Użyj suwaków aby zmienić prędkość wiatru i turbulencję
   - Włącz/wyłącz wizualizację wektorów przepływu

5. **Sterowanie**:
   - **Pauza** - zatrzymaj/wznów symulację
   - **Reset** - usuń wszystkie cząsteczki i kształty
   - **Wyczyść wszystko** - usuń tylko kształty

## Technologia

- **HTML5 Canvas** - renderowanie grafiki
- **Vanilla JavaScript** - logika symulacji
- **CSS3** - interfejs użytkownika

## Jak to działa

Symulator używa systemu cząsteczek (particle system) do wizualizacji przepływu powietrza:

1. **Pole wektorowe** - siatka wektorów określająca kierunek i prędkość przepływu w każdym punkcie
2. **Cząsteczki** - 3000 cząsteczek podążających za polem wektorowym
3. **Wpływ kształtów** - każdy kształt modyfikuje pole wektorowe wokół siebie
4. **Kolizje** - cząsteczki odbijają się od kształtów zgodnie z fizyką

## Uruchomienie

Po prostu otwórz `index.html` w dowolnej nowoczesnej przeglądarce (Chrome, Firefox, Safari, Edge).

Nie wymaga żadnego serwera ani instalacji!

## Autor

Stworzony z pomocą Claude Code
