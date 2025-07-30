import {
    Application,
    Assets,
    Container,
    Graphics,
    Sprite,
    Text,
    Texture,
    Ticker,
} from "pixi.js"
import {
    ACCELERATION,
    AUTO_DECELERATION,
    BORDER_COLOR,
    BORDER_WIDTH,
    BRAKE,
    BUILDING_COLOR,
    CAMERA_HEIGHT,
    CENTRIFUGAL_FORCE,
    DASH_INTERVAL_SEGMENTS,
    DASH_LENGTH_SEGMENTS,
    DIRT_BORDER,
    DRAW_DISTANCE,
    ENEMY_SPAWN_RATE,
    FIELD_OF_VIEW,
    HORIZON,
    MAX_ENEMIES,
    MAX_SPEED,
    MIN_SPEED,
    MOTO_COLORS,
    PLAYER_LANES,
    PLAYER_LOOK_AHEAD_SEGMENTS,
    PLAYER_MOVE_SPEED,
    PLAYER_TILT_CURVE_RESPONSE,
    PLAYER_TILT_MAX,
    PLAYER_TILT_SPRING,
    PLAYER_Z,
    ROAD_COLOR,
    ROAD_SIDE_COLOR,
    ROAD_SPEED,
    ROAD_WIDTH,
    ROCK_COLOR,
    SCENERY_SCALE_RANGE,
    SEGMENT_LENGTH,
    TERRAIN_FAR_COLOR,
    TERRAIN_FIELD_COLOR,
    TREE_COLOR,
} from "./constants"
import {
    createPlayerState,
    PLAYER_HEIGHT,
    PLAYER_WIDTH,
    updatePlayerPosition,
} from "./Player"
import {
    getProjectedRoadBordersAtPlayerSynced,
    project3D,
} from "./utils/projection"
import { getRoadCurveOffsetDelta, type Point } from "./utils/roadCurve"
import { buildRoadSegments } from "./utils/roadGeneration"

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

export class PixiRoadRashEngine {
    private app: Application | null = null
    private container: HTMLElement | null = null
    private paused: boolean = false

    private debugText: Text | null = null
    private showDebug: boolean = true

    // Game state
    private player: PlayerState
    private speed: number
    private scrollPos: number
    private isAccelerating: boolean = false
    private isBraking: boolean = false
    private sceneryItems: SceneryItem[] = []
    private enemies: Enemy[] = []
    private lastEnemySpawn: number = 0
    private currentTilt: number = 0 // Nouvelle propriété pour suivre l'inclinaison

    private road = buildRoadSegments()
    private backgroundSprite: Sprite | null = null
    private playerSprite: Sprite | null = null
    private graphics: Graphics | null = null

    private backgroundTexture: Texture | null = null
    private playerTexture: Texture | null = null

    private finished: boolean = false

    // Textes de victoire
    private victoryText: Text | null = null
    private restartText: Text | null = null
    private pauseText: Text | null = null

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

        // Textes de victoire (cachés par défaut)
        this.victoryText = new Text({
            text: "END!",
            style: {
                fontFamily: "Arial Black",
                fontSize: 48,
                fill: 0xffffff,
                align: "center",
            },
        })
        this.victoryText.anchor.set(0.5)
        this.victoryText.visible = false
        root.addChild(this.victoryText)

        this.restartText = new Text({
            text: "Press R to restart",
            style: {
                fontFamily: "Arial",
                fontSize: 24,
                fill: 0x333333,
                align: "center",
            },
        })
        this.restartText.anchor.set(0.5)
        this.restartText.visible = false
        root.addChild(this.restartText)

        // Texte de pause (caché par défaut)
        this.pauseText = new Text({
            text: "PAUSE",
            style: {
                fontFamily: "Arial Black",
                fontSize: 64,
                fill: 0xffffff,
                align: "center",
            },
        })
        this.pauseText.anchor.set(0.5)
        this.pauseText.visible = false
        root.addChild(this.pauseText)

        /** DEBUG */
        this.debugText = new Text({
            text: "",
            style: {
                fontFamily: "Consolas, monospace",
                fontSize: 18,
                fill: 0xffcc00,
                align: "left",
                stroke: 0x222222,
            },
        })
        this.debugText.anchor.set(0, 0)
        this.debugText.x = 14
        this.debugText.y = 54
        this.debugText.visible = this.showDebug
        root.addChild(this.debugText)

