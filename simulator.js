// Symulator Przepływu Powietrza 2D
class AirflowSimulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = 1200;
        this.canvas.height = 600;

        // Parametry symulacji
        this.windSpeed = 5;
        this.turbulence = 0.5;
        this.isPaused = false;
        this.showVectors = true;

        // Cząsteczki powietrza
        this.particles = [];
        this.maxParticles = 3000;

        // Kształty/przeszkody
        this.shapes = [];
        this.selectedShape = null;
        this.isDragging = false;

        // Siatka do wizualizacji pola wektorowego
        this.gridSize = 30;
        this.flowField = [];

        this.initFlowField();
        this.initParticles();
        this.setupEventListeners();
        this.animate();
    }

    initFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        for (let y = 0; y < rows; y++) {
            this.flowField[y] = [];
            for (let x = 0; x < cols; x++) {
                this.flowField[y][x] = { vx: this.windSpeed, vy: 0 };
            }
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: this.windSpeed,
            vy: (Math.random() - 0.5) * this.turbulence,
            life: Math.random() * 100,
            maxLife: 100,
            size: Math.random() * 2 + 1
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
                    vy: (Math.random() - 0.5) * this.turbulence * 0.5
                };
            }
        }

        // Wpływ kształtów na pole przepływu
        for (let shape of this.shapes) {
            this.applyShapeInfluence(shape);
        }
    }

    applyShapeInfluence(shape) {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * this.gridSize;
                const py = y * this.gridSize;

                // Sprawdź odległość od kształtu
                const dx = px - shape.x;
                const dy = py - shape.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Wpływ kształtu na przepływ
                const influenceRadius = shape.size * 3;

                if (dist < influenceRadius && dist > 0) {
                    // Siła odpychająca
                    const force = (influenceRadius - dist) / influenceRadius;
                    const angle = Math.atan2(dy, dx);

                    this.flowField[y][x].vx += Math.cos(angle) * force * this.windSpeed * 2;
                    this.flowField[y][x].vy += Math.sin(angle) * force * this.windSpeed * 2;

                    // Dodaj rotację wokół przeszkody
                    this.flowField[y][x].vx += -Math.sin(angle) * force * this.windSpeed * 0.5;
                    this.flowField[y][x].vy += Math.cos(angle) * force * this.windSpeed * 0.5;
                }
            }
        }
    }

    updateParticles() {
        for (let particle of this.particles) {
            // Pobierz przepływ z siatki
            const gridX = Math.floor(particle.x / this.gridSize);
            const gridY = Math.floor(particle.y / this.gridSize);

            if (this.flowField[gridY] && this.flowField[gridY][gridX]) {
                const flow = this.flowField[gridY][gridX];
                particle.vx = particle.vx * 0.95 + flow.vx * 0.05;
                particle.vy = particle.vy * 0.95 + flow.vy * 0.05;
            }

            // Dodaj turbulencję
            particle.vy += (Math.random() - 0.5) * this.turbulence * 0.1;

            // Aktualizuj pozycję
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Sprawdź kolizje z kształtami
            for (let shape of this.shapes) {
                if (this.checkParticleShapeCollision(particle, shape)) {
                    this.handleParticleShapeCollision(particle, shape);
                }
            }

            // Zmniejsz życie
            particle.life--;

            // Reset cząsteczki jeśli wyszła poza ekran lub straciła życie
            if (particle.x > this.canvas.width || particle.x < 0 ||
                particle.y > this.canvas.height || particle.y < 0 ||
                particle.life <= 0) {

                // Resetuj od lewej strony
                particle.x = -10;
                particle.y = Math.random() * this.canvas.height;
                particle.vx = this.windSpeed;
                particle.vy = (Math.random() - 0.5) * this.turbulence;
                particle.life = particle.maxLife;
            }
        }
    }

    checkParticleShapeCollision(particle, shape) {
        const dx = particle.x - shape.x;
        const dy = particle.y - shape.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        switch (shape.type) {
            case 'circle':
                return dist < shape.size;
            case 'rectangle':
                return Math.abs(dx) < shape.width / 2 && Math.abs(dy) < shape.height / 2;
            case 'triangle':
                return this.pointInTriangle(particle.x, particle.y, shape);
            default:
                return false;
        }
    }

    pointInTriangle(px, py, triangle) {
        // Uproszczona kolizja z trójkątem (sprawdzenie dystansu)
        const dx = px - triangle.x;
        const dy = py - triangle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < triangle.size;
    }

    handleParticleShapeCollision(particle, shape) {
        // Odbicie cząsteczki od kształtu
        const dx = particle.x - shape.x;
        const dy = particle.y - shape.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            // Normalizuj wektor
            const nx = dx / dist;
            const ny = dy / dist;

            // Odbij prędkość
            const dot = particle.vx * nx + particle.vy * ny;
            particle.vx = particle.vx - 2 * dot * nx;
            particle.vy = particle.vy - 2 * dot * ny;

            // Przesuń cząsteczkę poza kształt
            particle.x = shape.x + nx * (shape.size || shape.width / 2);
            particle.y = shape.y + ny * (shape.size || shape.height / 2);
        }
    }

    render() {
        // Wyczyść canvas
        this.ctx.fillStyle = 'rgba(15, 15, 30, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Rysuj pole wektorowe
        if (this.showVectors) {
            this.drawFlowField();
        }

        // Rysuj cząsteczki
        this.drawParticles();

        // Rysuj kształty
        this.drawShapes();
    }

    drawFlowField() {
        const cols = Math.ceil(this.canvas.width / this.gridSize);
        const rows = Math.ceil(this.canvas.height / this.gridSize);

        this.ctx.strokeStyle = 'rgba(79, 172, 254, 0.2)';
        this.ctx.lineWidth = 1;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * this.gridSize;
                const py = y * this.gridSize;
                const flow = this.flowField[y][x];

                const magnitude = Math.sqrt(flow.vx * flow.vx + flow.vy * flow.vy);
                const scale = 3;

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

    drawParticles() {
        for (let particle of this.particles) {
            const alpha = particle.life / particle.maxLife;
            const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);

            // Kolor zależny od prędkości
            const hue = 180 + speed * 10;
            this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha * 0.8})`;

            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Ślad cząsteczki
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha * 0.3})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(particle.x, particle.y);
            this.ctx.lineTo(particle.x - particle.vx * 2, particle.y - particle.vy * 2);
            this.ctx.stroke();
        }
    }

    drawShapes() {
        for (let shape of this.shapes) {
            this.ctx.fillStyle = shape === this.selectedShape ?
                'rgba(245, 87, 108, 0.7)' : 'rgba(102, 126, 234, 0.7)';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();

            switch (shape.type) {
                case 'circle':
                    this.ctx.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
                    break;

                case 'rectangle':
                    this.ctx.rect(
                        shape.x - shape.width / 2,
                        shape.y - shape.height / 2,
                        shape.width,
                        shape.height
                    );
                    break;

                case 'triangle':
                    this.ctx.moveTo(shape.x, shape.y - shape.size);
                    this.ctx.lineTo(shape.x - shape.size, shape.y + shape.size);
                    this.ctx.lineTo(shape.x + shape.size, shape.y + shape.size);
                    this.ctx.closePath();
                    break;
            }

            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    addShape(type) {
        const shape = {
            type: type,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2
        };

        switch (type) {
            case 'circle':
                shape.size = 40;
                break;
            case 'rectangle':
                shape.width = 80;
                shape.height = 60;
                shape.size = 50; // dla kolizji
                break;
            case 'triangle':
                shape.size = 50;
                break;
        }

        this.shapes.push(shape);
    }

    findShapeAtPosition(x, y) {
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            const dx = x - shape.x;
            const dy = y - shape.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (shape.type === 'circle' && dist < shape.size) {
                return shape;
            }
            if (shape.type === 'rectangle' &&
                Math.abs(dx) < shape.width / 2 && Math.abs(dy) < shape.height / 2) {
                return shape;
            }
            if (shape.type === 'triangle' && dist < shape.size) {
                return shape;
            }
        }
        return null;
    }

    setupEventListeners() {
        // Mouse events dla przeciągania kształtów
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.selectedShape = this.findShapeAtPosition(x, y);
            if (this.selectedShape) {
                this.isDragging = true;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.selectedShape) {
                const rect = this.canvas.getBoundingClientRect();
                this.selectedShape.x = e.clientX - rect.left;
                this.selectedShape.y = e.clientY - rect.top;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
    }

    update() {
        if (!this.isPaused) {
            this.updateFlowField();
            this.updateParticles();
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
        this.initParticles();
        this.shapes = [];
    }
}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('airflowCanvas');
    const simulator = new AirflowSimulator(canvas);

    // Kontrolki
    const windSpeedSlider = document.getElementById('windSpeed');
    const windSpeedValue = document.getElementById('windSpeedValue');
    const turbulenceSlider = document.getElementById('turbulence');
    const turbulenceValue = document.getElementById('turbulenceValue');
    const showVectorsCheckbox = document.getElementById('showVectors');

    windSpeedSlider.addEventListener('input', (e) => {
        simulator.windSpeed = parseFloat(e.target.value);
        windSpeedValue.textContent = e.target.value;
    });

    turbulenceSlider.addEventListener('input', (e) => {
        simulator.turbulence = parseFloat(e.target.value);
        turbulenceValue.textContent = e.target.value;
    });

    showVectorsCheckbox.addEventListener('change', (e) => {
        simulator.showVectors = e.target.checked;
    });

    // Przyciski kształtów
    document.getElementById('addCircle').addEventListener('click', () => {
        simulator.addShape('circle');
    });

    document.getElementById('addRectangle').addEventListener('click', () => {
        simulator.addShape('rectangle');
    });

    document.getElementById('addTriangle').addEventListener('click', () => {
        simulator.addShape('triangle');
    });

    document.getElementById('clearShapes').addEventListener('click', () => {
        simulator.shapes = [];
    });

    // Kontrola symulacji
    const pausePlayButton = document.getElementById('pausePlay');
    pausePlayButton.addEventListener('click', () => {
        const isPaused = simulator.togglePause();
        pausePlayButton.textContent = isPaused ? 'Wznów' : 'Pauza';
    });

    document.getElementById('reset').addEventListener('click', () => {
        simulator.reset();
        pausePlayButton.textContent = 'Pauza';
    });
});
