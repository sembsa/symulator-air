// ==========================================
// TUNEL AERODYNAMICZNY 2D - Poprawiona fizyka CFD
// Bazowane na Lattice Boltzmann i NASA streamlines
// ==========================================

class WindTunnel {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Responsive canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Parametry tunelu
        this.windSpeed = 8;
        this.particleDensity = 30;
        this.isPaused = false;

        // Opcje wizualizacji
        this.showVectors = false;
        this.showPressure = true;
        this.showGrid = false;

        // Cząsteczki - stały strumień
        this.particles = [];
        this.particleStreams = [];

        // Kształt testowy
        this.shape = null;
        this.selectedVertex = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        // Edytor kształtów
        this.isDrawingMode = false;
        this.drawingPoints = [];
        this.tempPoint = null;

        // Siatka przepływu - gęsta dla dokładności
        this.gridSize = 15;
        this.flowField = [];

        // Metryki
        this.dragForce = 0;
        this.liftForce = 0;
        this.fps = 60;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateTime = 0;

        this.initFlowField();
        this.initParticleStreams();
        this.setupEventListeners();
        this.animate();
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();
        this.canvas.width = Math.floor(rect.width - 40);
        this.canvas.height = Math.floor(rect.height - 100);

        // Reinicjalizuj pole przepływu po zmianie rozmiaru
        this.initFlowField();
    }

    initFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        this.flowField = [];
        for (let y = 0; y < rows; y++) {
            this.flowField[y] = [];
            for (let x = 0; x < cols; x++) {
                this.flowField[y][x] = {
                    vx: this.windSpeed,
                    vy: 0,
                    pressure: 1.0
                };
            }
        }
    }

    initParticleStreams() {
        // Strumienie cząsteczek wchodzące z lewej strony
        this.particleStreams = [];
        const streamCount = this.particleDensity;
        const spacing = this.canvas.height / streamCount;

        for (let i = 0; i < streamCount; i++) {
            this.particleStreams.push({
                y: spacing * i + spacing / 2,
                particles: []
            });
        }
    }

    updateParticleDensity(density) {
        this.particleDensity = density;
        this.initParticleStreams();
    }

    createParticle(y) {
        return {
            x: -10,
            y: y + (Math.random() - 0.5) * 3,
            vx: this.windSpeed,
            vy: 0,
            trail: [],
            maxTrailLength: 30,
            life: 255,
            age: 0
        };
    }

    updateFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        // Reset do bazowego przepływu
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                this.flowField[y][x] = {
                    vx: this.windSpeed,
                    vy: 0,
                    pressure: 1.0
                };
            }
        }

        // Wpływ kształtu na pole przepływu
        if (this.shape && !this.isDrawingMode) {
            this.calculateFlowAroundShape();
        }

        // Multi-pass smoothing dla płynności
        for (let pass = 0; pass < 2; pass++) {
            this.smoothFlowField();
        }
    }

    calculateFlowAroundShape() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        // Oblicz środek i rozmiar kształtu
        const shapeBounds = this.getShapeBounds();
        const shapeCenterX = (shapeBounds.minX + shapeBounds.maxX) / 2;
        const shapeCenterY = (shapeBounds.minY + shapeBounds.maxY) / 2;
        const shapeRadius = Math.max(
            shapeBounds.maxX - shapeBounds.minX,
            shapeBounds.maxY - shapeBounds.minY
        ) / 2;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * this.gridSize;
                const py = y * this.gridSize;

                // Sprawdź czy punkt jest wewnątrz kształtu
                if (this.isPointInShape(px, py)) {
                    // Wewnątrz kształtu - brak przepływu (solid boundary)
                    this.flowField[y][x].vx = 0;
                    this.flowField[y][x].vy = 0;
                    this.flowField[y][x].pressure = 1.5;
                    continue;
                }

                // Znajdź najbliższy punkt na kształcie
                const closestPoint = this.getClosestPointOnShape(px, py);
                const dx = px - closestPoint.x;
                const dy = py - closestPoint.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // ZNACZNIE MNIEJSZY wpływ - tylko blisko obiektu (3x rozmiar kształtu)
                const influenceRadius = shapeRadius * 3;

                if (dist < influenceRadius && dist > 0.1) {
                    // Normalizuj odległość (0 = przy kształcie, 1 = na krawędzi wpływu)
                    const normalizedDist = dist / influenceRadius;
                    const influence = 1 - normalizedDist;

                    // Wektor od powierzchni kształtu
                    const angle = Math.atan2(dy, dx);

                    // Sprawdź czy punkt jest przed czy za obiektem względem przepływu
                    const relativeX = px - shapeCenterX;
                    const isBehind = relativeX > 0;
                    const isInFront = relativeX < -shapeRadius * 0.5;

                    if (isInFront) {
                        // PRZED OBIEKTEM - słabe rozpraszanie, kompresja przy boach
                        const distFromCenter = Math.abs(py - shapeCenterY);

                        if (distFromCenter < shapeRadius * 1.2) {
                            // Kompresja boczna - flow musi ominąć
                            const sideForce = influence * influence; // quadratic falloff
                            this.flowField[y][x].vy = Math.sin(angle) * sideForce * this.windSpeed * 1.5;
                            this.flowField[y][x].vx = this.windSpeed * (1 - sideForce * 0.2);

                            // Bernoulli: wyższa prędkość = niższe ciśnienie
                            const speed = Math.sqrt(
                                this.flowField[y][x].vx ** 2 +
                                this.flowField[y][x].vy ** 2
                            );
                            this.flowField[y][x].pressure = 1.0 - (speed - this.windSpeed) / this.windSpeed * 0.4;
                        }
                    } else if (isBehind) {
                        // ZA OBIEKTEM - wake recovery, stopniowe zbieganie
                        const wakeStrength = influence * Math.exp(-normalizedDist * 2);
                        const distFromCenterY = py - shapeCenterY;

                        // Strumienie zbiegają się do centrum (pressure recovery)
                        const convergenceForce = -distFromCenterY / (shapeRadius * 3) * wakeStrength;

                        this.flowField[y][x].vx = this.windSpeed * (0.6 + normalizedDist * 0.4); // slower in wake
                        this.flowField[y][x].vy = convergenceForce * this.windSpeed * 2;

                        // Niskie ciśnienie w wake (vacuum effect)
                        this.flowField[y][x].pressure = 0.6 + normalizedDist * 0.3;
                    } else {
                        // PRZY BOKACH - maksymalna prędkość (squeeze effect)
                        const sideStrength = influence * (1 - Math.abs(relativeX) / shapeRadius);

                        this.flowField[y][x].vx = this.windSpeed * (1 + sideStrength * 0.3);
                        this.flowField[y][x].vy = Math.sin(angle) * sideStrength * this.windSpeed * 2;

                        // Najniższe ciśnienie przy bokach
                        const speed = Math.sqrt(
                            this.flowField[y][x].vx ** 2 +
                            this.flowField[y][x].vy ** 2
                        );
                        this.flowField[y][x].pressure = 1.0 - (speed - this.windSpeed) / this.windSpeed * 0.6;
                    }
                }
            }
        }
    }

    // Smoothing pola przepływu - multi-pass dla ciągłości
    smoothFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        const newField = JSON.parse(JSON.stringify(this.flowField));

        for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
                // Pomiń wnętrze kształtu (solid boundary)
                if (this.flowField[y][x].vx === 0 && this.flowField[y][x].vy === 0) {
                    continue;
                }

                // Weighted average z sąsiadami (większa waga dla upstream)
                let sumVx = this.flowField[y][x].vx * 2; // własna waga
                let sumVy = this.flowField[y][x].vy * 2;
                let weight = 2;

                const neighbors = [
                    [x-1, y, 1.2],   // upstream - większa waga
                    [x+1, y, 0.8],   // downstream - mniejsza waga
                    [x, y-1, 1.0],   // vertical
                    [x, y+1, 1.0]
                ];

                for (let [nx, ny, w] of neighbors) {
                    if (this.flowField[ny] && this.flowField[ny][nx]) {
                        const neighbor = this.flowField[ny][nx];
                        // Pomiń solid boundaries
                        if (neighbor.vx !== 0 || neighbor.vy !== 0) {
                            sumVx += neighbor.vx * w;
                            sumVy += neighbor.vy * w;
                            weight += w;
                        }
                    }
                }

                // Słabsze smoothing (30%) aby zachować szczegóły
                const smoothingFactor = 0.3;
                const avgVx = sumVx / weight;
                const avgVy = sumVy / weight;

                newField[y][x].vx = this.flowField[y][x].vx * (1 - smoothingFactor) + avgVx * smoothingFactor;
                newField[y][x].vy = this.flowField[y][x].vy * (1 - smoothingFactor) + avgVy * smoothingFactor;
            }
        }

        this.flowField = newField;
    }

    getShapeBounds() {
        if (!this.shape || this.shape.points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let p of this.shape.points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        return { minX, maxX, minY, maxY };
    }

    getClosestPointOnShape(px, py) {
        if (!this.shape || this.shape.points.length < 2) {
            return { x: px, y: py };
        }

        let closestPoint = { x: this.shape.points[0].x, y: this.shape.points[0].y };
        let minDist = Infinity;

        // Sprawdź wszystkie krawędzie
        for (let i = 0; i < this.shape.points.length; i++) {
            const p1 = this.shape.points[i];
            const p2 = this.shape.points[(i + 1) % this.shape.points.length];

            const point = this.closestPointOnSegment(px, py, p1.x, p1.y, p2.x, p2.y);
            const dist = Math.sqrt((px - point.x) ** 2 + (py - point.y) ** 2);

            if (dist < minDist) {
                minDist = dist;
                closestPoint = point;
            }
        }

        return closestPoint;
    }

    closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) return { x: x1, y: y1 };

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }

    isPointInShape(x, y) {
        if (!this.shape || this.shape.points.length < 3) return false;

        // Ray casting algorithm
        let inside = false;
        const points = this.shape.points;

        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    updateParticles() {
        // Dodaj nowe cząsteczki do strumieni
        for (let stream of this.particleStreams) {
            if (stream.particles.length === 0 ||
                stream.particles[stream.particles.length - 1].x > 20) {
                stream.particles.push(this.createParticle(stream.y));
            }
        }

        // Aktualizuj wszystkie cząsteczki
        for (let stream of this.particleStreams) {
            for (let i = stream.particles.length - 1; i >= 0; i--) {
                const particle = stream.particles[i];
                particle.age++;

                // Pobierz przepływ z siatki (interpolacja biliniowa)
                const gridX = particle.x / this.gridSize;
                const gridY = particle.y / this.gridSize;
                const gx = Math.floor(gridX);
                const gy = Math.floor(gridY);

                let flowVx = this.windSpeed;
                let flowVy = 0;

                // Interpolacja biliniowa dla płynniejszego ruchu
                if (this.flowField[gy] && this.flowField[gy][gx]) {
                    const fx = gridX - gx;
                    const fy = gridY - gy;

                    const f00 = this.flowField[gy] && this.flowField[gy][gx] ? this.flowField[gy][gx] : { vx: this.windSpeed, vy: 0 };
                    const f10 = this.flowField[gy] && this.flowField[gy][gx + 1] ? this.flowField[gy][gx + 1] : { vx: this.windSpeed, vy: 0 };
                    const f01 = this.flowField[gy + 1] && this.flowField[gy + 1][gx] ? this.flowField[gy + 1][gx] : { vx: this.windSpeed, vy: 0 };
                    const f11 = this.flowField[gy + 1] && this.flowField[gy + 1][gx + 1] ? this.flowField[gy + 1][gx + 1] : { vx: this.windSpeed, vy: 0 };

                    flowVx =
                        f00.vx * (1 - fx) * (1 - fy) +
                        f10.vx * fx * (1 - fy) +
                        f01.vx * (1 - fx) * fy +
                        f11.vx * fx * fy;

                    flowVy =
                        f00.vy * (1 - fx) * (1 - fy) +
                        f10.vy * fx * (1 - fy) +
                        f01.vy * (1 - fx) * fy +
                        f11.vy * fx * fy;
                }

                // MOCNIEJSZA interpolacja - cząsteczki ściśle podążają za flow field
                const smoothing = 0.25;
                particle.vx = particle.vx * (1 - smoothing) + flowVx * smoothing;
                particle.vy = particle.vy * (1 - smoothing) + flowVy * smoothing;

                // Zapisz pozycję do śladu
                if (particle.age % 1 === 0) {
                    particle.trail.push({ x: particle.x, y: particle.y });
                    if (particle.trail.length > particle.maxTrailLength) {
                        particle.trail.shift();
                    }
                }

                // Sprawdź potencjalną nową pozycję
                const newX = particle.x + particle.vx * 0.5;
                const newY = particle.y + particle.vy * 0.5;

                // Kolizja z kształtem - zapobiegnij wejściu w kształt
                if (this.shape && this.isPointInShape(newX, newY)) {
                    const closest = this.getClosestPointOnShape(newX, newY);
                    const dx = newX - closest.x;
                    const dy = newY - closest.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0.1) {
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Reflect velocity
                        const dot = particle.vx * nx + particle.vy * ny;
                        particle.vx -= 2 * dot * nx * 0.8; // damping
                        particle.vy -= 2 * dot * ny * 0.8;

                        // Ustaw pozycję na krawędzi kształtu + margines
                        particle.x = closest.x + nx * 8;
                        particle.y = closest.y + ny * 8;
                    } else {
                        // Gdyby dist było bardzo małe, po prostu nie wpuszczaj cząsteczki
                        particle.vx = -particle.vx * 0.5;
                        particle.vy = -particle.vy * 0.5;
                    }
                } else {
                    // Brak kolizji - normalnie aktualizuj pozycję
                    particle.x = newX;
                    particle.y = newY;
                }

                // Usuń cząsteczki poza ekranem
                if (particle.x > this.canvas.width + 50 ||
                    particle.y < -50 ||
                    particle.y > this.canvas.height + 50) {
                    stream.particles.splice(i, 1);
                }
            }
        }
    }

    calculateForces() {
        if (!this.shape || this.shape.points.length < 3) {
            this.dragForce = 0;
            this.liftForce = 0;
            return;
        }

        let totalPressureX = 0;
        let totalPressureY = 0;
        let surfaceArea = 0;

        // Oblicz siły na podstawie ciśnienia wokół kształtu
        for (let i = 0; i < this.shape.points.length; i++) {
            const p1 = this.shape.points[i];
            const p2 = this.shape.points[(i + 1) % this.shape.points.length];

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Pobierz ciśnienie w tym punkcie
            const gridX = Math.floor(midX / this.gridSize);
            const gridY = Math.floor(midY / this.gridSize);

            if (this.flowField[gridY] && this.flowField[gridY][gridX]) {
                const pressure = this.flowField[gridY][gridX].pressure;

                // Normalna do powierzchni
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const nx = -dy / length;
                const ny = dx / length;

                totalPressureX += pressure * nx * length;
                totalPressureY += pressure * ny * length;
                surfaceArea += length;
            }
        }

        // Normalizuj
        if (surfaceArea > 0) {
            this.dragForce = totalPressureX / surfaceArea;
            this.liftForce = -totalPressureY / surfaceArea;
        }
    }

    render() {
        // Tło z gradientem
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        gradient.addColorStop(0, '#000814');
        gradient.addColorStop(1, '#001d3d');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Siatka
        if (this.showGrid) {
            this.drawGrid();
        }

        // Wizualizacja ciśnienia
        if (this.showPressure) {
            this.drawPressureField();
        }

        // Pole wektorowe
        if (this.showVectors) {
            this.drawFlowField();
        }

        // Cząsteczki i ich ślady
        this.drawParticles();

        // Kształt
        if (this.shape && !this.isDrawingMode) {
            this.drawShape(this.shape);
        }

        // Tryb rysowania
        if (this.isDrawingMode) {
            this.drawEditor();
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(79, 172, 254, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * this.gridSize;
                const py = y * this.gridSize;
                const flow = this.flowField[y][x];

                const magnitude = Math.sqrt(flow.vx * flow.vx + flow.vy * flow.vy);
                const alpha = Math.min(magnitude / this.windSpeed, 1.5) * 0.5;

                this.ctx.strokeStyle = `rgba(79, 172, 254, ${alpha})`;
                this.ctx.lineWidth = 1.5;

                const scale = 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(px, py);
                this.ctx.lineTo(px + flow.vx * scale, py + flow.vy * scale);
                this.ctx.stroke();

                // Strzałka
                const angle = Math.atan2(flow.vy, flow.vx);
                const arrowSize = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(px + flow.vx * scale, py + flow.vy * scale);
                this.ctx.lineTo(
                    px + flow.vx * scale - arrowSize * Math.cos(angle - Math.PI / 6),
                    py + flow.vy * scale - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                this.ctx.moveTo(px + flow.vx * scale, py + flow.vy * scale);
                this.ctx.lineTo(
                    px + flow.vx * scale - arrowSize * Math.cos(angle + Math.PI / 6),
                    py + flow.vy * scale - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                this.ctx.stroke();
            }
        }
    }

    drawPressureField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const pressure = this.flowField[y][x].pressure;

                // Kolor: niebieski = niskie ciśnienie, czerwony = wysokie ciśnienie
                let color;
                if (pressure < 1.0) {
                    const t = pressure;
                    color = `rgba(79, 172, 254, ${(1 - t) * 0.25})`;
                } else {
                    const t = Math.min((pressure - 1.0) / 0.5, 1);
                    color = `rgba(245, 87, 108, ${t * 0.3})`;
                }

                this.ctx.fillStyle = color;
                this.ctx.fillRect(
                    x * this.gridSize,
                    y * this.gridSize,
                    this.gridSize,
                    this.gridSize
                );
            }
        }
    }

    drawParticles() {
        for (let stream of this.particleStreams) {
            for (let particle of stream.particles) {
                // Rysuj ślad
                if (particle.trail.length > 1) {
                    const gradient = this.ctx.createLinearGradient(
                        particle.trail[0].x, particle.trail[0].y,
                        particle.x, particle.y
                    );
                    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.05)');
                    gradient.addColorStop(1, 'rgba(0, 242, 254, 0.6)');

                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.trail[0].x, particle.trail[0].y);

                    for (let i = 1; i < particle.trail.length; i++) {
                        this.ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
                    }
                    this.ctx.stroke();
                }

                // Rysuj cząsteczkę
                const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
                const hue = 180 + (speed / this.windSpeed) * 50;

                this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.95)`;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
                this.ctx.fill();

                // Poświata
                this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.15)`;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawShape(shape) {
        if (shape.points.length < 2) return;

        // Wypełnienie
        this.ctx.fillStyle = 'rgba(102, 126, 234, 0.8)';
        this.ctx.strokeStyle = '#4facfe';
        this.ctx.lineWidth = 3;

        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
            this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Rysuj punkty kontrolne tylko gdy w trybie pauzy lub przeciągania
        if (this.isPaused || this.isDragging) {
            for (let point of shape.points) {
                this.ctx.fillStyle = '#00f2fe';
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }

    drawEditor() {
        // Rysuj aktualny kształt w trakcie tworzenia
        if (this.drawingPoints.length > 0) {
            this.ctx.strokeStyle = '#fee140';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);

            this.ctx.beginPath();
            this.ctx.moveTo(this.drawingPoints[0].x, this.drawingPoints[0].y);
            for (let i = 1; i < this.drawingPoints.length; i++) {
                this.ctx.lineTo(this.drawingPoints[i].x, this.drawingPoints[i].y);
            }

            // Linia do aktualnej pozycji kursora
            if (this.tempPoint) {
                this.ctx.lineTo(this.tempPoint.x, this.tempPoint.y);
            }

            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Rysuj punkty
            for (let point of this.drawingPoints) {
                this.ctx.fillStyle = '#fee140';
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    // ==========================================
    // PREDEFINIOWANE KSZTAŁTY
    // ==========================================

    addCircle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 50;
        const points = [];
        const segments = 32;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            });
        }

        this.shape = { points, type: 'circle' };
    }

    addRectangle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const width = 100;
        const height = 60;

        this.shape = {
            points: [
                { x: centerX - width / 2, y: centerY - height / 2 },
                { x: centerX + width / 2, y: centerY - height / 2 },
                { x: centerX + width / 2, y: centerY + height / 2 },
                { x: centerX - width / 2, y: centerY + height / 2 }
            ],
            type: 'rectangle'
        };
    }

    addTriangle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const size = 60;

        this.shape = {
            points: [
                { x: centerX, y: centerY - size },
                { x: centerX - size, y: centerY + size },
                { x: centerX + size, y: centerY + size }
            ],
            type: 'triangle'
        };
    }

    addAirfoil() {
        // Profil lotniczy NACA 0012 (uproszczony)
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const chord = 120;
        const points = [];

        // Górna powierzchnia
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const x = centerX - chord / 2 + t * chord;
            const thickness = 0.6 * (0.2969 * Math.sqrt(t) - 0.1260 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
            const y = centerY - thickness * chord / 2;
            points.push({ x, y });
        }

        // Dolna powierzchnia
        for (let i = 20; i >= 0; i--) {
            const t = i / 20;
            const x = centerX - chord / 2 + t * chord;
            const thickness = 0.6 * (0.2969 * Math.sqrt(t) - 0.1260 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
            const y = centerY + thickness * chord / 2;
            points.push({ x, y });
        }

        this.shape = { points, type: 'airfoil' };
    }

    // ==========================================
    // EDYTOR KSZTAŁTÓW
    // ==========================================

    startDrawingMode() {
        this.isDrawingMode = true;
        this.drawingPoints = [];
        this.tempPoint = null;
        this.shape = null;
    }

    addDrawingPoint(x, y) {
        if (this.isDrawingMode) {
            this.drawingPoints.push({ x, y });
        }
    }

    finishDrawing() {
        if (this.drawingPoints.length >= 3) {
            this.shape = {
                points: [...this.drawingPoints],
                type: 'custom'
            };
        }
        this.isDrawingMode = false;
        this.drawingPoints = [];
        this.tempPoint = null;
    }

    cancelDrawing() {
        this.isDrawingMode = false;
        this.drawingPoints = [];
        this.tempPoint = null;
    }

    // ==========================================
    // IMPORT/EXPORT SVG
    // ==========================================

    async importSVG(file) {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');

        // Znajdź pierwszy path lub polygon
        let points = [];
        const path = doc.querySelector('path');
        const polygon = doc.querySelector('polygon');
        const polyline = doc.querySelector('polyline');

        if (path) {
            points = this.parseSVGPath(path.getAttribute('d'));
        } else if (polygon) {
            points = this.parseSVGPolygon(polygon.getAttribute('points'));
        } else if (polyline) {
            points = this.parseSVGPolygon(polyline.getAttribute('points'));
        }

        if (points.length >= 3) {
            // Skaluj i centruj
            points = this.normalizePoints(points);
            this.shape = { points, type: 'imported' };
        }
    }

    parseSVGPath(d) {
        const points = [];
        const commands = d.match(/[A-Za-z][^A-Za-z]*/g);
        let currentX = 0, currentY = 0;

        for (let cmd of commands) {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);

            if (type === 'M' || type === 'm') {
                currentX = type === 'M' ? args[0] : currentX + args[0];
                currentY = type === 'M' ? args[1] : currentY + args[1];
                points.push({ x: currentX, y: currentY });
            } else if (type === 'L' || type === 'l') {
                for (let i = 0; i < args.length; i += 2) {
                    currentX = type === 'L' ? args[i] : currentX + args[i];
                    currentY = type === 'L' ? args[i + 1] : currentY + args[i + 1];
                    points.push({ x: currentX, y: currentY });
                }
            }
        }

        return points;
    }

    parseSVGPolygon(pointsStr) {
        const coords = pointsStr.trim().split(/[\s,]+/).map(Number);
        const points = [];

        for (let i = 0; i < coords.length; i += 2) {
            points.push({ x: coords[i], y: coords[i + 1] });
        }

        return points;
    }

    normalizePoints(points) {
        if (points.length === 0) return points;

        // Znajdź granice
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const scale = Math.min(200 / width, 200 / height);

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        return points.map(p => ({
            x: centerX + (p.x - (minX + maxX) / 2) * scale,
            y: centerY + (p.y - (minY + maxY) / 2) * scale
        }));
    }

    exportShape() {
        if (!this.shape) {
            alert('Brak kształtu do eksportu!');
            return;
        }

        const points = this.shape.points;
        let pathData = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
            pathData += ` L ${points[i].x} ${points[i].y}`;
        }
        pathData += ' Z';

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.canvas.width} ${this.canvas.height}">
  <path d="${pathData}" fill="none" stroke="#4facfe" stroke-width="2"/>
