import * as PIXI from "pixi.js"
import {
    Application,
    Assets,
    Container,
    Graphics,
    Sprite,
    Texture,
} from "pixi.js"

// ======= Types et Constantes =======
type SegmentColor = {
    road: number
    grass: number
    rumble: number
    lane?: number
}
type Point3D = {
    world: { x: number; y: number; z: number }
    camera: { x: number; y: number; z: number }
    screen: { x: number; y: number; w: number; scale: number }
}
type Segment = {
    index: number
    p1: Point3D
    p2: Point3D
    color: SegmentColor
    looped?: boolean
    curve?: number
    cars?: Car[]
    clip?: number
}

type Car = {
    z: number // position le long de la route (en z)
    offset: number // de -1 à 1 sur la largeur de la route
    speed: number // vitesse de la voiture
    sprite: Sprite // sprite du véhicule
    percent?: number // % d'avancement sur le segment (pour l'interpolation de rendu)
}

// ======= Couleurs / Settings =======
const COLORS = {
    LIGHT: {
        road: 0x6b6b6b,
        grass: 0x10aa10,
        rumble: 0x555555,
        lane: 0xcccccc,
    },
    DARK: { road: 0x696969, grass: 0x009a00, rumble: 0xbbbbbb },
    START: { road: 0xffffff, grass: 0xffffff, rumble: 0xffffff },
    FINISH: { road: 0x000000, grass: 0x000000, rumble: 0x000000 },
    SKY: 0x87ceeb,
}

const DEFAULTS = {
    width: window.innerWidth,
    height: window.innerHeight,
    lanes: 3,
    roadWidth: 2000,
    segmentLength: 200,
    rumbleLength: 3,
    cameraHeight: 1000,
    drawDistance: 750,
    fieldOfView: 100,
    fps: 60,
}

// ======= Maths utils =======
function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(val, max))
}

function accelerate(v: number, accel: number, dt: number) {
    return v + accel * dt
}

function increase(start: number, increment: number, max: number) {
    let result = start + increment
    while (result >= max) result -= max
    while (result < 0) result += max
    return result
}

function project(
    p: Point3D,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number
) {
    p.camera.x = p.world.x - cameraX
    p.camera.y = p.world.y - cameraY
    p.camera.z = p.world.z - cameraZ
    p.screen.scale = cameraDepth / (p.camera.z || 1)
    p.screen.x = Math.round(
        width / 2 + (p.screen.scale * p.camera.x * width) / 2
    )
    p.screen.y = Math.round(
        height / 2 - (p.screen.scale * p.camera.y * height) / 2
    )
    p.screen.w = Math.round((p.screen.scale * roadWidth * width) / 2)
}

// ======= ENGINE =======
export class GameEngine {
    private app: PIXI.Application | null = null
    private graphics: PIXI.Graphics | null = null
    private container: HTMLElement | null = null
    private root: PIXI.Container | null = null
    // State
    private width: number = DEFAULTS.width
    private height: number = DEFAULTS.height
    private lanes: number = DEFAULTS.lanes
    private roadWidth: number = DEFAULTS.roadWidth
    private segmentLength: number = DEFAULTS.segmentLength
    private rumbleLength: number = DEFAULTS.rumbleLength
    private cameraHeight: number = DEFAULTS.cameraHeight
    private drawDistance: number = DEFAULTS.drawDistance
    private fieldOfView: number = DEFAULTS.fieldOfView
    private fps: number = DEFAULTS.fps

    // Calculé
    private segments: Segment[] = []
    private trackLength: number = 0
    private cameraDepth: number = 0
    private playerZ: number = 0
    private maxSpeed: number = 0
    private accel: number = 0
    private breaking: number = 0
    private decel: number = 0
    private offRoadDecel: number = 0
    private offRoadLimit: number = 0

    // Propriétés pour les voitures
    private cars: Car[] = []
    private readonly totalCars: number = 10
    private readonly carDimensions = {
        width: 150,
        height: 150,
    }

    // Joueur/Jeu
    private position: number = 0
    private speed: number = 200 // Démarrage lent pour voir la route !
    private playerX: number = 0
    private backgroundSprite: Sprite | null = null
    private bgPosition: number = 0
    private playerSprite: Sprite | null = null
    private playerTilt: number = 0

    private backgroundTexture: Texture | null = null
    private playerTexture: Texture | null = null

    private playerWidth = 250
    private playerHeight = 250

    // Contrôles
    private keyLeft: boolean = false
    private keyRight: boolean = false
    private keyFaster: boolean = false
    private keySlower: boolean = false

    // Loop
    private rafId: number = 0
    private lastTs: number = 0

    // Hills support - fonction lastY pour maintenir la continuité
    private lastY(): number {
        return this.segments.length === 0
            ? 0
            : this.segments[this.segments.length - 1].p2.world.y
    }

