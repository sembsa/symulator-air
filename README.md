# 🌬️ Tunel Aerodynamiczny 2D

Zaawansowany symulator tunelu aerodynamicznego w 2D z edytorem kształtów, importem SVG i wizualizacją przepływu powietrza w czasie rzeczywistym.

![Tunel Aerodynamiczny](https://img.shields.io/badge/Symulator-Tunel%20Aero-blue)
![HTML5 Canvas](https://img.shields.io/badge/Tech-HTML5%20Canvas-orange)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

## ✨ Funkcje

### 🎯 Symulacja przepływu
- **Ciągły strumień cząsteczek** - stały przepływ z lewej strony ekranu
- **Pole wektorowe** - wizualizacja kierunków i prędkości przepływu
- **Wizualizacja ciśnienia** - mapa kolorów pokazująca rozkład ciśnienia (efekt Bernoulliego)
- **Linie przepływu (streamlines)** - ślady cząsteczek tworzące linie opływu
- **Fizyka kolizji** - realistyczne odbicia cząsteczek od przeszkód

### 📐 Kształty i obiekty
- **Kształty predefiniowane**:
  - Koło
  - Prostokąt
  - Trójkąt
  - Profil lotniczy (NACA 0012)

### ✏️ Edytor własnych kształtów
- Rysowanie wielokątów dowolnego kształtu
- Minimum 3 punkty
- Wizualna podpowiedź podczas rysowania
- Edycja wierzchołków (przeciąganie)
- Przesuwanie całego kształtu

### 📁 Import/Export
- **Import SVG** - wczytuj kształty z plików SVG (path, polygon, polyline)
- **Export SVG** - zapisuj swoje kształty do plików SVG
- Automatyczne skalowanie i centrowanie importowanych kształtów

### 📊 Metryki i analiza
- **FPS** - liczba klatek na sekundę
- **Liczba cząsteczek** - aktualna ilość cząsteczek w symulacji
- **Współczynnik oporu (Cd)** - aproksymacja oporu aerodynamicznego
- **Siła nośna (Cl)** - aproksymacja siły nośnej

### ⚙️ Parametry dostosowywalne
- Prędkość przepływu (1-30 m/s)
- Gęstość cząsteczek (10-100)
- Włącz/wyłącz pole wektorowe
- Włącz/wyłącz wizualizację ciśnienia
- Włącz/wyłącz siatkę pomocniczą

## 🚀 Jak używać

### 1. Uruchomienie
Otwórz plik `index.html` w dowolnej nowoczesnej przeglądarce (Chrome, Firefox, Safari, Edge).

**Nie wymaga instalacji ani serwera!**

### 2. Dodawanie kształtów

#### Metoda A: Kształty predefiniowane
1. Kliknij przycisk z wybranym kształtem (Koło, Prostokąt, Profil lotniczy, Trójkąt)
2. Kształt pojawi się na środku ekranu
3. Przeciągnij kształt myszką w wybrane miejsce
4. Przeciągnij poszczególne punkty kontrolne aby zdeformować kształt

#### Metoda B: Rysuj własny kształt
1. Kliknij **"Rysuj własny kształt"**
2. Klikaj na canvas aby dodawać punkty (min. 3)
3. Kliknij **"Zakończ kształt"** aby zapisać
4. Lub **"Anuluj"** aby odrzucić

#### Metoda C: Import SVG
1. Kliknij **"Importuj SVG"**
2. Wybierz plik SVG z dysku
3. Kształt zostanie automatycznie przeskalowany i wycentrowany

### 3. Obserwuj przepływ
- Cząsteczki wpływają z lewej strony
- Obserwuj jak powietrze opływa przeszkodę
- Niebieskie obszary = niskie ciśnienie (szybszy przepływ)
- Czerwone obszary = wysokie ciśnienie (wolniejszy przepływ)

### 4. Eksport
Kliknij **"Eksportuj kształt"** aby zapisać aktualny kształt jako plik SVG

## 🔬 Jak to działa

### Algorytm symulacji

1. **Pole wektorowe (Flow Field)**
   - Siatka 25x25px
   - Każda komórka ma wektor prędkości (vx, vy) i ciśnienie
   - Kształty modyfikują pole wokół siebie

2. **Strumienie cząsteczek**
   - Cząsteczki startują z lewej strony w równomiernych strumienia
   - Każda cząsteczka podąża za wektorem przepływu
   - Interpolacja prędkości z siatki (smoothing)

3. **Kolizje**
   - Ray casting do detekcji punktu wewnątrz wielokąta
   - Odbicie od najbliższego punktu na krawędzi
   - Zachowanie pędu

4. **Efekt Bernoulliego**
   - Większa prędkość = niższe ciśnienie
   - Wizualizowane kolorem (niebieski/czerwony)

5. **Współczynniki aerodynamiczne**
   - Całkowanie ciśnienia po powierzchni kształtu
   - Cd (opór) - siła w kierunku przepływu
   - Cl (siła nośna) - siła prostopadła do przepływu

## 🎨 Technologie

- **HTML5 Canvas** - renderowanie grafiki 2D
- **Vanilla JavaScript (ES6+)** - logika symulacji
- **CSS3** - interfejs użytkownika z gradientami
- **DOMParser API** - parsowanie SVG

## 📐 Architektura kodu

```
simulator.js
├── WindTunnel (klasa główna)
│   ├── Inicjalizacja
│   │   ├── resizeCanvas() - responsywność
│   │   ├── initFlowField() - pole wektorowe
│   │   └── initParticleStreams() - strumienie cząsteczek
│   │
│   ├── Fizyka
│   │   ├── updateFlowField() - aktualizacja przepływu
│   │   ├── calculateFlowAroundShape() - wpływ kształtu
│   │   ├── updateParticles() - ruch cząsteczek
│   │   └── calculateForces() - siły aerodynamiczne
│   │
│   ├── Geometria
│   │   ├── isPointInShape() - ray casting
│   │   ├── getClosestPointOnShape() - kolizje
│   │   └── closestPointOnSegment() - geometria
│   │
│   ├── Rendering
│   │   ├── drawGrid() - siatka
│   │   ├── drawFlowField() - wektory
│   │   ├── drawPressureField() - ciśnienie
│   │   ├── drawParticles() - cząsteczki + ślady
│   │   ├── drawShape() - kształt + punkty kontrolne
│   │   └── drawEditor() - tryb rysowania
│   │
│   ├── Kształty
│   │   ├── addCircle() - koło (32 segmenty)
│   │   ├── addRectangle() - prostokąt
│   │   ├── addTriangle() - trójkąt
│   │   └── addAirfoil() - profil NACA 0012
│   │
│   ├── Edytor
│   │   ├── startDrawingMode() - włącz edytor
│   │   ├── addDrawingPoint() - dodaj punkt
│   │   ├── finishDrawing() - zapisz kształt
│   │   └── cancelDrawing() - anuluj
│   │
│   └── SVG
│       ├── importSVG() - import pliku
│       ├── parseSVGPath() - parsuj <path>
│       ├── parseSVGPolygon() - parsuj <polygon>
│       ├── normalizePoints() - skaluj i centruj
│       └── exportShape() - eksport do SVG
```

## 🎓 Zastosowania edukacyjne

- Nauka aerodynamiki i mechaniki płynów
- Wizualizacja efektu Bernoulliego
- Testowanie profili lotniczych
- Eksperymentowanie z kształtami aerodynamicznymi
- Zrozumienie linii przepływu (streamlines)

## 🔧 Możliwe rozszerzenia

- [ ] Różne profile NACA
- [ ] Regulacja kąta natarcia
- [ ] Wizualizacja wirów (vorticity)
- [ ] Symulacja turbulencji
- [ ] Eksport animacji do GIF
- [ ] Więcej opcji wizualizacji (smoke, heat map)
- [ ] Porównanie wielu kształtów jednocześnie

## 📝 Licencja

Open source - używaj dowolnie!

## 👨‍💻 Autor

Stworzony z pomocą **Claude Code** - AI assistant od Anthropic

---

**Miłej zabawy z aerodynamiką! ✈️**
