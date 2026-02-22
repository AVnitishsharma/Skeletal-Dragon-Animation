const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let dragon;
let food;
let time = 0;
let distanceWalked = 0;
let particles = [];
let bgParticles = [];
let isMobile = false;
let joystick = { active: false, startX: 0, startY: 0, currX: 0, currY: 0, radius: 50 };

class Food {
    constructor() {
        this.spawn();
    }

    spawn() {
        let valid = false;
        let attempts = 0;
        while (!valid && attempts < 50) {
            this.x = Math.random() * (width - 100) + 50;
            this.y = Math.random() * (height - 100) + 50;

            valid = true;
            if (dragon) {
                for (let seg of dragon.segments) {
                    if (Math.hypot(this.x - seg.x, this.y - seg.y) < 100) {
                        valid = false;
                        break;
                    }
                }
            }
            attempts++;
        }
        this.size = 8;
        this.baseSize = 8;
        this.glow = 15;
    }

    draw() {
        const blink = (Math.sin(time * 12) + 1) / 2;
        this.size = this.baseSize + blink * 4;

        ctx.save();
        ctx.shadowBlur = this.glow + blink * 10;
        ctx.shadowColor = '#00f2fe';
        ctx.fillStyle = '#4facfe';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        const head = dragon.segments[0];
        const dist = Math.hypot(this.x - head.x, this.y - head.y);
        if (dist < 40) {
            this.eat();
        }
    }

    eat() {
        // Burst effects
        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(this.x, this.y, Math.random() * Math.PI * 2, 2 + Math.random() * 4, 30 + Math.random() * 20, dragon.scale * 1.5));
        }
        this.spawn();
    }
}

