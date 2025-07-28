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
    CAMERA_HEIGHT,
    DASH_INTERVAL_SEGMENTS,
    DASH_LENGTH_SEGMENTS,
    DRAW_DISTANCE,
    ENEMY_SPAWN_RATE,
    FIELD_OF_VIEW,
    HORIZON,
    MAX_ENEMIES,
    MAX_SPEED,
    MOTO_COLORS,
    PLAYER_LANES,
    PLAYER_Z,
    ROAD_COLOR,
    ROAD_SIDE_COLOR,
    ROAD_SPEED,
    ROAD_WIDTH,
    ROCK_COLOR,
    RUMBLE_LENGTH,
    SEGMENT_LENGTH,
    TREE_COLOR,
} from "./constants"
import {
    createPlayerState,
    PLAYER_HEIGHT,
    PLAYER_WIDTH,
    updatePlayerPosition,
} from "./Player"

type PlayerState = ReturnType<typeof createPlayerState>

interface Point {
    world: { x: number; y: number; z: number }
    camera: { x: number; y: number; z: number }
    screen: { x: number; y: number; w: number }
}

interface Segment {
    index: number
    curve: number
    p1: Point
    p2: Point
    color: number
}

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

function buildRoadSegments(): Segment[] {
    const segments: Segment[] = []
    const segmentLength = SEGMENT_LENGTH

    // Utilitaire pour ajouter un segment
    function addSegment(curve: number) {
        const n = segments.length
        segments.push({
            index: n,
            curve,
            color:
                Math.floor(n / RUMBLE_LENGTH) % 2 ? ROAD_COLOR : BORDER_COLOR,
            p1: {
                world: { x: 0, y: 0, z: n * segmentLength },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0 },
            },
            p2: {
                world: { x: 0, y: 0, z: (n + 1) * segmentLength },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0 },
            },
        })
    }

    // Ajoute des virages façon Jake
    for (let i = 0; i < 50; i++) addSegment(0)
    for (let i = 0; i < 50; i++) addSegment(2) // virage à droite
    for (let i = 0; i < 50; i++) addSegment(0)
    for (let i = 0; i < 50; i++) addSegment(-2) // virage à gauche
    for (let i = 0; i < 50; i++) addSegment(0)

    return segments
}

function project3D(
    point: Point,
    camX: number,
    camY: number,
    camZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number
) {
    const dz = point.world.z - camZ
    point.camera.x = point.world.x - camX
    point.camera.y = point.world.y - camY
    point.camera.z = dz

    // Éviter la division par zéro ou des valeurs trop proches de zéro
    if (Math.abs(dz) < 0.01) {
        point.screen.x = width / 2
        point.screen.y = height / 2
        point.screen.w = 0
        return
    }

    const scale = cameraDepth / dz
    point.screen.x = Math.round(
        width / 2 + (scale * point.camera.x * width) / 2
    )
    point.screen.y = Math.round(
        height / 2 - (scale * point.camera.y * height) / 2
    )
    point.screen.w = Math.abs((scale * roadWidth * width) / 2)
}

function getRoadCurveOffset(road: Segment[], z: number) {
    // On part du début du circuit
    let x = 0
    let dx = 0
    const segIndex = Math.floor(z / SEGMENT_LENGTH)

    for (let i = 0; i < segIndex; i++) {
        const s = road[i % road.length]
        x += dx
        dx += s.curve
    }
    return x
}

function getRoadCurveOffsetDelta(road: Segment[], fromZ: number, toZ: number) {
    // fromZ et toZ sont les positions Z du scroll caméra et du décor
    let x = 0
    let dx = 0
    const fromIndex = Math.floor(fromZ / SEGMENT_LENGTH)
    const toIndex = Math.floor(toZ / SEGMENT_LENGTH)

    for (let i = fromIndex; i < toIndex; i++) {
        const s = road[i % road.length]
        x += dx
        dx += s.curve
    }
    return x
}

