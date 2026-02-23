/**
 * SKELETAL DRAGON ANIMATION - OPTIMIZED ENGINE
 * 
 * Yeh script performance-optimized procedural animation engine hai.
 * Optimizations: Object Pooling, Squared Distance Math, Batch Rendering.
 */

// State Object - Sare global variables ko ek jagah organize kiya
const state = {
    canvas: document.getElementById('snakeCanvas'),
    ctx: document.getElementById('snakeCanvas').getContext('2d'),
    themeBtn: document.getElementById('themeBtn'),
    width: 0,
    height: 0,
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    dragon: null,
    food: null,
    time: 0,
    distanceWalked: 0,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    particles: [],
    bgParticles: [],
    joystick: { active: false, startX: 0, startY: 0, currX: 0, currY: 0, radius: 50 },
    themes: ['#161616', '#0a0b16', '#160a16', '#0a1616', '#1c1c1e'],
    currentThemeIndex: 0
};

/**
 * PARTICLE POOL - Memory Optimization (GC spikes rokne ke liye)
 */
const ParticlePool = {
    pool: [],
    get(x, y, angle, speed, life, scale, color) {
        let p;
        if (this.pool.length > 0) {
            p = this.pool.pop();
            p.init(x, y, angle, speed, life, scale, color);
        } else {
            p = new Particle(x, y, angle, speed, life, scale, color);
        }
        return p;
    },
    recycle(p) {
        this.pool.push(p);
    }
};

class Particle {
    constructor(x, y, angle, speed, life, scale, color) {
        this.init(x, y, angle, speed, life, scale, color);
    }

