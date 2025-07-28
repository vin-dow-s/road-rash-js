import {
    Application,
    Assets,
    Container,
    Graphics,
    Sprite,
    Texture,
    Ticker,
} from "pixi.js"
import {
    ACCELERATION,
    BORDER_COLOR,
    BORDER_WIDTH,
    BRAKE,
    BUILDING_COLOR,
    CURVE_SCALE,
    DASH_INTERVAL_SEGMENTS,
    DASH_LENGTH_SEGMENTS,
    DRAW_DISTANCE,
    ENEMY_SPAWN_RATE,
    HORIZON,
    MAX_ENEMIES,
    MAX_SPEED,
    MOTO_COLORS,
    PLAYER_LANES,
    ROAD_COLOR,
    ROAD_MAX_WIDTH,
    ROAD_MIN_WIDTH,
    ROAD_SIDE_COLOR,
    ROAD_SPEED,
    ROCK_COLOR,
    TREE_COLOR,
} from "./constants"
import {
    createPlayerState,
    PLAYER_HEIGHT,
    PLAYER_WIDTH,
    updatePlayerPosition,
} from "./Player"

type PlayerState = ReturnType<typeof createPlayerState>

interface SceneryItem {
    id: number
    type: "tree" | "rock" | "building"
    side: "left" | "right"
    z: number
    offset: number
}
interface Enemy {
    id: number
    z: number
    lane: number
    color: number
    speed: number
}

function buildRoad() {
    const road: { curve: number }[] = []
    const easeInOut = (t: number) =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    for (let i = 0; i < 40; i++) road.push({ curve: 0 })
    for (let i = 0; i < 10; i++)
        road.push({ curve: -0.003 * (1 - easeInOut(i / 10)) })
    for (let i = 0; i < 20; i++)
        road.push({ curve: -0.003 + 0.006 * easeInOut(i / 20) })
    for (let i = 0; i < 10; i++)
        road.push({ curve: 0.003 * (1 - easeInOut(i / 10)) })
    for (let i = 0; i < 25; i++) road.push({ curve: 0 })
    for (let i = 0; i < 6; i++)
        road.push({ curve: 0.003 * (1 - easeInOut(i / 6)) })
    for (let i = 0; i < 25; i++)
        road.push({ curve: 0.003 - 0.006 * easeInOut(i / 25) })
    for (let i = 0; i < 6; i++)
        road.push({ curve: -0.003 * (1 - easeInOut(i / 6)) })
    for (let i = 0; i < 6; i++)
        road.push({ curve: -0.005 * (1 - easeInOut(i / 6)) })
    for (let i = 0; i < 15; i++)
        road.push({ curve: -0.005 + 0.01 * easeInOut(i / 15) })
    for (let i = 0; i < 6; i++)
        road.push({ curve: 0.005 * (1 - easeInOut(i / 6)) })
    for (let i = 0; i < 50; i++) road.push({ curve: 0 })
    return road
}

export class PixiRoadRashEngine {
    private app: Application | null = null
    private container: HTMLElement | null = null
    private paused: boolean = false

    // Game state
    private player: PlayerState
    private speed: number
    private scrollPos: number
    private isAccelerating: boolean = false
    private isBraking: boolean = false
    private sceneryItems: SceneryItem[] = []
    private enemies: Enemy[] = []
    private lastEnemySpawn: number = 0

    private road = buildRoad()
    private backgroundSprite: Sprite | null = null
    private playerSprite: Sprite | null = null
    private graphics: Graphics | null = null

    private backgroundTexture: Texture | null = null
    private playerTexture: Texture | null = null

    constructor() {
        this.player = createPlayerState()
        this.speed = ROAD_SPEED
        this.scrollPos = 0
    }