</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ksztalt-tunel-aero.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onMouseDown(e) {
        const coords = this.getCanvasCoords(e);

        if (this.isDrawingMode) {
            this.addDrawingPoint(coords.x, coords.y);
        } else if (this.shape) {
            // Sprawdź czy kliknięto w wierzchołek
            for (let point of this.shape.points) {
                const dist = Math.sqrt((coords.x - point.x) ** 2 + (coords.y - point.y) ** 2);
                if (dist < 10) {
                    this.selectedVertex = point;
                    this.isDragging = true;
                    return;
                }
            }

            // Sprawdź czy kliknięto w kształt
            if (this.isPointInShape(coords.x, coords.y)) {
                this.isDragging = true;
                this.dragOffset = {
                    x: coords.x - this.shape.points[0].x,
                    y: coords.y - this.shape.points[0].y
                };
            }
        }
    }

    onMouseMove(e) {
        const coords = this.getCanvasCoords(e);

        if (this.isDrawingMode) {
            this.tempPoint = coords;
        } else if (this.isDragging) {
            if (this.selectedVertex) {
                // Przesuń wierzchołek
                this.selectedVertex.x = coords.x;
                this.selectedVertex.y = coords.y;
            } else if (this.shape) {
                // Przesuń cały kształt
                const dx = coords.x - this.dragOffset.x - this.shape.points[0].x;
                const dy = coords.y - this.dragOffset.y - this.shape.points[0].y;

                for (let point of this.shape.points) {
                    point.x += dx;
                    point.y += dy;
                }
            }
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.selectedVertex = null;
    }

    onMouseLeave(e) {
        this.isDragging = false;
        this.selectedVertex = null;
        if (this.isDrawingMode) {
            this.tempPoint = null;
        }
    }

    // ==========================================
    // MAIN LOOP
    // ==========================================

    update() {
        if (!this.isPaused) {
            this.updateFlowField();
            this.updateParticles();
            this.calculateForces();
            this.updateFPS();
        }
    }

    updateFPS() {
        const now = performance.now();
        this.frameCount++;

        if (now - this.fpsUpdateTime > 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (now - this.fpsUpdateTime));
            this.frameCount = 0;
            this.fpsUpdateTime = now;
        }
    }

    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    reset() {
        this.initParticleStreams();
        this.shape = null;
        this.isDrawingMode = false;
        this.drawingPoints = [];
    }

    clearShape() {
        this.shape = null;
    }
}