    init(x, y, angle, speed, life, scale, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle + (Math.random() - 0.5) * 0.5) * speed;
        this.vy = Math.sin(angle + (Math.random() - 0.5) * 0.5) * speed;
        this.life = life;
        this.initialLife = life;
        this.size = (Math.random() * 6 + 2) * scale;
        this.color = color || (Math.random() > 0.5 ? '#4facfe' : '#00f2fe');
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.96;
    }

    draw(ctx) {
        const opacity = this.life / this.initialLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * FOOD CLASS - Optimized collision detection
 */
class Food {
    constructor() {
        this.spawn();
    }

    spawn() {
        let valid = false;
        let attempts = 0;
        const margin = 100;
        const minDistSq = 10000; // 100^2

        while (!valid && attempts < 50) {
            this.x = Math.random() * (state.width - margin * 2) + margin;
            this.y = Math.random() * (state.height - margin * 2) + margin;
            valid = true;
            if (state.dragon) {
                for (let i = 0; i < state.dragon.segments.length; i += 2) {
                    const seg = state.dragon.segments[i];
                    const dx = this.x - seg.x;
                    const dy = this.y - seg.y;
                    if (dx * dx + dy * dy < minDistSq) {
                        valid = false;
                        break;
                    }
                }
            }
            attempts++;
        }
        this.size = 8;
        this.baseSize = 8;
    }

    draw(ctx) {
        const blink = (Math.sin(state.time * 12) + 1) * 0.5;
        this.size = this.baseSize + blink * 4;

        ctx.save();
        ctx.shadowBlur = 15 + blink * 10;
        ctx.shadowColor = '#00f2fe';
        ctx.fillStyle = '#4facfe';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        const head = state.dragon.segments[0];
        const dx = head.x - this.x;
        const dy = head.y - this.y;
        if (dx * dx + dy * dy < 1600) { // 40^2
            this.eat();
        }
    }

    eat() {
        for (let i = 0; i < 20; i++) {
            state.particles.push(ParticlePool.get(this.x, this.y, Math.random() * Math.PI * 2, 2 + Math.random() * 4, 30 + Math.random() * 20, state.dragon.scale * 1.5));
        }
        this.spawn();
    }
}

/**
 * DRAGON CLASS - Performance Refactoring
 */
class SkeletonDragon {
    constructor() {
        this.scale = state.isMobile ? 0.6 : 1.0;
        this.length = state.isMobile ? 40 : 64;
        this.segments = [];
        this.segmentDist = 18 * this.scale;
        this.ribWidth = 30 * this.scale;
        this.legCount = state.isMobile ? 8 : 12;

        this.isBreathingFire = false;
        this.fireTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;

        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = state.isMobile ? 5 : 7;
        this.friction = 0.92;
        this.acceleration = 0.08;
        this.bufferDist = 50 * this.scale;

        for (let i = 0; i < this.length; i++) {
            this.segments.push({
                x: state.width / 2 - i * this.segmentDist,
                y: state.height / 2,
                angle: 0
            });
        }
    }

    update() {
        const head = this.segments[0];
        const oldX = head.x;
        const oldY = head.y;

        let targetX = state.mouse.x;
        let targetY = state.mouse.y;

        if (state.isMobile) {
            if (state.joystick.active) {
                const jdx = state.joystick.currX - state.joystick.startX;
                const jdy = state.joystick.currY - state.joystick.startY;
                targetX = head.x + jdx * 2;
                targetY = head.y + jdy * 2;
            } else {
                targetX = head.x;
                targetY = head.y;
            }
        }

        const dx = targetX - head.x;
        const dy = targetY - head.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (!state.isMobile && distSq < (2500 * this.scale * this.scale) && dist > 0) { // 50^2
            const pushForce = (50 * this.scale - dist) * 0.05;
            this.vx -= (dx / (dist || 1)) * pushForce;
            this.vy -= (dy / (dist || 1)) * pushForce;
        } else if (dist > (state.isMobile ? (state.joystick.active ? 10 : 0) : this.bufferDist)) {
            const actualTargetX = targetX - (dx / (dist || 1)) * (state.isMobile ? 0 : this.bufferDist);
            const actualTargetY = targetY - (dy / (dist || 1)) * (state.isMobile ? 0 : this.bufferDist);
            const tdx = actualTargetX - head.x;
            const tdy = actualTargetY - head.y;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            const accel = Math.min(this.acceleration, tdist * 0.005);
            this.vx += (tdx / (tdist || 1)) * accel * 10;
            this.vy += (tdy / (tdist || 1)) * accel * 10;
        }

        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq > this.maxSpeed * this.maxSpeed) {
            const speed = Math.sqrt(speedSq);
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        this.vx *= this.friction;
        this.vy *= this.friction;
        head.x += this.vx;
        head.y += this.vy;

        state.distanceWalked += Math.sqrt((head.x - oldX) ** 2 + (head.y - oldY) ** 2);

        for (let i = 1; i < this.length; i++) {
            const prev = this.segments[i - 1];
            const curr = this.segments[i];
            let targetDist = this.segmentDist;
            if (this.isAttacking && i > this.length - 10) {
                targetDist = this.segmentDist * (1 + Math.sin(this.attackTimer * 0.5) * 0.5);
            }
            const sdx = curr.x - prev.x;
            const sdy = curr.y - prev.y;
            const sdist = Math.sqrt(sdx * sdx + sdy * sdy);

            const angle = Math.atan2(sdy, sdx);
            const angleDiff = ((angle - curr.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            curr.angle += angleDiff * 0.2;

            curr.x = prev.x + (sdx / (sdist || 1)) * targetDist;
            curr.y = prev.y + (sdy / (sdist || 1)) * targetDist;
        }

        if (this.isBreathingFire) {
            this.fireTimer--;
            if (this.fireTimer <= 0) this.isBreathingFire = false;
            const angle = Math.atan2(head.y - this.segments[1].y, head.x - this.segments[1].x);
            for (let i = 0; i < (state.isMobile ? 2 : 4); i++) {
                // Fire colors: red, orange, yellow
                const fireColors = ['#ff4d4d', '#ffa500', '#ffff00', '#ff8c00'];
                const color = fireColors[Math.floor(Math.random() * fireColors.length)];
                state.particles.push(ParticlePool.get(
                    head.x + Math.cos(angle) * 20,
                    head.y + Math.sin(angle) * 20,
                    angle,
                    5 + Math.random() * 5,
                    20 + Math.random() * 10,
                    this.scale,
                    color
                ));
            }
        }
        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.isAttacking = false;
        }
    }

    triggerFire() {
        this.isBreathingFire = true;
        this.fireTimer = 40; // Approx 1 second at 60fps
    }

    draw(ctx) {
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq > 25) { // 5^2
            ctx.save();
            ctx.translate(Math.random() * 2 - 1, Math.random() * 2 - 1);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            this.renderSkeleton(ctx, false);
            ctx.restore();
        }
        ctx.strokeStyle = 'white';
        this.renderSkeleton(ctx, true);
        if (state.isMobile && state.joystick.active) this.drawJoystick(ctx);
    }

    renderSkeleton(ctx, glow) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (glow) {
            ctx.shadowBlur = (10 + (Math.sin(state.time * 3) + 1) * 5) * this.scale;
            ctx.shadowColor = '#4facfe';
        }

        // 1. Spine
        ctx.beginPath();
        ctx.lineWidth = 3 * this.scale;
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.length; i++) ctx.lineTo(this.segments[i].x, this.segments[i].y);
        ctx.stroke();

        // 2. Ribs & Details
        ctx.lineWidth = 1.2 * this.scale;
        for (let i = 2; i < this.length - 10; i++) {
            const seg = this.segments[i];
            const size = Math.sin((i / (this.length - 10)) * Math.PI) * this.ribWidth;
            const cos = Math.cos(seg.angle + Math.PI / 2);
            const sin = Math.sin(seg.angle + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(seg.x + cos * size, seg.y + sin * size);
            ctx.quadraticCurveTo(seg.x + Math.cos(seg.angle) * 5, seg.y + Math.sin(seg.angle) * 5, seg.x - cos * size, seg.y - sin * size);
            ctx.stroke();
            if (i === 2) this.drawSkull(ctx, seg);
        }

        // 3. Legs
        const spacing = Math.floor((this.length - 15) / (this.legCount / 2));
        for (let i = 1; i <= this.legCount / 2; i++) {
            const seg = this.segments[i * spacing + 5];
            if (seg) this.drawLegs(ctx, seg, i);
        }

        this.drawTail(ctx, this.segments[this.length - 1]);
        ctx.shadowBlur = 0;
    }

    drawSkull(ctx, seg) {
        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(Math.atan2(seg.y - this.segments[1].y, seg.x - this.segments[1].x));
        ctx.beginPath();
        ctx.moveTo(25 * this.scale, 0);
        ctx.bezierCurveTo(10 * this.scale, -15 * this.scale, -15 * this.scale, -15 * this.scale, -20 * this.scale, -5 * this.scale);
        ctx.lineTo(-20 * this.scale, 5 * this.scale);
        ctx.bezierCurveTo(-15 * this.scale, 15 * this.scale, 10 * this.scale, 15 * this.scale, 25 * this.scale, 0);
        ctx.stroke();
        [-1, 1].forEach(s => {
            ctx.beginPath();
            ctx.moveTo(-10 * this.scale, 8 * s * this.scale);
            ctx.quadraticCurveTo(-25 * this.scale, 25 * s * this.scale, -40 * this.scale, 15 * s * this.scale);
            ctx.stroke();
        });
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.arc(0, -6 * this.scale, 3 * this.scale, 0, 7);
        ctx.arc(0, 6 * this.scale, 3 * this.scale, 0, 7);
        ctx.fill();
        ctx.restore();
    }

    drawLegs(ctx, seg, idx) {
        const cycle = state.distanceWalked * 0.05 + (idx * Math.PI / 2);
        [-1, 1].forEach(s => {
            const sideCycle = cycle + (s === 1 ? Math.PI : 0);
            const lift = Math.max(0, Math.sin(sideCycle)) * 12 * this.scale;
            const swing = Math.cos(sideCycle) * 18 * this.scale;
            const angle = seg.angle + (Math.PI / 2) * s;
            const jx = seg.x + Math.cos(angle) * 28 * this.scale + Math.cos(seg.angle) * swing;
            const jy = seg.y + Math.sin(angle) * 28 * this.scale + Math.sin(seg.angle) * swing - lift;
            ctx.beginPath();
            ctx.moveTo(seg.x, seg.y);
            ctx.lineTo(jx, jy);
            ctx.lineTo(jx + Math.cos(angle + 0.4 * s) * 20 * this.scale, jy + Math.sin(angle + 0.4 * s) * 20 * this.scale);
            ctx.stroke();
        });
    }

    drawTail(ctx, seg) {
        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(seg.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-10 * this.scale, -20 * this.scale, -30 * this.scale, -10 * this.scale, -40 * this.scale, 0);
        ctx.bezierCurveTo(-30 * this.scale, 10 * this.scale, -10 * this.scale, 20 * this.scale, 0, 0);
        ctx.stroke();
        ctx.restore();
    }

    drawJoystick(ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(state.joystick.startX, state.joystick.startY, state.joystick.radius, 0, 7);
        ctx.stroke();
        ctx.fillStyle = 'rgba(79, 172, 254, 0.5)';
        ctx.beginPath();
        ctx.arc(state.joystick.currX, state.joystick.currY, 20, 0, 7);
        ctx.fill();
    }
}