// Fonction pour interpoler en douceur entre les courbes des segments
function getInterpolatedCurve(road: Segment[], z: number) {
    const segmentIndex = Math.floor(z / SEGMENT_LENGTH)
    const segmentProgress = (z % SEGMENT_LENGTH) / SEGMENT_LENGTH

    if (segmentIndex >= road.length - 1) {
        return road[road.length - 1].curve
    }

    const currentSegment = road[segmentIndex]
    const nextSegment = road[segmentIndex + 1]

    // Interpolation en cosinus pour une transition plus douce
    const t = (1 - Math.cos(segmentProgress * Math.PI)) / 2
    return currentSegment.curve * (1 - t) + nextSegment.curve * t
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

    private road = buildRoadSegments()
    private backgroundSprite: Sprite | null = null
    private playerSprite: Sprite | null = null
    private graphics: Graphics | null = null

    private backgroundTexture: Texture | null = null
    private playerTexture: Texture | null = null

    private finished: boolean = false

    // Lissage de la caméra pour réduire les saccades
    private cameraSmoothing = {
        targetX: 0,
        currentX: 0,
        smoothFactor: 0.15,
    }

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
        if (this.finished) return
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

    private update = (ticker: Ticker) => {
        if (this.paused || this.finished) return
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
            ROAD_WIDTH / 2 // Largeur de route
        )

        // Scroll route (NE DÉPASSE PAS la fin du circuit)
        const maxScroll = (this.road.length - DRAW_DISTANCE) * SEGMENT_LENGTH
        this.scrollPos += nextSpeed * deltaTime
        if (this.scrollPos >= maxScroll) {
            this.scrollPos = maxScroll
            this.speed = 0
            this.finished = true // ARRIVÉE !
        }

        // Ennemis
        if (
            this.lastEnemySpawn > ENEMY_SPAWN_RATE &&
            this.enemies.length < MAX_ENEMIES &&
            !this.finished
        ) {
            this.enemies.push({
                id: Date.now() + Math.random(),
                z: 0.08 + Math.random() * 0.1, // Position de spawn plus variée
                lane: Math.floor(Math.random() * 3) - 1,
                color: MOTO_COLORS[
                    Math.floor(Math.random() * MOTO_COLORS.length)
                ],
                speed: (0.7 + Math.random() * 0.6) * speedFactor, // Vitesse des ennemis plus élevée et variable
            })
            this.lastEnemySpawn = 0
        }
        this.enemies = this.enemies
            .map((enemy) => ({
                ...enemy,
                z: enemy.z + enemy.speed * deltaTime,
            }))
            .filter((enemy) => enemy.z < 1.4) // Distance plus éloignée pour voir les ennemis plus longtemps

        this.lastEnemySpawn += deltaTime

        this.draw()
    }

    private draw() {
        if (!this.graphics) return
        const g = this.graphics
        g.clear()

        const screenW = window.innerWidth
        const screenH = window.innerHeight

        const playerRoadX =
            (2 * (this.player.x + PLAYER_WIDTH / 2 - screenW / 2)) / ROAD_WIDTH

        // 3D setup avec lissage de caméra
        const cameraDepth = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
        const camZ = this.scrollPos + PLAYER_Z
        const baseSegmentIndex = Math.floor(this.scrollPos / SEGMENT_LENGTH)

        // Calculer la position target de la caméra basée sur les courbes à venir
        let targetCameraX = 0
        let dx = 0
        for (let i = 0; i < 3; i++) {
            // Regarder 3 segments devant
            const segIdx = baseSegmentIndex + i
            if (segIdx < this.road.length) {
                targetCameraX += dx
                dx += this.road[segIdx].curve * 50 // Facteur d'anticipation
            }
        }

        // Lissage temporel de la caméra
        this.cameraSmoothing.targetX = targetCameraX
        this.cameraSmoothing.currentX +=
            (this.cameraSmoothing.targetX - this.cameraSmoothing.currentX) *
            this.cameraSmoothing.smoothFactor

        let x = -this.cameraSmoothing.currentX // Offset lissé de la caméra
        dx = 0
        let maxy = screenH

        // Sol/herbe
        g.rect(0, HORIZON, screenW, screenH - HORIZON)
        g.fill({ color: ROAD_SIDE_COLOR })

        let visibleSegments = 0

        // Position fractionnaire dans le segment actuel pour l'interpolation
        const currentSegmentProgress =
            (this.scrollPos % SEGMENT_LENGTH) / SEGMENT_LENGTH

        for (let n = 0; n < DRAW_DISTANCE; n++) {
            const segmentIndex = baseSegmentIndex + n
            if (segmentIndex >= this.road.length) break
            const segment = this.road[segmentIndex]

            // Virage accumulé avec interpolation douce
            segment.p1.world.x = x
            segment.p2.world.x = x + dx

            // Projection 3D
            project3D(
                segment.p1,
                (playerRoadX * ROAD_WIDTH) / 2,
                CAMERA_HEIGHT,
                camZ,
                cameraDepth,
                screenW,
                screenH,
                ROAD_WIDTH
            )
            project3D(
                segment.p2,
                playerRoadX * (ROAD_WIDTH / 2),
                CAMERA_HEIGHT,
                camZ,
                cameraDepth,
                screenW,
                screenH,
                ROAD_WIDTH
            )

            x += dx

            // Application progressive de la courbe avec interpolation
            if (n === 0) {
                // Pour le premier segment, appliquer seulement la partie restante
                dx += segment.curve * (1 - currentSegmentProgress)
            } else {
                // Pour les autres segments, interpoler entre la courbe actuelle et la suivante
                let currentCurve = segment.curve
                if (segmentIndex + 1 < this.road.length) {
                    const nextCurve = this.road[segmentIndex + 1].curve
                    // Transition en cosinus pour plus de fluidité
                    const t = 0.3 // Facteur de lissage
                    currentCurve = currentCurve * (1 - t) + nextCurve * t
                }
                dx += currentCurve
            }

            if (
                segment.p1.camera.z <= 0 ||
                segment.p2.screen.y >= maxy ||
                segment.p1.screen.w <= 0
            )
                continue

            visibleSegments++

            // Route principale
            g.moveTo(
                segment.p1.screen.x - segment.p1.screen.w,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p1.screen.x + segment.p1.screen.w,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p2.screen.x + segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.lineTo(
                segment.p2.screen.x - segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.closePath()
            g.fill({ color: ROAD_COLOR })

            // Bordures (gauche)
            g.moveTo(
                segment.p1.screen.x - segment.p1.screen.w,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p1.screen.x - segment.p1.screen.w + BORDER_WIDTH,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p2.screen.x - segment.p2.screen.w + BORDER_WIDTH,
                segment.p2.screen.y
            )
            g.lineTo(
                segment.p2.screen.x - segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.closePath()
            g.fill({ color: BORDER_COLOR })

            // Bordures (droite)
            g.moveTo(
                segment.p1.screen.x + segment.p1.screen.w - BORDER_WIDTH,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p1.screen.x + segment.p1.screen.w,
                segment.p1.screen.y
            )
            g.lineTo(
                segment.p2.screen.x + segment.p2.screen.w,
                segment.p2.screen.y
            )
            g.lineTo(
                segment.p2.screen.x + segment.p2.screen.w - BORDER_WIDTH,
                segment.p2.screen.y
            )
            g.closePath()
            g.fill({ color: BORDER_COLOR })

            // Pointillés des lanes (3 lanes avec rectangles animés)
            const DASH_GROUP = DASH_INTERVAL_SEGMENTS + DASH_LENGTH_SEGMENTS

            // Calculer la position absolue des pointillés basée sur la position Z du segment
            const segmentWorldZ = segment.p1.world.z
            const dashCycle = (segmentWorldZ / SEGMENT_LENGTH) % DASH_GROUP
            const isDashVisible = dashCycle < DASH_LENGTH_SEGMENTS

            for (let lane = 1; lane < PLAYER_LANES; lane++) {
                // 2 lignes de pointillés pour 3 lanes
                if (isDashVisible && segment.p1.screen.w > 50) {
                    // segment.p1.screen.w est la demi-largeur, donc largeur complète = 2 * w
                    const laneWidth1 = (2 * segment.p1.screen.w) / PLAYER_LANES
                    const laneWidth2 = (2 * segment.p2.screen.w) / PLAYER_LANES

                    // Position X du centre de la lane
                    const laneX1 =
                        segment.p1.screen.x -
                        segment.p1.screen.w +
                        lane * laneWidth1
                    const laneX2 =
                        segment.p2.screen.x -
                        segment.p2.screen.w +
                        lane * laneWidth2

                    // Largeur des pointillés proportionnelle à la taille de la lane
                    const dashWidth = Math.max(
                        3,
                        Math.min(12, laneWidth1 * 0.15)
                    )

                    // Rectangle de pointillé
                    g.moveTo(laneX1 - dashWidth / 2, segment.p1.screen.y)
                    g.lineTo(laneX1 + dashWidth / 2, segment.p1.screen.y)
                    g.lineTo(laneX2 + dashWidth / 2, segment.p2.screen.y)
                    g.lineTo(laneX2 - dashWidth / 2, segment.p2.screen.y)
                    g.closePath()
                    g.fill({ color: 0xffffff })
                }
            }

            maxy = Math.min(maxy, segment.p2.screen.y)
        }

        // Patch cassure horizon
        if (maxy > HORIZON) {
            g.moveTo(0, HORIZON)
            g.lineTo(screenW, HORIZON)
            g.lineTo(screenW, maxy)
            g.lineTo(0, maxy)
            g.closePath()
            g.fill({ color: ROAD_SIDE_COLOR })
        }

        // Décor (visible sur segments uniquement)
        this.sceneryItems.forEach((item) => {
            // Position Z du décor, en coordonnées du monde
            const worldZ = item.z * (this.road.length * SEGMENT_LENGTH)
            const dz = worldZ - this.scrollPos
            if (dz < 0 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return

            // Décalage latéral (hors de la route)
            const roadX = getRoadCurveOffsetDelta(
                this.road,
                this.scrollPos,
                worldZ
            )
            const offset =
                (item.side === "left" ? -1 : 1) * (ROAD_WIDTH / 2 + item.offset)

            // Projection : on projette le point à la position exacte du décor !
            const point: Point = {
                world: { x: roadX + offset, y: 0, z: worldZ },
                camera: { x: 0, y: 0, z: 0 },
                screen: { x: 0, y: 0, w: 0 },
            }
            project3D(
                point,
                (playerRoadX * ROAD_WIDTH) / 2,
                CAMERA_HEIGHT,
                camZ,
                cameraDepth,
                screenW,
                screenH,
                ROAD_WIDTH
            )

            if (
                point.camera.z > 0 &&
                point.screen.y < screenH &&
                point.screen.y > HORIZON
            ) {
                // Taille relative à la distance réelle (dz)
                const t = dz / (DRAW_DISTANCE * SEGMENT_LENGTH)
                const scale = 0.35 + 0.7 * (1 - t)
                if (item.type === "tree") {
                    g.rect(
                        point.screen.x - 10 * scale,
                        point.screen.y - 60 * scale,
                        20 * scale,
                        60 * scale
                    )
                    g.fill({ color: 0x8b4513 })
                    g.circle(
                        point.screen.x,
                        point.screen.y - 60 * scale,
                        35 * scale
                    )
                    g.fill({ color: TREE_COLOR })
                } else if (item.type === "rock") {
                    g.circle(
                        point.screen.x,
                        point.screen.y - 20 * scale,
                        20 * scale
                    )
                    g.fill({ color: ROCK_COLOR })
                } else if (item.type === "building") {
                    g.rect(
                        point.screen.x - 24 * scale,
                        point.screen.y - 48 * scale,
                        48 * scale,
                        48 * scale
                    )
                    g.fill({ color: BUILDING_COLOR })
                }
            }
        })

        // HUD / vitesse
        g.rect(12, 14, 192, 26)
        g.fill({ color: 0x111111, alpha: 0.75 })

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

        // Player sprite (centré)
        if (this.playerSprite) {
            this.playerSprite.x = this.player.x + PLAYER_WIDTH / 2
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

    public setPaused(paused: boolean) {
        this.paused = paused
    }
}
