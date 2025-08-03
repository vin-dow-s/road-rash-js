import {
    Application,
    Assets,
    Container,
    Graphics,
    Sprite,
    Texture,
} from "pixi.js"
import { drawSpeedGauge } from "./ui/HUD"
import { drawRoadSegment } from "./ui/RoadRenderer"

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
    private app: Application | null = null
    private graphics: Graphics | null = null
    private container: HTMLElement | null = null
    private root: Container | null = null
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

            segment.clip = maxy

            if (
                segment.p1.camera.z <= this.cameraDepth ||
                segment.p2.screen.y >= segment.p1.screen.y ||
                segment.p2.screen.y >= maxy
            ) {
                continue
            }

            // Dessiner le segment de route
            drawRoadSegment(g, segment, { lanes: this.lanes })

            maxy = segment.p2.screen.y
        }

        /** OPPONENTS */
        for (let n = this.drawDistance - 1; n > 0; n--) {
            const segment =
                this.segments[(baseSegment.index + n) % this.segments.length]

            // Rendu des voitures de ce segment - VERSION SIMPLIFIÉE
            if (segment.cars) {
                for (const car of segment.cars) {
                    this.renderCarWithClipping(car, segment, playerY)
                }
            }
        }

        // HUD / Jauge de vitesse
        drawSpeedGauge(g, {
            x: 12,
            y: 14,
            width: 192,
            height: 26,
            currentSpeed: this.speed,
            maxSpeed: this.maxSpeed,
            minSpeed: 0,
        })

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

    private renderCarWithClipping(
        car: Car,
        carSegment: Segment,
        playerY: number
    ) {
        const percent = (car.z % this.segmentLength) / this.segmentLength
        const carY = this.interpolate(
            carSegment.p1.world.y,
            carSegment.p2.world.y,
            percent
        )

        // Calcul de la position X de la route à l'endroit de la voiture
        let baseSegment = this.findSegment(this.position)
        let basePercent =
            (this.position % this.segmentLength) / this.segmentLength

        let x = 0
        let dx = -((baseSegment.curve || 0) * basePercent) * this.curveFactor
        let steps =
            (carSegment.index - baseSegment.index + this.segments.length) %
            this.segments.length

        for (let i = 0; i < steps; i++) {
            const index = (baseSegment.index + i) % this.segments.length
            const seg = this.segments[index]
            x += dx
            dx += (seg.curve || 0) * this.curveFactor
        }

        const carRoadX = car.offset * this.roadWidth + x

        const carP: Point3D = {
            world: { x: carRoadX, y: carY, z: car.z },
            camera: { x: 0, y: 0, z: 0 },
            screen: { x: 0, y: 0, w: 0, scale: 0 },
        }

        // Projection de la voiture
        project(
            carP,
            this.playerX * this.roadWidth,
            playerY + this.cameraHeight,
            this.position,
            this.cameraDepth,
            this.width,
            this.height,
            this.roadWidth
        )

        const carWidth = carP.screen.w * 0.3
        const carHeight =
            carWidth * (this.carDimensions.height / this.carDimensions.width)

        const clipTolerance = carHeight * 0.5 // Tolérance = moitié de la hauteur de la voiture
        const clipLimit = (carSegment.clip || this.height) + clipTolerance

        const dz = car.z - (this.position + this.playerZ)
        const shouldBeVisible =
            carP.camera.z > this.cameraDepth &&
            carP.screen.y < clipLimit &&
            dz > 0

        car.sprite.width = Math.max(10, carWidth)
        car.sprite.height = Math.max(10, carHeight)
        car.sprite.x = carP.screen.x
        car.sprite.y = carP.screen.y
        car.sprite.visible = shouldBeVisible
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

                if (this.root) this.root.addChild(sprite)

                const car: Car = { z, offset, speed, sprite }
                segment.cars = segment.cars || []
                segment.cars.push(car)
                this.cars.push(car)
            }
        } catch (error) {
            console.error("Erreur lors du chargement des voitures:", error)
        }
    }

    // ========== GAME LOOP ==========
    private gameLoop = (ts: number) => {
        const dt = Math.min(1, (ts - this.lastTs) / 1000) || 0.016
        this.update(dt)
        this.render()

        this.lastTs = ts
        this.rafId = requestAnimationFrame(this.gameLoop)
    }

    private polygon(
        g: Graphics,
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

    // Hills support - fonction lastY pour maintenir la continuité
    private lastY(): number {
        return this.segments.length === 0
            ? 0
            : this.segments[this.segments.length - 1].p2.world.y
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

    private handleResize = () => {
        if (!this.app) return

        this.width = window.innerWidth
        this.height = window.innerHeight
        this.app.renderer.resize(this.width, this.height)
    }
}