// ==========================================
// INICJALIZACJA APLIKACJI
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('airflowCanvas');
    const tunnel = new WindTunnel(canvas);

    // Kontrolki parametrów
    const windSpeedSlider = document.getElementById('windSpeed');
    const windSpeedValue = document.getElementById('windSpeedValue');
    const particleDensitySlider = document.getElementById('particleDensity');
    const particleDensityValue = document.getElementById('particleDensityValue');

    windSpeedSlider.addEventListener('input', (e) => {
        tunnel.windSpeed = parseFloat(e.target.value);
        windSpeedValue.textContent = e.target.value;
    });

    particleDensitySlider.addEventListener('input', (e) => {
        const density = parseInt(e.target.value);
        tunnel.updateParticleDensity(density);
        particleDensityValue.textContent = density;
    });

    // Opcje wizualizacji
    document.getElementById('showVectors').addEventListener('change', (e) => {
        tunnel.showVectors = e.target.checked;
    });

    document.getElementById('showPressure').addEventListener('change', (e) => {
        tunnel.showPressure = e.target.checked;
    });

    document.getElementById('showGrid').addEventListener('change', (e) => {
        tunnel.showGrid = e.target.checked;
    });

    // Przyciski kształtów
    document.getElementById('addCircle').addEventListener('click', () => {
        tunnel.addCircle();
    });

    document.getElementById('addRectangle').addEventListener('click', () => {
        tunnel.addRectangle();
    });

    document.getElementById('addAirfoil').addEventListener('click', () => {
        tunnel.addAirfoil();
    });

    document.getElementById('addTriangle').addEventListener('click', () => {
        tunnel.addTriangle();
    });

    // Edytor
    const startDrawingBtn = document.getElementById('startDrawing');
    const finishShapeBtn = document.getElementById('finishShape');
    const cancelDrawingBtn = document.getElementById('cancelDrawing');
    const drawingModeInfo = document.getElementById('drawingMode');

    startDrawingBtn.addEventListener('click', () => {
        tunnel.startDrawingMode();
        startDrawingBtn.disabled = true;
        finishShapeBtn.disabled = false;
        cancelDrawingBtn.disabled = false;
        drawingModeInfo.style.display = 'block';
    });

    finishShapeBtn.addEventListener('click', () => {
        tunnel.finishDrawing();
        startDrawingBtn.disabled = false;
        finishShapeBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        drawingModeInfo.style.display = 'none';
    });

    cancelDrawingBtn.addEventListener('click', () => {
        tunnel.cancelDrawing();
        startDrawingBtn.disabled = false;
        finishShapeBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        drawingModeInfo.style.display = 'none';
    });

    // Import/Export
    document.getElementById('svgImport').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await tunnel.importSVG(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('exportShape').addEventListener('click', () => {
        tunnel.exportShape();
    });

    document.getElementById('clearShapes').addEventListener('click', () => {
        tunnel.clearShape();
    });

    // Kontrola symulacji
    const pausePlayButton = document.getElementById('pausePlay');
    pausePlayButton.addEventListener('click', () => {
        const isPaused = tunnel.togglePause();
        pausePlayButton.textContent = isPaused ? '▶️ Wznów' : '⏸️ Pauza';
    });

    document.getElementById('reset').addEventListener('click', () => {
        tunnel.reset();
        pausePlayButton.textContent = '⏸️ Pauza';
    });

    // Aktualizacja metryk
    setInterval(() => {
        let particleCount = 0;
        for (let stream of tunnel.particleStreams) {
            particleCount += stream.particles.length;
        }

        document.getElementById('particleCount').textContent = particleCount;
        document.getElementById('fpsCounter').textContent = tunnel.fps;
        document.getElementById('dragCoeff').textContent = tunnel.dragForce.toFixed(2);
        document.getElementById('liftCoeff').textContent = tunnel.liftForce.toFixed(2);
    }, 100);
});