class BackgroundParticle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.size = Math.random() * 1.5 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.speedMult = Math.random() * 0.5 + 0.2;
    }

    update(vx, vy) {
        this.x -= vx * 0.2 * this.speedMult;
        this.y -= vy * 0.2 * this.speedMult;

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, angle, speed, life, scale = 1) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle + (Math.random() - 0.5) * 0.5) * speed;
        this.vy = Math.sin(angle + (Math.random() - 0.5) * 0.5) * speed;
        this.life = life;
        this.initialLife = life;
        this.size = (Math.random() * 6 + 2) * scale;
        this.color = Math.random() > 0.5 ? '#4facfe' : '#00f2fe';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.96;
    }

    draw() {
        const opacity = this.life / this.initialLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class SkeletonDragon {
    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.scale = this.isMobile ? 0.6 : 1.0;

        this.length = Math.floor((this.isMobile ? 40 : 64) * 1);
        this.baseSpeed = 0.06;
        this.segments = [];
        this.segmentDist = 18 * this.scale;
        this.ribWidth = 30 * this.scale;
        this.legCount = this.isMobile ? 8 : 12;

        this.isBreathingFire = false;
        this.fireTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;

        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = this.isMobile ? 6 : 8;
        this.friction = 0.95;
        this.acceleration = 0.05;
        this.bufferDist = 60 * this.scale;

        for (let i = 0; i < this.length; i++) {
            this.segments.push({
                x: width / 2 - i * this.segmentDist,
                y: height / 2,
                angle: 0
            });
        }
    }

    update() {
        const head = this.segments[0];
        const oldX = head.x;
        const oldY = head.y;

        let targetX = mouse.x;
        let targetY = mouse.y;

        if (this.isMobile) {
            if (joystick.active) {
                const jdx = joystick.currX - joystick.startX;
                const jdy = joystick.currY - joystick.startY;
                targetX = head.x + jdx * 2;
                targetY = head.y + jdy * 2;
            } else {
                targetX = head.x;
                targetY = head.y;
            }
        }

        const dx = targetX - head.x;
        const dy = targetY - head.y;
        const distToTarget = Math.hypot(dx, dy);

        if (!this.isMobile && distToTarget < (50 * this.scale) && distToTarget > 0) {
            const force = (50 * this.scale - distToTarget) * 0.2;
            this.vx -= (dx / distToTarget) * force;
            this.vy -= (dy / distToTarget) * force;
        } else if (distToTarget > (this.isMobile ? (joystick.active ? 10 : 0) : this.bufferDist)) {
            const actualTargetX = targetX - (dx / (distToTarget || 1)) * (this.isMobile ? 0 : this.bufferDist);
            const actualTargetY = targetY - (dy / (distToTarget || 1)) * (this.isMobile ? 0 : this.bufferDist);

            const tdx = actualTargetX - head.x;
            const tdy = actualTargetY - head.y;
            const tdist = Math.hypot(tdx, tdy);

            this.vx += (tdx / (tdist || 1)) * this.acceleration * tdist * 0.1;
            this.vy += (tdy / (tdist || 1)) * this.acceleration * tdist * 0.1;
        }

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        this.vx *= this.friction;
        this.vy *= this.friction;

        head.x += this.vx;
        head.y += this.vy;

        const headDist = Math.hypot(head.x - oldX, head.y - oldY);
        distanceWalked += headDist;

        for (let i = 1; i < this.length; i++) {
            const prev = this.segments[i - 1];
            const curr = this.segments[i];

            let targetDist = this.segmentDist;
            if (this.isAttacking && i > this.length - 10) {
                targetDist = this.segmentDist * (1 + Math.sin(this.attackTimer * 0.5) * 0.5);
            }

            const segDx = curr.x - prev.x;
            const segDy = curr.y - prev.y;
            const segDist = Math.hypot(segDx, segDy);
            const angle = Math.atan2(segDy, segDx);
            curr.angle = angle;

            curr.x = prev.x + (segDx / (segDist || 1)) * targetDist;
            curr.y = prev.y + (segDy / (segDist || 1)) * targetDist;
        }

        if (this.isBreathingFire) {
            this.fireTimer--;
            if (this.fireTimer <= 0) this.isBreathingFire = false;
            const headAngle = Math.atan2(head.y - this.segments[1].y, head.x - this.segments[1].x);
            for (let i = 0; i < (this.isMobile ? 3 : 5); i++) {
                particles.push(new Particle(head.x + Math.cos(headAngle) * (20 * this.scale), head.y + Math.sin(headAngle) * (20 * this.scale), headAngle, 5 + Math.random() * 5, 20 + Math.random() * 10, this.scale));
            }
        }

        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.isAttacking = false;
        }
    }

    draw() {
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 5) {
            ctx.save();
            ctx.translate(Math.random() * 4 - 2, Math.random() * 4 - 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            this.renderSkeleton();
            ctx.restore();
        }

        ctx.strokeStyle = 'white';
        this.renderSkeleton();

        if (this.isMobile && joystick.active) this.drawJoystick();
    }

    renderSkeleton() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pulse = (Math.sin(time * 3) + 1) / 2;
        ctx.shadowBlur = (10 + pulse * 10) * this.scale;
        ctx.shadowColor = '#4facfe';

        ctx.beginPath();
        ctx.lineWidth = 3 * this.scale;
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.length; i++) {
            ctx.lineTo(this.segments[i].x, this.segments[i].y);
        }
        ctx.stroke();

        for (let i = 3; i < this.length - 2; i += 2) {
            this.drawSpineSpike(this.segments[i]);
        }

        for (let i = 2; i < this.length - 10; i++) {
            const seg = this.segments[i];
            const size = Math.sin((i / this.length) * Math.PI) * this.ribWidth;
            const nX = Math.cos(seg.angle + Math.PI / 2);
            const nY = Math.sin(seg.angle + Math.PI / 2);

            ctx.beginPath();
            ctx.lineWidth = 1.2 * this.scale;
            ctx.moveTo(seg.x + nX * size, seg.y + nY * size);
            ctx.quadraticCurveTo(seg.x + Math.cos(seg.angle) * (10 * this.scale), seg.y + Math.sin(seg.angle) * (10 * this.scale), seg.x - nX * size, seg.y - nY * size);
            ctx.stroke();

            if (i === 2) this.drawDetailedSkull(seg);
        }

        const legSpacing = Math.floor((this.length - 15) / (this.legCount / 2));
        for (let i = 1; i <= this.legCount / 2; i++) {
            const index = i * legSpacing + 5;
            if (index < this.length - 5) {
                this.drawLegPair(this.segments[index], i);
            }
        }

        this.drawTail(this.segments[this.length - 1]);
        ctx.shadowBlur = 0;
    }

    drawDetailedSkull(seg) {
        ctx.save();
        ctx.translate(seg.x, seg.y);
        const headAngle = Math.atan2(seg.y - this.segments[1].y, seg.x - this.segments[1].x);
        ctx.rotate(headAngle);

        ctx.lineWidth = 2 * this.scale;
        ctx.beginPath();
        ctx.moveTo(25 * this.scale, 0);
        ctx.bezierCurveTo(10 * this.scale, -15 * this.scale, -15 * this.scale, -15 * this.scale, -20 * this.scale, -5 * this.scale);
        ctx.lineTo(-20 * this.scale, 5 * this.scale);
        ctx.bezierCurveTo(-15 * this.scale, 15 * this.scale, 10 * this.scale, 15 * this.scale, 25 * this.scale, 0);
        ctx.stroke();

        if (this.isBreathingFire) {
            ctx.beginPath();
            ctx.moveTo(20 * this.scale, -5 * this.scale);
            ctx.lineTo(30 * this.scale, -12 * this.scale);
            ctx.moveTo(20 * this.scale, 5 * this.scale);
            ctx.lineTo(30 * this.scale, 12 * this.scale);
            ctx.stroke();
        }

        [-1, 1].forEach(side => {
            ctx.beginPath();
            ctx.moveTo(-10 * this.scale, 8 * side * this.scale);
            ctx.quadraticCurveTo(-25 * this.scale, 25 * side * this.scale, -40 * this.scale, 15 * side * this.scale);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(15 * this.scale, 5 * side * this.scale);
            ctx.lineTo(25 * this.scale, 12 * side * this.scale);
            ctx.lineTo(15 * this.scale, 10 * side * this.scale);
            ctx.stroke();
        });

        const eyePulse = (Math.sin(time * 10) + 1) / 2;
        ctx.fillStyle = `rgba(255, 77, 77, ${0.5 + eyePulse * 0.5})`;
        ctx.shadowBlur = 10 * this.scale;
        ctx.shadowColor = '#ff0000ff';
        ctx.beginPath();
        ctx.arc(0, -6 * this.scale, 3 * this.scale, 0, Math.PI * 2);
        ctx.arc(0, 6 * this.scale, 3 * this.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawSpineSpike(seg) {
        const size = 12 * this.scale;
        const angle = seg.angle + Math.PI;
        ctx.beginPath();
        ctx.lineWidth = 1.5 * this.scale;
        ctx.moveTo(seg.x, seg.y);
        ctx.lineTo(seg.x + Math.cos(angle + 0.3) * size, seg.y + Math.sin(angle + 0.3) * size);
        ctx.moveTo(seg.x, seg.y);
        ctx.lineTo(seg.x + Math.cos(angle - 0.3) * size, seg.y + Math.sin(angle - 0.3) * size);
        ctx.stroke();
    }

    drawLegPair(seg, pairIndex) {
        const legSize = 40 * this.scale;
        const cycle = distanceWalked * 0.05 + (pairIndex * Math.PI / 2);

        [-1, 1].forEach(side => {
            const sideCycle = cycle + (side === 1 ? Math.PI : 0);
            const lift = Math.max(0, Math.sin(sideCycle)) * (12 * this.scale);
            const swing = Math.cos(sideCycle) * (18 * this.scale);

            const angle = seg.angle + (Math.PI / 2) * side;

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, 4 * this.scale, 0, Math.PI * 2);
            ctx.stroke();

            const jointX = seg.x + Math.cos(angle) * (legSize * 0.7) + Math.cos(seg.angle) * swing;
            const jointY = seg.y + Math.sin(angle) * (legSize * 0.7) + Math.sin(seg.angle) * swing - lift;

            const footX = jointX + Math.cos(angle + 0.4 * side) * (legSize * 0.5);
            const footY = jointY + Math.sin(angle + 0.4 * side) * (legSize * 0.5);

            ctx.beginPath();
            ctx.lineWidth = 2.5 * this.scale;
            ctx.moveTo(seg.x, seg.y);
            ctx.lineTo(jointX, jointY);
            ctx.lineTo(footX, footY);
            ctx.stroke();

            this.drawClaw(footX, footY, angle);
        });
    }

    drawClaw(x, y, angle) {
        ctx.beginPath();
        ctx.lineWidth = 1 * this.scale;
        for (let i = -1; i <= 1; i++) {
            const clawAngle = angle + (i * 0.5);
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(clawAngle) * (10 * this.scale), y + Math.sin(clawAngle) * (10 * this.scale));
        }
        ctx.stroke();
    }

    drawTail(seg) {
        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(seg.angle);
        ctx.beginPath();
        ctx.lineWidth = 2 * this.scale;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-10 * this.scale, -20 * this.scale, -30 * this.scale, -10 * this.scale, -40 * this.scale, 0);
        ctx.bezierCurveTo(-30 * this.scale, 10 * this.scale, -10 * this.scale, 20 * this.scale, 0, 0);
        ctx.stroke();
        ctx.restore();
    }

    triggerFire() {
        this.isBreathingFire = true;
        this.fireTimer = 100;
    }

    triggerTailAttack() {
        this.isAttacking = true;
        this.attackTimer = 40;
    }

    drawJoystick() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4facfe';

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(joystick.startX, joystick.startY, joystick.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(79, 172, 254, 0.5)';
        ctx.beginPath();
        ctx.arc(joystick.currX, joystick.currY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.restore();
    }
}