    public async init(container: HTMLElement) {
        this.container = container

        // Créer l'Application avec la nouvelle syntaxe PIXI v8
        this.app = new Application()

        await this.app.init({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x87ceeb, // Bleu ciel pour débugger
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

        // Background
        if (this.backgroundTexture) {
            this.backgroundSprite = new Sprite(this.backgroundTexture)
            this.backgroundSprite.width = window.innerWidth
            this.backgroundSprite.height = window.innerHeight
            this.backgroundSprite.x = 0
            this.backgroundSprite.y = -100
            root.addChild(this.backgroundSprite)
        }

        // Route, décor, HUD...
        this.graphics = new Graphics()
        root.addChild(this.graphics)

        // Player
        if (this.playerTexture) {
            this.playerSprite = new Sprite(this.playerTexture)
            this.playerSprite.width = PLAYER_WIDTH
            this.playerSprite.height = PLAYER_HEIGHT
            this.playerSprite.anchor.set(0.5)
            root.addChild(this.playerSprite)
        } else {
            // Créer un sprite de fallback si la texture n'a pas pu être chargée
            const fallbackGraphics = new Graphics()
            fallbackGraphics.rect(
                -PLAYER_WIDTH / 2,
                -PLAYER_HEIGHT / 2,
                PLAYER_WIDTH,
                PLAYER_HEIGHT
            )
            fallbackGraphics.fill({ color: 0xff0000 }) // Rouge pour le joueur
            const fallbackTexture =
                this.app.renderer.generateTexture(fallbackGraphics)
            this.playerSprite = new Sprite(fallbackTexture)
            this.playerSprite.anchor.set(0.5)
            root.addChild(this.playerSprite)
        }

        // Décor aléatoire
        this.sceneryItems = []
        for (let i = 0; i < 80; i++) {
            this.sceneryItems.push({
                id: i,
                type:
                    Math.random() < 0.45
                        ? "tree"
                        : Math.random() < 0.72
                        ? "rock"
                        : "building",
                side: Math.random() < 0.5 ? "left" : "right",
                z: Math.random(),
                offset: Math.random() * 250 + 120,
            })
        }

        // Listeners clavier
        window.addEventListener("keydown", this.handleKeyDown)
        window.addEventListener("keyup", this.handleKeyUp)

        // Resize
        window.addEventListener("resize", this.handleResize)

        // Boucle jeu
        this.app.ticker.add(this.update)

        this.draw() // premier draw immédiat
    }

    private handleResize = () => {
        if (!this.app) return
        this.app.renderer.resize(window.innerWidth, window.innerHeight)
        if (this.backgroundSprite) {
            this.backgroundSprite.width = window.innerWidth
            this.backgroundSprite.height = window.innerHeight
        }
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === " " || e.key === "p" || e.key === "P") {
            this.paused = !this.paused
            return
        }
        if (e.key === "ArrowLeft") this.player.isMovingLeft = true
        if (e.key === "ArrowRight") this.player.isMovingRight = true
        if (e.key === "ArrowUp") this.isAccelerating = true
        if (e.key === "ArrowDown") this.isBraking = true
    }
    private handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") this.player.isMovingLeft = false
        if (e.key === "ArrowRight") this.player.isMovingRight = false
        if (e.key === "ArrowUp") this.isAccelerating = false
        if (e.key === "ArrowDown") this.isBraking = false
    }

    // Utilise bien le Ticker object de Pixi 8, pas juste number
    private update = (ticker: Ticker) => {
        if (this.paused) return
        const deltaTime = ticker.deltaTime / 60

        // Vitesse
        let nextSpeed = this.speed
        if (this.isAccelerating)
            nextSpeed = Math.min(
                this.speed + ACCELERATION * deltaTime,
                MAX_SPEED
            )
        else if (this.isBraking)
            nextSpeed = Math.max(ROAD_SPEED, this.speed - BRAKE * deltaTime)
        this.speed = nextSpeed
        const speedFactor = nextSpeed / ROAD_SPEED

        // Joueur
        this.player = updatePlayerPosition(
            this.player,
            deltaTime,
            window.innerWidth / 2,
            800 // Largeur de route
        )

        // Scroll route
        this.scrollPos += nextSpeed * deltaTime
        this.lastEnemySpawn += deltaTime

        // Décor
        this.sceneryItems = this.sceneryItems.map((item) => ({
            ...item,
            z: (item.z + 0.28 * speedFactor * deltaTime) % 1,
        }))

        // Ennemis
        if (
            this.lastEnemySpawn > ENEMY_SPAWN_RATE &&
            this.enemies.length < MAX_ENEMIES
        ) {
            this.enemies.push({
                id: Date.now() + Math.random(),
                z: 0.13,
                lane: Math.floor(Math.random() * 3) - 1,
                color: MOTO_COLORS[
                    Math.floor(Math.random() * MOTO_COLORS.length)
                ],
                speed: (0.55 + Math.random() * 0.45) * speedFactor,
            })
            this.lastEnemySpawn = 0
        }
        this.enemies = this.enemies
            .map((enemy) => ({
                ...enemy,
                z: enemy.z + enemy.speed * deltaTime,
            }))
            .filter((enemy) => enemy.z < 1.22)

        this.draw()
    }