        // Décor aléatoire - beaucoup plus d'éléments pour la route longue
        this.sceneryItems = []
        for (let i = 0; i < 500; i++) {
            // 5x plus d'éléments de décor
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

    private restart() {
        // Remettre tous les paramètres à zéro
        this.finished = false
        this.paused = false
        this.speed = ROAD_SPEED
        this.scrollPos = 0
        this.isAccelerating = false
        this.isBraking = false
        this.enemies = []
        this.lastEnemySpawn = 0

        // Remettre le joueur à sa position initiale
        this.player = createPlayerState()

        // Remettre la caméra à zéro
        this.cameraSmoothing.targetX = 0
        this.cameraSmoothing.currentX = 0

        // Cacher les textes de victoire
        if (this.victoryText) this.victoryText.visible = false
        if (this.restartText) this.restartText.visible = false
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.finished) {
            // Permettre le redémarrage avec R
            if (e.key === "r" || e.key === "R") {
                this.restart()
            }
            return
        }
        if (e.key === " " || e.key === "p" || e.key === "P") {
            this.paused = !this.paused
            return
        }

        if (e.key === "d" || e.key === "D") {
            this.showDebug = !this.showDebug
            if (this.debugText) this.debugText.visible = this.showDebug
        }

        // Test de démonstration offroad (touche T pour droite, Y pour gauche)
        if (e.key === "t" || e.key === "T") {
            // Forcer le joueur temporairement hors route côté droit
            this.player.x = window.innerWidth * 0.9
        }

        if (e.key === "y" || e.key === "Y") {
            // Forcer le joueur temporairement hors route côté gauche
            this.player.x = -PLAYER_WIDTH / 2
        }

        // Recentrer le joueur (touche C)
        // Recentrer le joueur (touche C)
        if (e.key === "c" || e.key === "C") {
            // Utilise la même logique que pour le offroad !
            const cameraDepth =
                1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
            const playerZ = this.scrollPos + PLAYER_Z
            const { roadLeft, roadRight } =
                getProjectedRoadBordersAtPlayerSynced(
                    this.road,
                    this.scrollPos,
                    playerZ,
                    cameraDepth,
                    window.innerWidth,
                    window.innerHeight,
                    ROAD_WIDTH,
                    this.player.x,
                    PLAYER_WIDTH,
                    this.cameraSmoothing
                )
            const roadCenter = (roadLeft + roadRight) / 2
            this.player.x = roadCenter - PLAYER_WIDTH / 2
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
            nextSpeed = Math.max(MIN_SPEED, this.speed - BRAKE * deltaTime)
        this.speed = nextSpeed
        const speedFactor = nextSpeed / ROAD_SPEED

        if (!this.isAccelerating && !this.isBraking) {
            nextSpeed = Math.max(
                MIN_SPEED,
                this.speed - AUTO_DECELERATION * deltaTime
            )
        }

        // Effet offroad : décélération brutale si le joueur est hors route
        if (this.player.isOffRoad) {
            this.speed = Math.max(
                MIN_SPEED,
                this.speed - this.speed * 0.02 * deltaTime // Perte progressive de vitesse
            )

            // Vibration du joueur offroad (effet visuel)
            if (this.playerSprite) {
                const vibrationIntensity = Math.min(this.speed / 1000, 1) * 3
                this.playerSprite.x +=
                    (Math.random() - 0.5) * vibrationIntensity
                this.playerSprite.y +=
                    (Math.random() - 0.5) * vibrationIntensity
            }
        }

        // Trouver le segment actuel du joueur
        const currentSegmentIndex =
            Math.floor((this.scrollPos + PLAYER_Z) / SEGMENT_LENGTH) %
            this.road.length
        const playerSegment = this.road[currentSegmentIndex]

        // Déplacement latéral plus doux
        const moveSpeed = PLAYER_MOVE_SPEED * deltaTime * (speedFactor / 5)
        if (this.player.isMovingLeft) {
            this.player.x -= moveSpeed * ROAD_WIDTH
        } else if (this.player.isMovingRight) {
            this.player.x += moveSpeed * ROAD_WIDTH
        }

        // Force centrifuge plus douce
        const centrifugalForce =
            moveSpeed *
            (speedFactor / 5) *
            playerSegment.curve *
            CENTRIFUGAL_FORCE *
            ROAD_WIDTH
        this.player.x -= centrifugalForce

        // Anticiper les virages à venir en regardant plusieurs segments devant
        let upcomingCurve = 0
        let totalWeight = 0
        for (let i = 0; i < PLAYER_LOOK_AHEAD_SEGMENTS; i++) {
            const lookAheadIndex = (currentSegmentIndex + i) % this.road.length
            const segment = this.road[lookAheadIndex]
            // Distribution exponentielle du poids pour une réponse plus rapide aux virages immédiats
            const weight = Math.pow(0.7, i)
            upcomingCurve += segment.curve * weight
            totalWeight += weight
        }
        upcomingCurve /= totalWeight // Normalisation par le poids total

        // Calcul de l'inclinaison cible avec plus de réactivité aux changements de direction
        const targetTilt =
            upcomingCurve * PLAYER_TILT_CURVE_RESPONSE * (speedFactor / 4)

        // Application d'un effet ressort plus rapide
        const tiltDiff = targetTilt - this.currentTilt
        this.currentTilt +=
            tiltDiff * PLAYER_TILT_SPRING * deltaTime * (1 + speedFactor * 0.5) // Plus rapide à haute vitesse

        // Limiter l'inclinaison maximale
        this.currentTilt = Math.max(
            Math.min(this.currentTilt, PLAYER_TILT_MAX),
            -PLAYER_TILT_MAX
        )

        // Appliquer l'inclinaison au sprite du joueur
        if (this.playerSprite) {
            this.playerSprite.rotation = this.currentTilt
        }

        // Mise à jour position avec limites
        this.player = updatePlayerPosition(this.player, deltaTime)

        // Juste après avoir bougé le joueur:
        const cameraDepth = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
        const playerZ = this.scrollPos + PLAYER_Z

        const { roadLeft, roadRight } = getProjectedRoadBordersAtPlayerSynced(
            this.road,
            this.scrollPos,
            playerZ,
            cameraDepth,
            window.innerWidth,
            window.innerHeight,
            ROAD_WIDTH,
            this.player.x,
            PLAYER_WIDTH,
            this.cameraSmoothing
        )

        const playerLeftEdge = this.player.x
        const playerRightEdge = this.player.x + PLAYER_WIDTH
        const tolerance = 6
        const routeMin = roadLeft + tolerance
        const routeMax = roadRight - tolerance

        // S'il n'y a PAS de chevauchement
        this.player.isOffRoad =
            playerRightEdge < routeMin || playerLeftEdge > routeMax

        // Scroll route (NE DÉPASSE PAS la fin du circuit)
        const maxScroll = (this.road.length - DRAW_DISTANCE) * SEGMENT_LENGTH
        this.scrollPos += nextSpeed * deltaTime

        if (this.scrollPos >= maxScroll) {
            this.scrollPos = maxScroll
            this.speed = 0
            this.finished = true // ARRIVÉE !
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

        // Sol/herbe de base (sera recouvert par les segments de terrain)
        g.rect(0, HORIZON, screenW, screenH - HORIZON)
        g.fill({ color: ROAD_SIDE_COLOR })

        let visibleSegments = 0

        // Position fractionnaire dans le segment actuel pour l'interpolation
        const currentSegmentProgress =
            (this.scrollPos % SEGMENT_LENGTH) / SEGMENT_LENGTH

        const firstSegment = this.road[baseSegmentIndex % this.road.length]
        dx += firstSegment.curve * (1 - currentSegmentProgress)
        x += dx

        for (let n = 0; n < DRAW_DISTANCE; n++) {
            const segmentIndex = baseSegmentIndex + n
            if (segmentIndex >= this.road.length) break
            const segment = this.road[segmentIndex]

            // Calcul de la distance relative pour les effets de perspective
            const distancePercent = n / DRAW_DISTANCE
            const fogFactor = 1 - Math.pow(distancePercent, 8 / 10)

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

            // Conditions de rendu améliorées pour la distance
            const isBehindCamera = segment.p1.camera.z <= 0
            const isClippedByPrevious = segment.p2.screen.y >= maxy
            const isTooSmall = segment.p1.screen.w < 2
            const isAtHorizon = segment.p2.screen.y <= HORIZON + 5

            if (isBehindCamera || (isClippedByPrevious && !isAtHorizon))
                continue

            visibleSegments++

            // Route principale avec effet de distance
            let roadColor = ROAD_COLOR
            let roadAlpha = 1

            // Effet de brouillard progressif vers l'horizon
            if (distancePercent > 0.4) {
                const fadeAmount = (distancePercent - 0.4) / 0.6
                // Mélange entre couleur route et couleur horizon
                const r1 = (ROAD_COLOR >> 16) & 0xff
                const g1 = (ROAD_COLOR >> 8) & 0xff
                const b1 = ROAD_COLOR & 0xff
                const r2 = (0x87ceeb >> 16) & 0xff // Couleur horizon bleu ciel
                const g2 = (0x87ceeb >> 8) & 0xff
                const b2 = 0x87ceeb & 0xff

                const r = Math.round(r1 * (1 - fadeAmount) + r2 * fadeAmount)
                const g = Math.round(g1 * (1 - fadeAmount) + g2 * fadeAmount)
                const b = Math.round(b1 * (1 - fadeAmount) + b2 * fadeAmount)

                roadColor = (r << 16) | (g << 8) | b
                roadAlpha = Math.max(0.3, 1 - fadeAmount * 0.7)
            }

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
            g.fill({ color: roadColor, alpha: roadAlpha })

            // Bordures avec effet de distance (plus visibles)
            if (segment.p1.screen.w > 10) {
                // Ne dessiner les bordures que si assez larges

                // Bordures de sécurité renforcées pour mieux marquer les limites
                const enhancedBorderWidth =
                    BORDER_WIDTH * Math.max(1, 2 - distancePercent)

                // Bordure de terre (gauche) - plus large pour être plus visible
                g.moveTo(
                    segment.p1.screen.x -
                        segment.p1.screen.w -
                        enhancedBorderWidth * DIRT_BORDER.WIDTH_FACTOR * 1.5,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x - segment.p1.screen.w,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x - segment.p2.screen.w,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x -
                        segment.p2.screen.w -
                        enhancedBorderWidth * DIRT_BORDER.WIDTH_FACTOR * 1.5,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({
                    color: DIRT_BORDER.COLOR,
                    alpha: Math.min(1, DIRT_BORDER.ALPHA * roadAlpha * 1.5),
                })

                // Bordure de terre (droite)
                g.moveTo(
                    segment.p1.screen.x + segment.p1.screen.w,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x +
                        segment.p1.screen.w +
                        enhancedBorderWidth * DIRT_BORDER.WIDTH_FACTOR * 1.5,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x +
                        segment.p2.screen.w +
                        enhancedBorderWidth * DIRT_BORDER.WIDTH_FACTOR * 1.5,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x + segment.p2.screen.w,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({
                    color: DIRT_BORDER.COLOR,
                    alpha: Math.min(1, DIRT_BORDER.ALPHA * roadAlpha * 1.5),
                })

                // Bordures principales (gauche) - plus épaisses et contrastées
                g.moveTo(
                    segment.p1.screen.x - segment.p1.screen.w,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x -
                        segment.p1.screen.w +
                        enhancedBorderWidth,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x -
                        segment.p2.screen.w +
                        enhancedBorderWidth,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x - segment.p2.screen.w,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({ color: BORDER_COLOR, alpha: roadAlpha })

                // Ligne de sécurité interne (gauche) - ligne rouge pour marquer vraiment le bord
                g.moveTo(
                    segment.p1.screen.x -
                        segment.p1.screen.w +
                        enhancedBorderWidth * 0.8,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x -
                        segment.p1.screen.w +
                        enhancedBorderWidth,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x -
                        segment.p2.screen.w +
                        enhancedBorderWidth,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x -
                        segment.p2.screen.w +
                        enhancedBorderWidth * 0.8,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({ color: 0xff3333, alpha: roadAlpha * 0.7 })

                // Bordures principales (droite)
                g.moveTo(
                    segment.p1.screen.x +
                        segment.p1.screen.w -
                        enhancedBorderWidth,
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
                    segment.p2.screen.x +
                        segment.p2.screen.w -
                        enhancedBorderWidth,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({ color: BORDER_COLOR, alpha: roadAlpha })

                // Ligne de sécurité interne (droite)
                g.moveTo(
                    segment.p1.screen.x +
                        segment.p1.screen.w -
                        enhancedBorderWidth,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x +
                        segment.p1.screen.w -
                        enhancedBorderWidth * 0.8,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x +
                        segment.p2.screen.w -
                        enhancedBorderWidth * 0.8,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x +
                        segment.p2.screen.w -
                        enhancedBorderWidth,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({ color: 0xff3333, alpha: roadAlpha * 0.7 })
            }

            // Pointillés des lanes (3 lanes avec rectangles animés)
            const DASH_GROUP = DASH_INTERVAL_SEGMENTS + DASH_LENGTH_SEGMENTS

            // Calculer la position absolue des pointillés basée sur la position Z du segment
            const segmentWorldZ = segment.p1.world.z
            const dashCycle = (segmentWorldZ / SEGMENT_LENGTH) % DASH_GROUP
            const isDashVisible = dashCycle < DASH_LENGTH_SEGMENTS

            for (let lane = 1; lane < PLAYER_LANES; lane++) {
                // 2 lignes de pointillés pour 3 lanes
                if (isDashVisible && segment.p1.screen.w > 8) {
                    // Seuil plus bas pour voir plus loin
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
                    g.fill({ color: 0xffffff, alpha: roadAlpha })
                }
            }

            // Lignes grises foncées au centre de chaque lane
            if (segment.p1.screen.w > 5) {
                // Seuil plus bas pour voir plus loin
                const laneWidth1 = (2 * segment.p1.screen.w) / PLAYER_LANES
                const laneWidth2 = (2 * segment.p2.screen.w) / PLAYER_LANES

                for (let lane = 0; lane < PLAYER_LANES; lane++) {
                    // Position du centre de chaque lane
                    const laneCenterX1 =
                        segment.p1.screen.x -
                        segment.p1.screen.w +
                        (lane + 0.5) * laneWidth1
                    const laneCenterX2 =
                        segment.p2.screen.x -
                        segment.p2.screen.w +
                        (lane + 0.5) * laneWidth2

                    // Largeur de la ligne grise élargie et plus subtile (12x plus large)
                    const baseLineWidth = Math.max(
                        36,
                        Math.min(96, laneWidth1 * 0.96)
                    )

                    // Réduction progressive de la largeur vers l'horizon
                    const distanceFactor = Math.max(
                        0.2,
                        1 -
                            segment.p1.camera.z /
                                (DRAW_DISTANCE * SEGMENT_LENGTH * 0.5)
                    )
                    const lineWidth = baseLineWidth * distanceFactor

                    // Effet de flou avec plus de couches superposées pour un meilleur dégradé
                    for (let i = 0; i < 5; i++) {
                        const blurWidth = lineWidth * (1 - i * 0.15) // Réduction plus progressive de la largeur
                        const alpha = 0.08 * Math.pow(0.8, i) // Décroissance exponentielle de l'opacité

                        g.moveTo(
                            laneCenterX1 - blurWidth / 2,
                            segment.p1.screen.y
                        )
                        g.lineTo(
                            laneCenterX1 + blurWidth / 2,
                            segment.p1.screen.y
                        )
                        g.lineTo(
                            laneCenterX2 + (blurWidth * distanceFactor) / 2,
                            segment.p2.screen.y
                        )
                        g.lineTo(
                            laneCenterX2 - (blurWidth * distanceFactor) / 2,
                            segment.p2.screen.y
                        )
                        g.closePath()
                        g.fill({ color: 0x404040, alpha: alpha * roadAlpha }) // Gris plus clair avec transparence progressive et effet distance
                    }
                }
            }

            // Affichage du FINISH sur le dernier segment
            if (segmentIndex >= this.road.length - 2) {
                const width = segment.p1.screen.w * 1.5
                const height = width * 0.2

                // Rectangle blanc de base (avec ombre)
                g.rect(
                    segment.p1.screen.x - width / 2 + 4,
                    segment.p1.screen.y - height * 1.5 + 4,
                    width,
                    height
                )
                g.fill({ color: 0x000000, alpha: 0.5 }) // Ombre

                // Rectangle blanc de base
                g.rect(
                    segment.p1.screen.x - width / 2,
                    segment.p1.screen.y - height * 1.5,
                    width,
                    height
                )
                g.fill({ color: 0xffffff })

                // Rectangle rouge plus petit par dessus
                g.rect(
                    segment.p1.screen.x - width / 2 + 4,
                    segment.p1.screen.y - height * 1.5 + 4,
                    width - 8,
                    height - 8
                )
                g.fill({ color: 0xff0000 })

                // Rectangle blanc central pour l'effet
                g.rect(
                    segment.p1.screen.x - width / 3,
                    segment.p1.screen.y - height * 1.5 + 4,
                    width / 1.5,
                    height - 8
                )
                g.fill({ color: 0xffffff, alpha: 0.7 })
            }

            maxy = Math.min(maxy, segment.p2.screen.y)
        }

        // Segments de terrain en perspective (style Road Rash)
        // Redessiner les segments visibles avec extension du terrain latéral
        for (let n = 0; n < visibleSegments; n++) {
            const segmentIndex = baseSegmentIndex + n
            if (segmentIndex >= this.road.length) break
            const segment = this.road[segmentIndex]

            if (
                segment.p1.camera.z <= 0 ||
                segment.p2.screen.y >= maxy ||
                segment.p1.screen.w <= 0
            )
                continue

            // Terrain latéral avec perspective (extension de la route vers l'horizon)
            const terrainWidth = segment.p1.screen.w * 4 // 4x plus large que la route pour plus d'immersion

            // Variation de couleur basée sur la distance et position pour plus de réalisme
            const distanceFactor = Math.min(
                1,
                segment.p1.camera.z / (DRAW_DISTANCE * SEGMENT_LENGTH * 0.3)
            )

            // Alternance de couleurs pour simuler des champs différents
            const fieldVariation = Math.floor(segmentIndex / 8) % 3
            let terrainColor = ROAD_SIDE_COLOR

            if (distanceFactor > 0.8) {
                terrainColor = TERRAIN_FAR_COLOR // Très loin = vert foncé
            } else if (distanceFactor > 0.4) {
                terrainColor =
                    fieldVariation === 0 ? TERRAIN_FIELD_COLOR : ROAD_SIDE_COLOR // Champs alternés
            }

            // Terrain gauche
            g.moveTo(0, segment.p1.screen.y)
            g.lineTo(segment.p1.screen.x - terrainWidth, segment.p1.screen.y)
            g.lineTo(
                segment.p2.screen.x -
                    terrainWidth * (segment.p2.screen.w / segment.p1.screen.w),
                segment.p2.screen.y
            )
            g.lineTo(0, segment.p2.screen.y)
            g.closePath()
            g.fill({ color: terrainColor })

            // Terrain droit
            g.moveTo(segment.p1.screen.x + terrainWidth, segment.p1.screen.y)
            g.lineTo(screenW, segment.p1.screen.y)
            g.lineTo(screenW, segment.p2.screen.y)
            g.lineTo(
                segment.p2.screen.x +
                    terrainWidth * (segment.p2.screen.w / segment.p1.screen.w),
                segment.p2.screen.y
            )
            g.closePath()
            g.fill({ color: terrainColor })
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

            // Décalage latéral (bien plus loin de la route)
            const roadX = getRoadCurveOffsetDelta(
                this.road,
                this.scrollPos,
                worldZ
            )
            const offset =
                (item.side === "left" ? -1 : 1) *
                (ROAD_WIDTH / 2 + item.offset + 300)

            // Projection : on projette le point à la position exacte du décor !
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
                // Combine distance Z et position Y pour une échelle correcte
                const distancePercent = dz / (DRAW_DISTANCE * SEGMENT_LENGTH)
                const screenYPercent =
                    (point.screen.y - HORIZON) / (screenH - HORIZON)

                // L'échelle est influencée par les deux facteurs
                // - distancePercent contrôle l'apparition lointaine
                // - screenYPercent contrôle la perspective à l'écran
                const distanceScale = Math.pow(1 - distancePercent, 2) // Quadratique pour apparition progressive
                const perspectiveScale = Math.pow(
                    screenYPercent,
                    1 / SCENERY_SCALE_RANGE.CURVE
                )

                // On prend le minimum des deux pour assurer que les objets sont petits au loin
                const scaleProgress = Math.min(distanceScale, perspectiveScale)

                const scale =
                    SCENERY_SCALE_RANGE.MIN +
                    (SCENERY_SCALE_RANGE.MAX *
                        SCENERY_SCALE_RANGE.PLAYER_LEVEL -
                        SCENERY_SCALE_RANGE.MIN) *
                        scaleProgress

                if (item.type === "tree") {
                    // Tronc avec nouvelle échelle
                    const trunkWidth = 50 * scale
                    const trunkHeight = 150 * scale
                    g.rect(
                        point.screen.x - trunkWidth / 2,
                        point.screen.y - trunkHeight,
                        trunkWidth,
                        trunkHeight
                    )
                    g.fill({ color: 0x8b4513 })

                    // Feuillage avec nouvelle échelle
                    const foliageRadius = 105 * scale
                    g.circle(
                        point.screen.x,
                        point.screen.y - trunkHeight,
                        foliageRadius
                    )
                    g.fill({ color: TREE_COLOR })
                } else if (item.type === "rock") {
                    const rockRadius = 20 * scale
                    g.circle(
                        point.screen.x,
                        point.screen.y - rockRadius,
                        rockRadius
                    )
                    g.fill({ color: ROCK_COLOR })
                } else if (item.type === "building") {
                    const buildingSize = 48 * scale
                    g.rect(
                        point.screen.x - buildingSize / 2,
                        point.screen.y - buildingSize,
                        buildingSize,
                        buildingSize
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

        // Ombre du joueur
        if (this.playerSprite) {
            const shadowX = this.player.x + PLAYER_WIDTH / 2
            const shadowY = this.player.y + PLAYER_HEIGHT * 0.9

            // Ellipse d'ombre floue
            g.ellipse(shadowX, shadowY, PLAYER_WIDTH / 5, PLAYER_HEIGHT * 0.1)
            g.fill({ color: 0x000000, alpha: 0.3 }) // Noir semi-transparent
        }

        // Player sprite (centré)
        if (this.playerSprite) {
            this.playerSprite.x = this.player.x + PLAYER_WIDTH / 2
            this.playerSprite.y = this.player.y + PLAYER_HEIGHT / 2
            this.playerSprite.rotation = this.currentTilt
        }

        // Écran de victoire quand le jeu est terminé
        if (this.finished) {
            // Fond semi-transparent
            g.rect(0, 0, screenW, screenH)
            g.fill({ color: 0x000000, alpha: 0.8 })

            // Rectangle principal simple
            const boxWidth = 400
            const boxHeight = 200
            const boxX = (screenW - boxWidth) / 2
            const boxY = (screenH - boxHeight) / 2

            // Rectangle de victoire simple
            g.rect(boxX, boxY, boxWidth, boxHeight)
            g.fill({ color: 0xffffff })

            // Bordure
            g.rect(boxX + 5, boxY + 5, boxWidth - 10, boxHeight - 10)
            g.fill({ color: 0x00aa00 })

            // Afficher et positionner les textes
            if (this.victoryText) {
                this.victoryText.visible = true
                this.victoryText.x = screenW / 2
                this.victoryText.y = boxY + 80
            }

            if (this.restartText) {
                this.restartText.visible = true
                this.restartText.x = screenW / 2
                this.restartText.y = boxY + 140
            }
        } else {
            // Cacher les textes quand le jeu n'est pas terminé
            if (this.victoryText) this.victoryText.visible = false
            if (this.restartText) this.restartText.visible = false
        }

        if (this.debugText && this.showDebug) {
            // Calcul des données utiles pour debug :
            const screenW = window.innerWidth

            const playerZ = this.scrollPos + PLAYER_Z
            const cameraDepth =
                1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
            const { roadLeft, roadRight } =
                getProjectedRoadBordersAtPlayerSynced(
                    this.road,
                    this.scrollPos,
                    playerZ,
                    cameraDepth,
                    screenW,
                    screenH,
                    ROAD_WIDTH,
                    this.player.x,
                    PLAYER_WIDTH,
                    this.cameraSmoothing
                )

            // Trouver le segment “sous” le joueur :
            const segIndex =
                Math.floor(playerZ / SEGMENT_LENGTH) % this.road.length
            const seg = this.road[segIndex]
            const curve = seg.curve

            // Calculer la largeur route à la position du joueur (cf. projection)
            const roadWidthAtPlayer = ROAD_WIDTH / 2

            // Centre du joueur (pour test collision/bordure)
            const playerCenterX = this.player.x + PLAYER_WIDTH / 2

            if (this.showDebug && this.graphics) {
                // BORDURES LOGIQUES DE LA ROUTE (lignes épaisses rouges)
                const debugHeight = 120

                // Ligne verticale gauche
                g.beginPath()
                g.lineStyle(4, 0xff0000)
                g.moveTo(roadLeft, screenH - debugHeight)
                g.lineTo(roadLeft, screenH)
                g.stroke()

                // Ligne verticale droite
                g.beginPath()
                g.lineStyle(4, 0xff0000)
                g.moveTo(roadRight, screenH - debugHeight)
                g.lineTo(roadRight, screenH)
                g.stroke()

                // Zone de tolérance (lignes oranges)
                const tolerance = 6

                // Tolérance gauche
                g.beginPath()
                g.lineStyle(2, 0xff8800)
                g.moveTo(roadLeft + tolerance, screenH - debugHeight + 10)
                g.lineTo(roadLeft + tolerance, screenH - 10)
                g.stroke()

                // Tolérance droite
                g.beginPath()
                g.lineStyle(2, 0xff8800)
                g.moveTo(roadRight - tolerance, screenH - debugHeight + 10)
                g.lineTo(roadRight - tolerance, screenH - 10)
                g.stroke()

                // Hitbox du joueur (rectangle rouge)
                const playerLeftEdge = this.player.x
                const playerRightEdge = this.player.x + PLAYER_WIDTH
                const playerTopEdge = this.player.y
                const playerBottomEdge = this.player.y + PLAYER_HEIGHT

                g.beginPath()
                g.lineStyle(2, 0xff0000)
                g.moveTo(playerLeftEdge, playerTopEdge)
                g.lineTo(playerRightEdge, playerTopEdge)
                g.lineTo(playerRightEdge, playerBottomEdge)
                g.lineTo(playerLeftEdge, playerBottomEdge)
                g.lineTo(playerLeftEdge, playerTopEdge)
                g.stroke()

                // Point central (petit cercle)
                g.beginPath()
                g.lineStyle(1, 0xff0000)
                g.drawCircle(
                    playerCenterX,
                    this.player.y + PLAYER_HEIGHT / 2,
                    3
                )
                g.stroke()

                // Indicateur offroad (rectangle rouge clignotant)
                if (this.player.isOffRoad) {
                    const blinkIntensity =
                        Math.sin(Date.now() * 0.01) * 0.5 + 0.5
                    g.rect(screenW - 200, 20, 180, 30)
                    g.fill({
                        color: 0xff0000,
                        alpha: 0.3 + blinkIntensity * 0.4,
                    })
                }
            }

            // Pourcentage position du joueur sur la largeur de la route (0 = gauche, 1 = droite)
            let posPct = 0
            const routeWidth = roadRight - roadLeft
            if (Math.abs(routeWidth) > 10) {
                // Seuil plus élevé pour éviter divisions par des très petits nombres
                posPct = (playerCenterX - roadLeft) / routeWidth
            } else {
                posPct = 0.5 // Défaut : centre de la route si calcul impossible
            }

            // Données détaillées pour le debug
            const playerLeftEdge = this.player.x
            const playerRightEdge = this.player.x + PLAYER_WIDTH
            const tolerance = 5
            const isLeftOut = playerRightEdge < roadLeft + tolerance
            const isRightOut = playerLeftEdge > roadRight - tolerance

            console.log("DEBUG COLLISION", {
                playerLeft: this.player.x,
                playerRight: this.player.x + PLAYER_WIDTH,
                routeMin: roadLeft + tolerance,
                routeMax: roadRight - tolerance,
                routeWidth: roadRight - roadLeft,
            })

            this.debugText.text =
                `Position joueur: X=${this.player.x.toFixed(
                    1
                )} | Centre=${playerCenterX.toFixed(1)}\n` +
                `Limites joueur: ${playerLeftEdge.toFixed(
                    1
                )} ↔ ${playerRightEdge.toFixed(
                    1
                )} (largeur=${PLAYER_WIDTH})\n` +
                `Bordures route: ${roadLeft.toFixed(1)} ↔ ${roadRight.toFixed(
                    1
                )} (largeur=${routeWidth.toFixed(1)})\n` +
                `Position sur route: ${(posPct * 100).toFixed(
                    1
                )}% | Offset centre: ${(playerCenterX - roadLeft).toFixed(
                    1
                )}px\n` +
                `Segment: ${segIndex}/${
                    this.road.length
                } | Courbe: ${curve.toFixed(2)}\n` +
                `${this.player.isOffRoad ? "🔴 OFFROAD!" : "✅ Sur la route"} ${
                    isLeftOut
                        ? "(trop à gauche)"
                        : isRightOut
                        ? "(trop à droite)"
                        : ""
                }\n` +
                `Vitesse: ${this.speed.toFixed(
                    0
                )} | Scroll: ${this.scrollPos.toFixed(0)}\n` +
                `Debug calc: roadW=${ROAD_WIDTH} | camDepth=${cameraDepth.toFixed(
                    1
                )} | segIdx=${segIndex}\n` +
                `Contrôles: D=debug | T=offroad droite | Y=offroad gauche | C=recentrer | P=pause\n` +
                `Debug: ROUGE=bords route (SYNCHRO!) | ORANGE=tolérance | VERT=centre | JAUNE=limites joueur`
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