    // Curves et Hills
    private addSegment(curve: number = 0, y?: number) {
        const n = this.segments.length
        const segmentY = y !== undefined ? y : this.lastY()

        this.segments.push({
            index: n,
            p1: {
                world: { x: 0, y: this.lastY(), z: n * this.segmentLength },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0, scale: 0 },
            },
            p2: {
                world: { x: 0, y: segmentY, z: (n + 1) * this.segmentLength },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0, scale: 0 },
            },
            color: {
                road: COLORS.LIGHT.road,
                grass: COLORS.LIGHT.grass,
                rumble: 0x5c3c24,
                lane: 0xffffff,
            },
            curve,
        })
    }

    private addRoad(
        enter: number,
        hold: number,
        leave: number,
        curve: number,
        y: number = 0
    ) {
        const startY = this.lastY()
        const endY = startY + y * this.segmentLength
        const total = enter + hold + leave

        for (let n = 0; n < enter; n++)
            this.addSegment(
                this.easeIn(0, curve, n / enter),
                this.easeInOut(startY, endY, n / total)
            )
        for (let n = 0; n < hold; n++)
            this.addSegment(
                curve,
                this.easeInOut(startY, endY, (enter + n) / total)
            )
        for (let n = 0; n < leave; n++)
            this.addSegment(
                this.easeInOut(curve, 0, n / leave),
                this.easeInOut(startY, endY, (enter + hold + n) / total)
            )
    }

    // Easing helpers
    private easeIn(a: number, b: number, percent: number) {
        return this.interpolate(a, b, Math.pow(percent, 2))
    }

    private easeInOut(a: number, b: number, percent: number) {
        return this.interpolate(a, b, -Math.cos(percent * Math.PI) / 2 + 0.5)
    }

    private interpolate(a: number, b: number, percent: number): number {
        return a + (b - a) * percent
    }

    // Préréglages façon Jake
    private ROAD = {
        LENGTH: { NONE: 0, SHORT: 80, MEDIUM: 180, LONG: 320 },
        CURVE: { NONE: 0, EASY: 0.6, MEDIUM: 1.2, HARD: 2 },
        HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
    }

    private curveFactor = 0.3

    private addStraight(num = this.ROAD.LENGTH.MEDIUM) {
        this.addRoad(num, num, num, 0, 0)
    }

    private addHill(
        num = this.ROAD.LENGTH.MEDIUM,
        height = this.ROAD.HILL.MEDIUM
    ) {
        this.addRoad(num, num, num, 0, height)
    }

    private addCurve(
        num = this.ROAD.LENGTH.MEDIUM,
        curve = this.ROAD.CURVE.MEDIUM,
        height = this.ROAD.HILL.NONE
    ) {
        this.addRoad(num, num, num, curve, height)
    }

    private addLowRollingHills(
        num = this.ROAD.LENGTH.SHORT,
        height = this.ROAD.HILL.LOW
    ) {
        this.addRoad(num, num, num, 0, height / 2)
        this.addRoad(num, num, num, 0, -height)
        this.addRoad(num, num, num, 0, height)
        this.addRoad(num, num, num, 0, 0)
        this.addRoad(num, num, num, 0, height / 2)
        this.addRoad(num, num, num, 0, 0)
    }

    private addSCurves() {
        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            -this.ROAD.CURVE.EASY,
            this.ROAD.HILL.NONE
        )
        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            this.ROAD.CURVE.MEDIUM,
            this.ROAD.HILL.MEDIUM
        )
        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            this.ROAD.CURVE.EASY,
            -this.ROAD.HILL.LOW
        )
        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            -this.ROAD.CURVE.EASY,
            this.ROAD.HILL.MEDIUM
        )
        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            -this.ROAD.CURVE.MEDIUM,
            -this.ROAD.HILL.MEDIUM
        )
    }

    private addDownhillToEnd(num = 200) {
        this.addRoad(
            num,
            num,
            num,
            -this.ROAD.CURVE.EASY,
            -this.lastY() / this.segmentLength
        )
    }

    constructor() {}

    // ========== Initialisation ==========
    public async init(container: HTMLElement) {
        this.container = container

        // Créer l'Application avec la nouvelle syntaxe PIXI v8
        this.app = new Application()

        await this.app.init({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x87ceeb,
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        })

        // Mount Pixi canvas - utiliser la nouvelle propriété canvas
        container.innerHTML = ""
        container.appendChild(this.app.canvas)

        // Load textures avec gestion d'erreur
        try {
            this.backgroundTexture = await Assets.load(
                "src/assets/background.png"
            )
        } catch (error) {
            this.backgroundTexture = null
        }

        try {
            this.playerTexture = await Assets.load("src/assets/player.png")
        } catch (error) {
            this.playerTexture = null
        }

        // Sprites and graphics
        this.root = new Container()
        this.app.stage.addChild(this.root)

        // Background en premier pour qu'il soit derrière tout le reste
        if (this.backgroundTexture) {
            this.backgroundSprite = new Sprite(this.backgroundTexture)
            this.backgroundSprite.width = this.width
            this.backgroundSprite.height = this.height * 0.8
            this.backgroundSprite.x = 0
            this.backgroundSprite.y = 0
            this.root.addChild(this.backgroundSprite)
        }

        // Route, décor, HUD...
        this.graphics = new Graphics()
        this.root.addChild(this.graphics)

        // Player
        if (this.playerTexture) {
            this.playerSprite = new Sprite(this.playerTexture)
            this.playerSprite.width = this.playerWidth
            this.playerSprite.height = this.playerHeight
            this.playerSprite.anchor.set(0.5)
            this.root.addChild(this.playerSprite)
        } else {
            // Créer un sprite de fallback si la texture n'a pas pu être chargée
            const fallbackGraphics = new Graphics()
            fallbackGraphics.rect(
                -this.playerWidth / 2,
                -this.playerHeight / 2,
                this.playerWidth,
                this.playerHeight
            )
            fallbackGraphics.fill({ color: 0xff0000 }) // Rouge pour le joueur

            const fallbackTexture =
                this.app.renderer.generateTexture(fallbackGraphics)
            this.playerSprite = new Sprite(fallbackTexture)
            this.playerSprite.anchor.set(0.5)
            this.root.addChild(this.playerSprite)
        }

        // Player sprite (centré)
        if (this.playerSprite) {
            this.playerSprite.x = this.width / 2
            this.playerSprite.y = this.playerZ + this.playerHeight / 2
            this.playerSprite.rotation = 0
        }

        await this.reset()

        window.addEventListener("keydown", this.handleKeyDown)
        window.addEventListener("keyup", this.handleKeyUp)
        window.addEventListener("resize", this.handleResize)

        this.rafId = requestAnimationFrame(this.gameLoop)
    }

    public destroy() {
        window.removeEventListener("keydown", this.handleKeyDown)
        window.removeEventListener("keyup", this.handleKeyUp)
        window.removeEventListener("resize", this.handleResize)

        // Nettoyage des voitures
        for (const car of this.cars) {
            if (car.sprite.parent) {
                car.sprite.parent.removeChild(car.sprite)
            }
            car.sprite.destroy()
        }
        this.cars = []

        if (this.app && this.app.renderer) {
            try {
                this.app.destroy(true, {
                    children: true,
                    texture: true,
                })
            } catch (error) {}
            this.app = null
        }
    }

    private handleResize = () => {
        if (!this.app) return

        this.width = window.innerWidth
        this.height = window.innerHeight
        this.app.renderer.resize(this.width, this.height)
    }

    // ========== Road/State Génération ==========
    private async reset() {
        this.segments = []
        this.cars = []

        // Circuit avec collines inspiré de Jake Gordon
        this.addStraight(this.ROAD.LENGTH.SHORT / 2)
        this.addHill(this.ROAD.LENGTH.SHORT, this.ROAD.HILL.LOW)
        this.addLowRollingHills()

        this.addCurve(
            this.ROAD.LENGTH.MEDIUM,
            this.ROAD.CURVE.MEDIUM,
            this.ROAD.HILL.LOW
        )
        this.addLowRollingHills()
        this.addCurve(
            this.ROAD.LENGTH.LONG,
            this.ROAD.CURVE.MEDIUM,
            this.ROAD.HILL.MEDIUM
        )
        this.addStraight()
        this.addCurve(
            this.ROAD.LENGTH.LONG,
            -this.ROAD.CURVE.MEDIUM,
            this.ROAD.HILL.MEDIUM
        )
        this.addHill(this.ROAD.LENGTH.LONG, this.ROAD.HILL.HIGH)
        this.addCurve(
            this.ROAD.LENGTH.LONG,
            this.ROAD.CURVE.MEDIUM,
            -this.ROAD.HILL.LOW
        )
        this.addHill(this.ROAD.LENGTH.LONG, -this.ROAD.HILL.MEDIUM)
        this.addStraight()
        this.addDownhillToEnd()

        // START/FINISH colors etc (comme avant)
        this.segments[this.findSegment(this.playerZ).index + 2].color =
            COLORS.START
        this.segments[this.findSegment(this.playerZ).index + 3].color =
            COLORS.START
        for (let n = 0; n < this.rumbleLength; n++)
            this.segments[this.segments.length - 1 - n].color = COLORS.FINISH

        this.trackLength = this.segments.length * this.segmentLength
        this.cameraDepth =
            1 / Math.tan(((this.fieldOfView / 2) * Math.PI) / 180)
        this.playerZ = this.cameraHeight * this.cameraDepth
        this.maxSpeed = (this.segmentLength / (1 / this.fps)) * 5
        this.accel = this.maxSpeed / 5
        this.breaking = -this.maxSpeed
        this.decel = -this.maxSpeed / 5
        this.offRoadDecel = -this.maxSpeed / 2
        this.offRoadLimit = this.maxSpeed / 4

        this.position = 0
        this.speed = 200
        this.playerX = 0

        await this.resetCars()
    }

    private findSegment(z: number): Segment {
        return this.segments[
            Math.floor(z / this.segmentLength) % this.segments.length
        ]
    }

    // ========== GAME LOOP ==========
    private gameLoop = (ts: number) => {
        const dt = Math.min(1, (ts - this.lastTs) / 1000) || 0.016
        this.update(dt)
        this.render()
        this.lastTs = ts
        this.rafId = requestAnimationFrame(this.gameLoop)
    }

    // ========== LOGIQUE ==========
    private updateCars(dt: number) {
        for (const car of this.cars) {
            const oldSegment = this.findSegment(car.z)

            // Mise à jour de la position Z
            car.z = increase(car.z, dt * car.speed, this.trackLength)
            car.percent = (car.z % this.segmentLength) / this.segmentLength

            // Déplacement vers le nouveau segment si nécessaire
            const newSegment = this.findSegment(car.z)
            if (oldSegment !== newSegment) {
                const index = oldSegment.cars?.indexOf(car)
                if (index !== undefined && index > -1) {
                    oldSegment.cars?.splice(index, 1)
                }
                newSegment.cars = newSegment.cars || []
                newSegment.cars.push(car)
            }
        }
    }

    private update(dt: number) {
        // Mise à jour des voitures
        this.updateCars(dt)

        this.position = increase(
            this.position,
            dt * this.speed,
            this.trackLength
        )
        const dx = dt * 2 * (this.speed / this.maxSpeed)

        const playerSegment = this.findSegment(this.position + this.playerZ)
        const speedPercent = this.speed / this.maxSpeed

        // Nouvelles courbes dynamiques !
        const centrifugal = 1

        if (this.keyLeft) this.playerX -= dx
        else if (this.keyRight) this.playerX += dx

        // Effet centrifuge : la courbe te pousse vers l’extérieur
        if (playerSegment.curve)
            this.playerX -=
                dx * speedPercent * playerSegment.curve * centrifugal

        if (this.keyFaster) this.speed = accelerate(this.speed, this.accel, dt)
        else if (this.keySlower)
            this.speed = accelerate(this.speed, this.breaking, dt)
        else this.speed = accelerate(this.speed, this.decel, dt)

        if (
            (this.playerX < -1 || this.playerX > 1) &&
            this.speed > this.offRoadLimit
        )
            this.speed = accelerate(this.speed, this.offRoadDecel, dt)

        this.playerX = clamp(this.playerX, -2, 2)
        this.speed = clamp(this.speed, 0, this.maxSpeed)

        // Parallax background movement
        const playerInfluence = 0.005 // ajuste ce facteur pour l'effet "Outrun"
        const curveInfluence = 0.01 // ajuste ce facteur pour la force du virage sur le décor

        const playerMove = this.playerX * playerInfluence
        const currentSegment = this.findSegment(this.position)
        const currentCurve = currentSegment.curve || 0

        // Vitesse de défilement du bg : le virage principal + déplacement joueur
        this.bgPosition +=
            (currentCurve * curveInfluence + playerMove) *
            this.speed *
            dt *
            0.08
    }

    // ========== RENDER ==========
    private render() {
        if (!this.graphics) return
        const g = this.graphics
        g.clear()

        const horizonY = this.height / 2

        // Fond : ciel puis herbe
        if (!this.backgroundSprite) {
            g.fill(COLORS.SKY)
            g.rect(0, 0, this.width, horizonY)
            g.endFill()
        }

        // Herbe, uniquement sous l’horizon
        g.fill(COLORS.LIGHT.grass)
        g.rect(0, horizonY, this.width, this.height - horizonY)
        g.endFill()

        let baseSegment = this.findSegment(this.position)
        let basePercent =
            (this.position % this.segmentLength) / this.segmentLength
        let playerSegment = this.findSegment(this.position + this.playerZ)
        let playerPercent =
            ((this.position + this.playerZ) % this.segmentLength) /
            this.segmentLength

        // Calcul de la position Y du joueur pour les collines
        let playerY = this.interpolate(
            playerSegment.p1.world.y,
            playerSegment.p2.world.y,
            playerPercent
        )

        // Mise à jour du background avec parallax vertical
        if (this.backgroundSprite) {
            this.backgroundSprite.y = -playerY * 0.001 // facteur ajustable pour l'effet vertical
        }

        // Trouver le point le plus haut de la route visible
        let farthestY = horizonY
        let tempX = 0
        let tempDx =
            -((baseSegment.curve || 0) * basePercent) * this.curveFactor

        /** RENDU DE LA ROUTE */
        for (let n = 0; n < this.drawDistance; n++) {
            let segment =
                this.segments[(baseSegment.index + n) % this.segments.length]

            // Projeter le segment pour voir sa hauteur à l'écran
            project(
                segment.p1,
                this.playerX * this.roadWidth - tempX,
                playerY + this.cameraHeight,
                this.position - (segment.looped ? this.trackLength : 0),
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )

            // Garder le point le plus haut trouvé
            if (segment.p1.camera.z > this.cameraDepth) {
                farthestY = Math.min(farthestY, segment.p1.screen.y)
            }

            tempX += tempDx
            tempDx += (segment.curve || 0) * this.curveFactor
        }

        // Dessiner l'herbe jusqu'à la hauteur exacte de la route
        g.fill(COLORS.LIGHT.grass)
        g.rect(0, farthestY, this.width, this.height - farthestY)
        g.endFill()

        // Initialiser pour le rendu de la route
        let maxy = this.height
        let x = 0
        let dx = -((baseSegment.curve || 0) * basePercent) * this.curveFactor

        /** RENDU DES SEGMENTS */
        for (let n = 0; n < this.drawDistance; n++) {
            let segment =
                this.segments[(baseSegment.index + n) % this.segments.length]
            segment.looped = segment.index < baseSegment.index

            project(
                segment.p1,
                this.playerX * this.roadWidth - x,
                playerY + this.cameraHeight,
                this.position - (segment.looped ? this.trackLength : 0),
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )
            project(
                segment.p2,
                this.playerX * this.roadWidth - x - dx,
                playerY + this.cameraHeight,
                this.position - (segment.looped ? this.trackLength : 0),
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )

            x += dx
            dx += (segment.curve || 0) * this.curveFactor

            if (
                segment.p1.camera.z <= this.cameraDepth ||
                segment.p2.screen.y >= maxy
            )
                continue

            // Rumble strips
            const r1 = segment.p1.screen.w / Math.max(6, 2 * this.lanes)
            const r2 = segment.p2.screen.w / Math.max(6, 2 * this.lanes)

            // ---- Flou/terre autour de la bordure marron (externe) ----
            const earthShadowColor = 0x85603c // un marron plus clair
            g.fill(earthShadowColor, 0.33) // alpha faible pour effet flou
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w - r1 * 1.7,
                segment.p1.screen.y,
                segment.p1.screen.x - segment.p1.screen.w + r1 * 0.25,
                segment.p1.screen.y,
                segment.p2.screen.x - segment.p2.screen.w + r2 * 0.25,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w - r2 * 1.7,
                segment.p2.screen.y
            )
            g.endFill()
            g.fill(earthShadowColor, 0.33)
            this.polygon(
                g,
                segment.p1.screen.x + segment.p1.screen.w + r1 * 1.7,
                segment.p1.screen.y,
                segment.p1.screen.x + segment.p1.screen.w - r1 * 0.25,
                segment.p1.screen.y,
                segment.p2.screen.x + segment.p2.screen.w - r2 * 0.25,
                segment.p2.screen.y,
                segment.p2.screen.x + segment.p2.screen.w + r2 * 1.7,
                segment.p2.screen.y
            )
            g.endFill()

            // --- MARRON (bordure extérieure) ---
            g.fill(segment.color.rumble)
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w - r1,
                segment.p1.screen.y,
                segment.p1.screen.x - segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p2.screen.x - segment.p2.screen.w,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w - r2,
                segment.p2.screen.y
            )
            g.endFill()
            g.fill(segment.color.rumble)
            this.polygon(
                g,
                segment.p1.screen.x + segment.p1.screen.w + r1,
                segment.p1.screen.y,
                segment.p1.screen.x + segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p2.screen.x + segment.p2.screen.w,
                segment.p2.screen.y,
                segment.p2.screen.x + segment.p2.screen.w + r2,
                segment.p2.screen.y
            )
            g.endFill()

            // --- DORÉE (bordure fine à l'intérieur du marron) ---
            const goldWidth1 = r1 * 0.35
            const goldWidth2 = r2 * 0.35

            // ---- Lueur diffuse dorée (optionnel) ----
            g.fill(0xb89d70, 0.18)
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w - goldWidth1 * 0.6,
                segment.p1.screen.y,
                segment.p1.screen.x - segment.p1.screen.w + goldWidth1 * 1.5,
                segment.p1.screen.y,
                segment.p2.screen.x - segment.p2.screen.w + goldWidth2 * 1.5,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w - goldWidth2 * 0.6,
                segment.p2.screen.y
            )
            g.endFill()
            g.fill(0xb89d70, 0.18)
            this.polygon(
                g,
                segment.p1.screen.x + segment.p1.screen.w + goldWidth1 * 0.6,
                segment.p1.screen.y,
                segment.p1.screen.x + segment.p1.screen.w - goldWidth1 * 1.5,
                segment.p1.screen.y,
                segment.p2.screen.x + segment.p2.screen.w - goldWidth2 * 1.5,
                segment.p2.screen.y,
                segment.p2.screen.x + segment.p2.screen.w + goldWidth2 * 0.6,
                segment.p2.screen.y
            )
            g.endFill()

            g.fill(0xb89d70)
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p1.screen.x - segment.p1.screen.w + goldWidth1,
                segment.p1.screen.y,
                segment.p2.screen.x - segment.p2.screen.w + goldWidth2,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.endFill()
            g.fill(0xb89d70)
            this.polygon(
                g,
                segment.p1.screen.x + segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p1.screen.x + segment.p1.screen.w - goldWidth1,
                segment.p1.screen.y,
                segment.p2.screen.x + segment.p2.screen.w - goldWidth2,
                segment.p2.screen.y,
                segment.p2.screen.x + segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.endFill()

            // --- BLANCHE (encore plus fine, à l'intérieur du doré) ---
            const whiteWidth1 = goldWidth1 * 0.4
            const whiteWidth2 = goldWidth2 * 0.4
            g.fill(0xffffff)
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w + goldWidth1,
                segment.p1.screen.y,
                segment.p1.screen.x -
                    segment.p1.screen.w +
                    goldWidth1 +
                    whiteWidth1,
                segment.p1.screen.y,
                segment.p2.screen.x -
                    segment.p2.screen.w +
                    goldWidth2 +
                    whiteWidth2,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w + goldWidth2,
                segment.p2.screen.y
            )
            g.endFill()
            g.fill(0xffffff)
            this.polygon(
                g,
                segment.p1.screen.x + segment.p1.screen.w - goldWidth1,
                segment.p1.screen.y,
                segment.p1.screen.x +
                    segment.p1.screen.w -
                    goldWidth1 -
                    whiteWidth1,
                segment.p1.screen.y,
                segment.p2.screen.x +
                    segment.p2.screen.w -
                    goldWidth2 -
                    whiteWidth2,
                segment.p2.screen.y,
                segment.p2.screen.x + segment.p2.screen.w - goldWidth2,
                segment.p2.screen.y
            )
            g.endFill()

            // Road (trapèze)
            g.fill(segment.color.road)
            this.polygon(
                g,
                segment.p1.screen.x -
                    segment.p1.screen.w +
                    goldWidth1 +
                    whiteWidth1,
                segment.p1.screen.y,
                segment.p1.screen.x +
                    segment.p1.screen.w -
                    goldWidth1 -
                    whiteWidth1,
                segment.p1.screen.y,
                segment.p2.screen.x +
                    segment.p2.screen.w -
                    goldWidth2 -
                    whiteWidth2,
                segment.p2.screen.y,
                segment.p2.screen.x -
                    segment.p2.screen.w +
                    goldWidth2 +
                    whiteWidth2,
                segment.p2.screen.y
            )
            g.endFill()

            // Lane markers
            if (segment.color.lane) {
                const lanew1 = (segment.p1.screen.w * 2) / this.lanes
                const lanew2 = (segment.p2.screen.w * 2) / this.lanes
                const l1 = segment.p1.screen.w / Math.max(32, 8 * this.lanes)
                const l2 = segment.p2.screen.w / Math.max(32, 8 * this.lanes)
                let lanex1 = segment.p1.screen.x - segment.p1.screen.w + lanew1
                let lanex2 = segment.p2.screen.x - segment.p2.screen.w + lanew2

                for (
                    let lane = 1;
                    lane < this.lanes;
                    lanex1 += lanew1, lanex2 += lanew2, lane++
                ) {
                    // Pointillés blancs
                    if (segment.index % 50 < 10) {
                        g.fill(segment.color.lane)
                        g.moveTo(lanex1 - l1 / 2, segment.p1.screen.y)
                        g.lineTo(lanex1 + l1 / 2, segment.p1.screen.y)
                        g.lineTo(lanex2 + l2 / 2, segment.p2.screen.y)
                        g.lineTo(lanex2 - l2 / 2, segment.p2.screen.y)
                        g.closePath()
                        g.endFill()
                    }

                    // Lignes foncées au milieu des voies avec effet de flou
                    const lanePositions = [
                        { x1: lanex1 - lanew1 / 2, x2: lanex2 - lanew2 / 2 }, // Première voie
                        { x1: lanex1 + lanew1 / 2, x2: lanex2 + lanew2 / 2 }, // Deuxième voie
                        {
                            x1: lanex1 + lanew1 * 1.5,
                            x2: lanex2 + lanew2 * 1.5,
                        }, // Troisième voie
                    ]

                    // Pour chaque voie
                    lanePositions.forEach((pos) => {
                        // 5 couches de flou
                        for (let i = 0; i < 5; i++) {
                            const width1 = l1 * (4 - i * 0.5) // Diminue progressivement la largeur
                            const width2 = l2 * (4 - i * 0.5)
                            const alpha = 0.04 * Math.pow(0.8, i) // Opacité réduite pour un effet plus subtil

                            g.fill(0x606060, alpha) // Gris plus clair
                            this.polygon(
                                g,
                                pos.x1 - width1 / 2,
                                segment.p1.screen.y,
                                pos.x1 + width1 / 2,
                                segment.p1.screen.y,
                                pos.x2 + width2 / 2,
                                segment.p2.screen.y,
                                pos.x2 - width2 / 2,
                                segment.p2.screen.y
                            )
                            g.endFill()
                        }
                    })
                }
            }

            segment.clip = maxy
            maxy = segment.p2.screen.y
        }

        /** OPPONENTS */
        for (const car of this.cars) {
            // Trouver le segment sur lequel est la voiture
            const carSegment = this.findSegment(car.z)
            const percent = (car.z % this.segmentLength) / this.segmentLength

            const carY = this.interpolate(
                carSegment.p1.world.y,
                carSegment.p2.world.y,
                percent
            )

            // Calcul du z local pour le project
            const cameraY = playerY + this.cameraHeight
            const cameraZ = this.position

            // Récupère le X cumulé de la route entre la caméra et la voiture (pour synchroniser la position horizontale avec la route courbée)
            // Trouver le segment caméra et celui de la voiture
            let cameraSegment = this.findSegment(this.position)

            let x = 0
            let dx =
                -((cameraSegment.curve || 0) * basePercent) * this.curveFactor
            let steps =
                (carSegment.index -
                    cameraSegment.index +
                    this.segments.length) %
                this.segments.length

            for (let i = 0; i < steps; i++) {
                const index = (cameraSegment.index + i) % this.segments.length
                const seg = this.segments[index]
                x += dx
                dx += (seg.curve || 0) * this.curveFactor
            }

            // “x” est le décalage de la route à l'endroit de la voiture (dans le repère caméra)
            const carRoadX = car.offset * this.roadWidth + x

            const carP: Point3D = {
                world: {
                    x: carRoadX,
                    y: carY,
                    z: car.z,
                },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0, scale: 0 },
            }

            // Projette la voiture
            project(
                carP,
                this.playerX * this.roadWidth,
                cameraY,
                cameraZ,
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )

            const scale = carP.screen.scale
            const y = carP.screen.y

            const carWidth = carP.screen.w * 0.3 // facteur réglable
            const carHeight =
                carWidth *
                (this.carDimensions.height / this.carDimensions.width)

            const clip =
                typeof carSegment.clip === "number"
                    ? carSegment.clip
                    : this.height

            // CLIPPING PAR CRETE DE LA ROUTE
            if (y < clip) {
                car.sprite.width = Math.max(1, carWidth)
                car.sprite.height = Math.max(1, carHeight)
                car.sprite.x = carP.screen.x
                car.sprite.y = carP.screen.y
                car.sprite.visible = scale > 0 && y > 0 && y < this.height
                if (!car.sprite.parent && this.root) {
                    this.root.addChild(car.sprite)
                }
            } else {
                car.sprite.visible = false
            }
        }

        // HUD / Jauge de vitesse
        g.fill(0x111111, 0.75)
        g.rect(12, 14, 192, 26)
        g.endFill()

        const minSpeed = 0
        const maxSpeed = this.maxSpeed
        const currentSpeedClamped = Math.max(
            minSpeed,
            Math.min(maxSpeed, this.speed)
        )
        const speedRatio =
            maxSpeed > 0
                ? (currentSpeedClamped - minSpeed) / (maxSpeed - minSpeed)
                : 0
        const gaugeWidth = speedRatio * 180 // 180 = largeur totale de la jauge

        // Couleur de la jauge selon la vitesse
        let color = 0x4fff66 // Vert pour vitesse basse
        if (speedRatio > 0.4) color = 0xffaa44 // Orange pour vitesse moyenne
        if (speedRatio > 0.7) color = 0xff4444 // Rouge pour vitesse élevée

        // Effet de pulsation à haute vitesse
        const pulseScale =
            speedRatio > 0.8 ? 1 + Math.sin(Date.now() * 0.01) * 0.01 : 1

        g.fill(color)
        g.rect(18, 20, gaugeWidth * pulseScale, 13)
        g.endFill()

        // Reflet sur la jauge
        g.fill(0xffffff, 0.4)
        g.rect(18, 21, gaugeWidth * pulseScale, 3)
        g.endFill()

        if (this.playerSprite) {
            this.playerSprite.x = this.width / 2
            this.playerSprite.y = this.height - this.playerHeight / 2 - 32
            this.playerSprite.rotation = 0
        }

        const maxTilt = 0.05 // ≈ 25°
        const tiltSpeed = 0.25 // ajuste pour la rapidité du retour

        if (this.playerSprite) {
            const carX = this.width / 2
            const carY = this.height - this.playerHeight / 2 - 32

            this.playerSprite.x = carX
            this.playerSprite.y = carY

            // TILT “arcade” : gauche = positif, droite = négatif
            let targetTilt = 0
            if (this.keyLeft) targetTilt = -maxTilt
            else if (this.keyRight) targetTilt = +maxTilt

            // Interpolation linéaire (lerp)
            this.playerTilt += (targetTilt - this.playerTilt) * tiltSpeed
            this.playerSprite.rotation = this.playerTilt

            // Ombre sous la moto
            g.fill(0x000000, 0.25)
            g.drawEllipse(
                carX,
                carY + this.playerHeight * 0.43,
                this.playerWidth * 0.25,
                this.playerHeight * 0.07
            )
            g.endFill()
        }
    }

    // Polygon helper
    private async resetCars() {
        // Nettoyage des anciennes voitures
        for (const car of this.cars) {
            if (car.sprite.parent) {
                car.sprite.parent.removeChild(car.sprite)
            }
        }
        this.cars = []

        try {
            const carTexture = await Assets.load("src/assets/Default.png")
            const base = this.findSegment(this.position).index

            console.log(`Création de ${this.totalCars} voitures...`)
            console.log(
                `Base segment: ${base}, Total segments: ${this.segments.length}`
            )

            for (let i = 0; i < this.totalCars; i++) {
                // Place chaque voiture devant le joueur
                const carZ =
                    this.position + this.playerZ + (i + 4) * this.segmentLength

                const segment = this.findSegment(carZ)
                const z = segment.p1.world.z
                const offset = (Math.random() - 0.5) * 1.8
                const speed = this.maxSpeed * (0.3 + Math.random() * 0.4)
                const sprite = new Sprite(carTexture)
                sprite.anchor.set(0.5)
                const car: Car = { z, offset, speed, sprite }
                segment.cars = segment.cars || []
                segment.cars.push(car)
                this.cars.push(car)

                console.log(
                    `Voiture ${i}: segment (find) = ${this.segments.indexOf(
                        segment
                    )}, z = ${z}, offset = ${offset.toFixed(
                        2
                    )}, speed = ${speed.toFixed(0)}`
                )
            }

            console.log(`Total voitures créées: ${this.cars.length}`)
        } catch (error) {
            console.error("Erreur lors du chargement des voitures:", error)
        }
    }

    private polygon(
        g: PIXI.Graphics,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        x4: number,
        y4: number
    ) {
        g.moveTo(x1, y1)
        g.lineTo(x2, y2)
        g.lineTo(x3, y3)
        g.lineTo(x4, y4)
        g.lineTo(x1, y1)
    }

    private calcCurveOffset(
        carZ: number,
        cameraZ: number,
        segments: Segment[],
        segmentLength: number,
        curveFactor: number
    ) {
        // Reprend la logique Jake Gordon : cumule la courbe entre la caméra et la voiture
        let offset = 0
        let dz = carZ - cameraZ
        let segmentIndex = Math.floor(cameraZ / segmentLength)
        while (dz > 0) {
            const segment = segments[segmentIndex % segments.length]
            offset += segment.curve || 0
            dz -= segmentLength
            segmentIndex++
        }
        return offset * curveFactor * this.roadWidth
    }

    // ========== CLAVIER ==========
    private handleKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
            case "ArrowLeft":
            case "KeyA":
                this.keyLeft = true
                break
            case "ArrowRight":
            case "KeyD":
                this.keyRight = true
                break
            case "ArrowUp":
            case "KeyW":
                this.keyFaster = true
                break
            case "ArrowDown":
            case "KeyS":
                this.keySlower = true
                break
        }
    }
    private handleKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
            case "ArrowLeft":
            case "KeyA":
                this.keyLeft = false
                break
            case "ArrowRight":
            case "KeyD":
                this.keyRight = false
                break
            case "ArrowUp":
            case "KeyW":
                this.keyFaster = false
                break
            case "ArrowDown":
            case "KeyS":
                this.keySlower = false
                break
        }
    }
}