/**
 * ENGINE CORE
 */
const Engine = {
    init() {
        this.resize();
        state.dragon = new SkeletonDragon();
        state.food = new Food();
        for (let i = 0; i < 100; i++) state.bgParticles.push({
            x: Math.random() * state.width, y: Math.random() * state.height,
            sz: Math.random() * 1.5, op: Math.random() * 0.5 + 0.1, sp: Math.random() * 0.5 + 0.2
        });

        this.bindEvents();
        this.loop();
    },

    resize() {
        state.width = state.canvas.width = window.innerWidth;
        state.height = state.canvas.height = window.innerHeight;
    },

    bindEvents() {
        window.addEventListener('resize', () => { this.resize(); state.dragon = new SkeletonDragon(); });
        window.addEventListener('mousemove', e => { if (!state.isMobile) { state.mouse.x = e.clientX; state.mouse.y = e.clientY; } });
        state.themeBtn.addEventListener('click', () => {
            state.currentThemeIndex = (state.currentThemeIndex + 1) % state.themes.length;
            document.body.style.background = state.themes[state.currentThemeIndex];
        });
        window.addEventListener('dblclick', () => state.dragon.triggerFire());

        let lastTap = 0;
        window.addEventListener('touchstart', e => {
            const t = e.touches[0];
            const now = Date.now();
            if (now - lastTap < 300) state.dragon.triggerFire();
            lastTap = now;
            state.joystick.active = true;
            state.joystick.startX = state.joystick.currX = t.clientX;
            state.joystick.startY = state.joystick.currY = t.clientY;
        });
        window.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = e.touches[0];
            const dx = t.clientX - state.joystick.startX, dy = t.clientY - state.joystick.startY;
            const d = Math.hypot(dx, dy);
            if (d > state.joystick.radius) {
                state.joystick.currX = state.joystick.startX + (dx / d) * state.joystick.radius;
                state.joystick.currY = state.joystick.startY + (dy / d) * state.joystick.radius;
            } else {
                state.joystick.currX = t.clientX; state.joystick.currY = t.clientY;
            }
        }, { passive: false });
        window.addEventListener('touchend', () => state.joystick.active = false);
    },

    loop() {
        state.ctx.fillStyle = state.themes[state.currentThemeIndex] + '66';
        state.ctx.fillRect(0, 0, state.width, state.height);
        state.time += 0.01;

        // Background
        state.ctx.fillStyle = 'white';
        state.bgParticles.forEach(p => {
            p.x -= state.dragon.vx * 0.1 * p.sp; p.y -= state.dragon.vy * 0.1 * p.sp;
            if (p.x < 0) p.x = state.width; if (p.x > state.width) p.x = 0;
            if (p.y < 0) p.y = state.height; if (p.y > state.height) p.y = 0;
            state.ctx.globalAlpha = p.op;
            state.ctx.beginPath(); state.ctx.arc(p.x, p.y, p.sz, 0, 7); state.ctx.fill();
        });
        state.ctx.globalAlpha = 1;

        state.food.update(); state.food.draw(state.ctx);
        state.dragon.update(); state.dragon.draw(state.ctx);

        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.update(); p.draw(state.ctx);
            if (p.life <= 0) {
                state.particles.splice(i, 1);
                ParticlePool.recycle(p);
            }
        }
        state.ctx.globalAlpha = 1;

        requestAnimationFrame(() => this.loop());
    }
};

Engine.init();
