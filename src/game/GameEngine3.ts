// GameEngine.ts - Jake Gordon Racer v1 adapté à Pixi.js + TypeScript

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
    fog?: number
    looped?: boolean
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
    FOG: 0x8ad4c0,
}

const DEFAULTS = {
    width: window.innerWidth,
    height: window.innerHeight,
    lanes: 3,
    roadWidth: 2000,
    segmentLength: 200,
    rumbleLength: 3,
    cameraHeight: 1000,
    drawDistance: 300,
    fogDensity: 5,
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
function exponentialFog(distance: number, density: number) {
    return 1 / Math.pow(Math.E, distance * distance * density)
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
    // State
    private width: number = DEFAULTS.width
    private height: number = DEFAULTS.height
    private lanes: number = DEFAULTS.lanes
    private roadWidth: number = DEFAULTS.roadWidth
    private segmentLength: number = DEFAULTS.segmentLength
    private rumbleLength: number = DEFAULTS.rumbleLength
    private cameraHeight: number = DEFAULTS.cameraHeight
    private drawDistance: number = DEFAULTS.drawDistance
    private fogDensity: number = DEFAULTS.fogDensity
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

    // Joueur/Jeu
    private position: number = 0
    private speed: number = 200 // Démarrage lent pour voir la route !
    private playerX: number = 0
    private backgroundSprite: Sprite | null = null
    private playerSprite: Sprite | null = null

    private backgroundTexture: Texture | null = null
    private playerTexture: Texture | null = null

    private playerWidth = 175
    private playerHeight = 175

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
        const root = new Container()
        this.app.stage.addChild(root)

        // Route, décor, HUD...
        this.graphics = new Graphics()
        root.addChild(this.graphics)

        // Background
        const horizonY = this.height / 2
        if (this.backgroundTexture) {
            this.backgroundSprite = new Sprite(this.backgroundTexture)
            this.backgroundSprite.width = this.width
            this.backgroundSprite.height = horizonY
            this.backgroundSprite.x = 0
            this.backgroundSprite.y = 0
            root.addChild(this.backgroundSprite)
        }

        // Player
        if (this.playerTexture) {
            this.playerSprite = new Sprite(this.playerTexture)
            this.playerSprite.width = this.playerWidth
            this.playerSprite.height = this.playerHeight
            this.playerSprite.anchor.set(0.5)
            root.addChild(this.playerSprite)
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
            root.addChild(this.playerSprite)
        }

        // Player sprite (centré)
        if (this.playerSprite) {
            this.playerSprite.x = this.width / 2
            this.playerSprite.y = this.playerZ + this.playerHeight / 2
            this.playerSprite.rotation = 0
        }

        this.reset()

        window.addEventListener("keydown", this.handleKeyDown)
        window.addEventListener("keyup", this.handleKeyUp)
        window.addEventListener("resize", this.handleResize)

        this.rafId = requestAnimationFrame(this.gameLoop)
    }

    public destroy() {
        window.removeEventListener("keydown", this.handleKeyDown)
        window.removeEventListener("keyup", this.handleKeyUp)
        window.removeEventListener("resize", this.handleResize)

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

        this.app.renderer.resize(window.innerWidth, window.innerHeight)

        if (this.backgroundSprite) {
            this.backgroundSprite.width = window.innerWidth
            this.backgroundSprite.height = window.innerHeight
        }
    }

    // ========== Road/State Génération ==========
    private reset() {
        this.segments = []
        for (let n = 0; n < 500; n++) {
            this.segments.push({
                index: n,
                p1: {
                    world: { x: 0, y: 0, z: n * this.segmentLength },
                    camera: { x: 0, y: 0, z: 0 },
                    screen: { x: 0, y: 0, w: 0, scale: 0 },
                },
                p2: {
                    world: { x: 0, y: 0, z: (n + 1) * this.segmentLength },
                    camera: { x: 0, y: 0, z: 0 },
                    screen: { x: 0, y: 0, w: 0, scale: 0 },
                },
                color:
                    Math.floor(n / this.rumbleLength) % 2
                        ? COLORS.DARK
                        : COLORS.LIGHT,
            })
        }
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
        this.maxSpeed = this.segmentLength / (1 / this.fps)
        this.accel = this.maxSpeed / 5
        this.breaking = -this.maxSpeed
        this.decel = -this.maxSpeed / 5
        this.offRoadDecel = -this.maxSpeed / 2
        this.offRoadLimit = this.maxSpeed / 4

        this.position = 0
        this.speed = 200
        this.playerX = 0
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
    private update(dt: number) {
        this.position = increase(
            this.position,
            dt * this.speed,
            this.trackLength
        )
        const dx = dt * 2 * (this.speed / this.maxSpeed)

        if (this.keyLeft) this.playerX -= dx
        else if (this.keyRight) this.playerX += dx

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
    }

    // ========== RENDER ==========
    private render() {
        if (!this.graphics) return
        const g = this.graphics
        g.clear()

        const horizonY = this.height / 2

        // Fond : ciel puis herbe
        if (!this.backgroundSprite) {
            g.beginFill(COLORS.SKY)
            g.drawRect(0, 0, this.width, horizonY)
            g.endFill()
        }

        // Herbe, uniquement sous l’horizon
        g.beginFill(COLORS.LIGHT.grass)
        g.drawRect(0, horizonY, this.width, this.height - horizonY)
        g.endFill()

        let baseSegment = this.findSegment(this.position)
        let maxy = this.height

        for (let n = 0; n < this.drawDistance; n++) {
            let segment =
                this.segments[(baseSegment.index + n) % this.segments.length]
            segment.looped = segment.index < baseSegment.index
            segment.fog = exponentialFog(n / this.drawDistance, this.fogDensity)

            project(
                segment.p1,
                this.playerX * this.roadWidth,
                this.cameraHeight,
                this.position - (segment.looped ? this.trackLength : 0),
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )
            project(
                segment.p2,
                this.playerX * this.roadWidth,
                this.cameraHeight,
                this.position - (segment.looped ? this.trackLength : 0),
                this.cameraDepth,
                this.width,
                this.height,
                this.roadWidth
            )

            if (
                segment.p1.camera.z <= this.cameraDepth ||
                segment.p2.screen.y >= maxy
            )
                continue

            // Rumble strips
            const r1 = segment.p1.screen.w / Math.max(6, 2 * this.lanes)
            const r2 = segment.p2.screen.w / Math.max(6, 2 * this.lanes)
            g.beginFill(segment.color.rumble)
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
            g.beginFill(segment.color.rumble)
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

            // Road (trapèze)
            g.beginFill(segment.color.road)
            this.polygon(
                g,
                segment.p1.screen.x - segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p1.screen.x + segment.p1.screen.w,
                segment.p1.screen.y,
                segment.p2.screen.x + segment.p2.screen.w,
                segment.p2.screen.y,
                segment.p2.screen.x - segment.p2.screen.w,
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
                    g.beginFill(segment.color.lane)
                    g.moveTo(lanex1 - l1 / 2, segment.p1.screen.y)
                    g.lineTo(lanex1 + l1 / 2, segment.p1.screen.y)
                    g.lineTo(lanex2 + l2 / 2, segment.p2.screen.y)
                    g.lineTo(lanex2 - l2 / 2, segment.p2.screen.y)
                    g.closePath()
                    g.endFill()
                }
            }

            // Fog overlay
            if (segment.fog && segment.fog < 1) {
                g.beginFill(COLORS.FOG, 1 - segment.fog)
                g.drawRect(
                    0,
                    segment.p2.screen.y,
                    this.width,
                    maxy - segment.p2.screen.y
                )
                g.endFill()
            }

            maxy = segment.p2.screen.y
        }

        g.beginFill(COLORS.FOG, 0.95)
        g.drawRect(0, horizonY - 2, this.width, 12)
        g.endFill()

        if (this.playerSprite) {
            this.playerSprite.x = this.width / 2
            this.playerSprite.y = this.height - this.playerHeight / 2 - 32
            this.playerSprite.rotation = 0
        }

        if (this.playerSprite) {
            const carX = this.width / 2
            const carY = this.height - this.playerHeight / 2 - 32

            this.playerSprite.x = carX
            this.playerSprite.y = carY
            this.playerSprite.rotation = 0

            // Ombre sous la moto
            g.beginFill(0x000000, 0.25)
            g.drawEllipse(
                carX,
                carY + this.playerHeight * 0.43,
                this.playerWidth * 0.32,
                this.playerHeight * 0.09
            )
            g.endFill()
        }
    }

    // Polygon helper
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