    private getRoadWidth(t: number): number {
        return ROAD_MIN_WIDTH + (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * t
    }

    private draw() {
        if (!this.graphics) return
        const g = this.graphics
        g.clear()
        const screenW = window.innerWidth
        const screenH = window.innerHeight
        const ROAD_LENGTH = this.road.length

        // Sol/herbe
        g.rect(0, HORIZON, screenW, screenH - HORIZON)
        g.fill({ color: ROAD_SIDE_COLOR })

        // Courbes
        const position = this.scrollPos / 100
        let curveSums = new Array(DRAW_DISTANCE + 1).fill(0)
        for (let i = DRAW_DISTANCE; i >= 0; i--) {
            let sum = 0
            for (let j = i; j < DRAW_DISTANCE; j++) {
                const idx = (Math.floor(position) + j) % ROAD_LENGTH
                sum += this.road[idx].curve
            }
            curveSums[i] = sum
        }

        // Segments route
        for (let i = 0; i < DRAW_DISTANCE; i++) {
            const t1 = i / DRAW_DISTANCE
            const t2 = (i + 1) / DRAW_DISTANCE
            const roadW1 = this.getRoadWidth(t1)
            const roadW2 = this.getRoadWidth(t2)
            const y1 = HORIZON + (screenH - HORIZON) * t1
            const y2 = HORIZON + (screenH - HORIZON) * t2
            const curveOffset1 = curveSums[i] * CURVE_SCALE
            const curveOffset2 = curveSums[i + 1] * CURVE_SCALE
            const x1 = screenW / 2 + curveOffset1 - roadW1 / 2
            const x2 = screenW / 2 + curveOffset2 - roadW2 / 2

            // Route
            g.moveTo(x1, y1)
            g.lineTo(x1 + roadW1, y1)
            g.lineTo(x2 + roadW2, y2)
            g.lineTo(x2, y2)
            g.closePath()
            g.fill({ color: ROAD_COLOR })

            // Pointillés
            const DASH_GROUP = DASH_INTERVAL_SEGMENTS + DASH_LENGTH_SEGMENTS
            const dashOffset =
                (DASH_GROUP - ((this.scrollPos / 2) % DASH_GROUP)) % DASH_GROUP
            for (let lane = 1; lane < PLAYER_LANES; lane++) {
                const dashPos = (i + dashOffset) % DASH_GROUP
                if (dashPos < DASH_LENGTH_SEGMENTS && t1 > 0.05) {
                    const laneWidth1 = roadW1 / PLAYER_LANES
                    const laneWidth2 = roadW2 / PLAYER_LANES
                    g.moveTo(x1 + lane * laneWidth1, y1)
                    g.lineTo(x1 + lane * laneWidth1 + 8, y1)
                    g.lineTo(x2 + lane * laneWidth2 + 8, y2)
                    g.lineTo(x2 + lane * laneWidth2, y2)
                    g.closePath()
                    g.fill({ color: 0xffffff })
                }
            }

            // Traces de pneus
            for (let lane = 0; lane < PLAYER_LANES; lane++) {
                const laneCenter1 = x1 + ((lane + 0.5) * roadW1) / PLAYER_LANES
                const laneCenter2 = x2 + ((lane + 0.5) * roadW2) / PLAYER_LANES
                const SKID_WIDTH = 36
                for (let blur = 0; blur < 4; blur++) {
                    const blurAlpha = [0.07, 0.045, 0.028, 0.015][blur]
                    const blurExtra = blur * 11
                    g.moveTo(laneCenter1 - SKID_WIDTH / 2 - blurExtra, y1)
                    g.lineTo(laneCenter1 + SKID_WIDTH / 2 + blurExtra, y1)
                    g.lineTo(laneCenter2 + SKID_WIDTH / 2 + blurExtra, y2)
                    g.lineTo(laneCenter2 - SKID_WIDTH / 2 - blurExtra, y2)
                    g.closePath()
                    g.fill({
                        color: 0x333333,
                        alpha: blurAlpha,
                    })
                }
            }

            // Bordures
            g.moveTo(x1, y1)
            g.lineTo(x1 + BORDER_WIDTH, y1)
            g.lineTo(x2 + BORDER_WIDTH, y2)
            g.lineTo(x2, y2)
            g.closePath()
            g.fill({ color: BORDER_COLOR })

            g.moveTo(x1 + roadW1 - BORDER_WIDTH, y1)
            g.lineTo(x1 + roadW1, y1)
            g.lineTo(x2 + roadW2, y2)
            g.lineTo(x2 + roadW2 - BORDER_WIDTH, y2)
            g.closePath()
            g.fill({ color: BORDER_COLOR })

            g.moveTo(x1 - 20, y1)
            g.lineTo(x1, y1)
            g.lineTo(x2, y2)
            g.lineTo(x2 - 20, y2)
            g.closePath()
            g.fill({ color: 0x8b4513 })

            g.moveTo(x1 + roadW1, y1)
            g.lineTo(x1 + roadW1 + 20, y1)
            g.lineTo(x2 + roadW2 + 20, y2)
            g.lineTo(x2 + roadW2, y2)
            g.closePath()
            g.fill({ color: 0x8b4513 })
        }

        // Décor
        this.sceneryItems.forEach((item) => {
            if (item.z > 0.05 && item.z < 0.98) {
                const t = item.z
                const i = Math.floor(t * DRAW_DISTANCE)
                const decorCurveOffset = curveSums[i] * CURVE_SCALE
                const itemY = HORIZON + (screenH - HORIZON) * t
                const roadW = this.getRoadWidth(t)
                const centerX = screenW / 2 + decorCurveOffset
                const sideOffset =
                    item.side === "left"
                        ? -roadW / 2 - item.offset
                        : roadW / 2 + item.offset
                const finalDecorX = centerX + sideOffset
                const scale = 0.3 + 0.7 * t

                if (item.type === "tree") {
                    g.rect(
                        finalDecorX,
                        itemY - 360 * scale,
                        60 * scale,
                        360 * scale
                    )
                    g.fill({ color: 0x8b4513 })
                    g.circle(
                        finalDecorX + 30 * scale,
                        itemY - 300 * scale,
                        135 * scale
                    )
                    g.fill({ color: TREE_COLOR })
                } else if (item.type === "rock") {
                    g.circle(finalDecorX, itemY - 20 * scale, 35 * scale)
                    g.fill({ color: ROCK_COLOR })
                } else if (item.type === "building") {
                    g.rect(
                        finalDecorX,
                        itemY - 180 * scale,
                        90 * scale,
                        180 * scale
                    )
                    g.fill({ color: BUILDING_COLOR })
                }
            }
        })

        // HUD / vitesse
        g.rect(12, 14, 192, 26)
        g.fill({ color: 0x111111, alpha: 0.75 })

        // Calcul de la jauge de vitesse
        const minSpeed = ROAD_SPEED
        const maxSpeed = MAX_SPEED
        const currentSpeedClamped = Math.max(
            minSpeed,
            Math.min(maxSpeed, this.speed)
        )
        const speedRatio =
            (currentSpeedClamped - minSpeed) / (maxSpeed - minSpeed)
        const gaugeWidth = 36 + speedRatio * 144
        let color = 0x4fff66
        if (speedRatio > 0.4) color = 0xffaa44
        if (speedRatio > 0.7) color = 0xff4444
        const pulseScale =
            speedRatio > 0.8 ? 1 + Math.sin(Date.now() * 0.01) * 0.01 : 1
        g.rect(18, 20, gaugeWidth * pulseScale, 13)
        g.fill({ color })
        g.rect(18, 21, gaugeWidth * pulseScale, 3)
        g.fill({ color: 0xffffff, alpha: 0.4 })

        // Positionnement du joueur (comme dans GameEngine.jsx)
        if (this.playerSprite) {
            const screenW = window.innerWidth
            const playerScreenX = screenW / 2 + (this.player.x - screenW / 2)

            // Dessiner l'ombre du joueur (ellipse sous la moto)
            g.ellipse(
                playerScreenX + PLAYER_WIDTH / 2,
                this.player.y + PLAYER_HEIGHT - 10,
                PLAYER_WIDTH / 5,
                10
            )
            g.fill({ color: 0x000000, alpha: 0.3 })

            // Positionner le sprite du joueur
            this.playerSprite.x = playerScreenX + PLAYER_WIDTH / 2
            this.playerSprite.y = this.player.y + PLAYER_HEIGHT / 2
            this.playerSprite.rotation = this.player.rotation
        }
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

    // Méthode pour mettre le jeu en pause depuis l’extérieur
    public setPaused(paused: boolean) {
        this.paused = paused
    }
}