function init() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    resize();
    dragon = new SkeletonDragon();
    food = new Food();

    for (let i = 0; i < 150; i++) bgParticles.push(new BackgroundParticle());

    window.addEventListener('resize', () => {
        resize();
        dragon = new SkeletonDragon();
        food.spawn();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isMobile) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }
    });

    window.addEventListener('dblclick', (e) => {
        if (!isMobile) dragon.triggerFire();
    });

    window.addEventListener('contextmenu', (e) => {
        if (!isMobile) {
            e.preventDefault();
            dragon.triggerTailAttack();
        }
    });

    window.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        joystick.active = true;
        joystick.startX = joystick.currX = t.clientX;
        joystick.startY = joystick.currY = t.clientY;

        if (t.clientX > width - 80 && t.clientY < 80) dragon.triggerFire();
        if (t.clientX < 80 && t.clientY < 80) dragon.triggerTailAttack();
    });

    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - joystick.startX;
        const dy = t.clientY - joystick.startY;
        const dist = Math.hypot(dx, dy);

        if (dist > joystick.radius) {
            joystick.currX = joystick.startX + (dx / dist) * joystick.radius;
            joystick.currY = joystick.startY + (dy / dist) * joystick.radius;
        } else {
            joystick.currX = t.clientX;
            joystick.currY = t.clientY;
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        joystick.active = false;
    });

    animate();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    mouse.x = width / 2;
    mouse.y = height / 2;
}

function animate() {
    ctx.fillStyle = 'rgba(22, 22, 22, 0.4)'; // Updated background color
    ctx.fillRect(0, 0, width, height);

    time += 0.01;

    bgParticles.forEach(p => {
        p.update(dragon.vx, dragon.vy);
        p.draw();
    });

    food.draw();
    food.update();

    dragon.update();
    dragon.draw();

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(animate);
}

init();
