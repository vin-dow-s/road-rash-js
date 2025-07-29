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
    MOTO_COLORS,
    PLAYER_LANES,
    PLAYER_LOOK_AHEAD_SEGMENTS,
    PLAYER_MOVE_SPEED,
    PLAYER_TILT_CURVE_RESPONSE,
    PLAYER_TILT_MAX,
    PLAYER_TILT_SPRING,
    PLAYER_Z,
    ROAD,
    ROAD_COLOR,
    ROAD_SIDE_COLOR,
    ROAD_SPEED,
    ROAD_WIDTH,
    ROCK_COLOR,
    RUMBLE_LENGTH,
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

// --- FONCTIONS D'EASING POUR LES COURBES (méthode Jake Gordon) ---
function easeIn(a: number, b: number, percent: number): number {
    return a + (b - a) * Math.pow(percent, 2)
}

function easeOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (1 - Math.pow(1 - percent, 2))
}

function easeInOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5)
}

// --- GÉNÉRATION DE ROUTE À LA JAKE GORDON ---
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

    // Fonction pour ajouter une section de route avec easing (comme Jake Gordon)
    function addRoad(
        enter: number,
        hold: number,
        leave: number,
        curve: number
    ) {
        let n: number
        for (n = 0; n < enter; n++) {
            addSegment(easeIn(0, curve, n / enter))
        }
        for (n = 0; n < hold; n++) {
            addSegment(curve)
        }
        for (n = 0; n < leave; n++) {
            addSegment(easeInOut(curve, 0, n / leave))
        }
    }

    // Fonctions d'aide pour différents types de sections
    function addStraight(num?: number) {
        num = num || ROAD.LENGTH.MEDIUM
        addRoad(num, num, num, 0)
    }

    function addCurve(num?: number, curve?: number) {
        num = num || ROAD.LENGTH.MEDIUM
        curve = curve || ROAD.CURVE.MEDIUM
        addRoad(num, num, num, curve)
    }

    function addSCurves() {
        addRoad(
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            -ROAD.CURVE.EASY
        )
        addRoad(
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.CURVE.MEDIUM
        )
        addRoad(
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.CURVE.EASY
        )
        addRoad(
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            -ROAD.CURVE.EASY
        )
        addRoad(
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            ROAD.LENGTH.MEDIUM,
            -ROAD.CURVE.MEDIUM
        )
    }

    function addBigSCurves() {
        addRoad(
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            -ROAD.CURVE.MEDIUM
        )
        addRoad(
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.CURVE.HARD
        )
        addRoad(
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.CURVE.MEDIUM
        )
        addRoad(
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            -ROAD.CURVE.HARD
        )
        addRoad(
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            ROAD.LENGTH.LONG,
            -ROAD.CURVE.EASY
        )
    }

    function addChicanes() {
        addRoad(
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.CURVE.HARD
        )
        addRoad(
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            -ROAD.CURVE.HARD
        )
        addRoad(
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.CURVE.MEDIUM
        )
        addRoad(
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            ROAD.LENGTH.SHORT,
            -ROAD.CURVE.MEDIUM
        )
    }

    // --- CONSTRUCTION DE LA ROUTE LONGUE ET VARIÉE ---
    // Départ avec une ligne droite
    addStraight(ROAD.LENGTH.SHORT / 4)

    // Section 1: Introduction progressive
    addSCurves()
    addStraight(ROAD.LENGTH.LONG)
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.EASY)
    addStraight(ROAD.LENGTH.MEDIUM)

    // Section 2: Montée en difficulté
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM)
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM)
    addStraight(ROAD.LENGTH.VERY_LONG)
    addBigSCurves()

    // Section 3: Chicanes rapides
    addStraight(ROAD.LENGTH.LONG)
    addChicanes()
    addStraight(ROAD.LENGTH.MEDIUM)
    addChicanes()

    // Section 4: Courbes longues et fluides
    addStraight(ROAD.LENGTH.LONG)
    addCurve(ROAD.LENGTH.VERY_LONG, ROAD.CURVE.EASY)
    addCurve(ROAD.LENGTH.VERY_LONG, -ROAD.CURVE.EASY)
    addStraight(ROAD.LENGTH.LONG)

    // Section 5: Mix complexe
    addSCurves()
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.HARD)
    addStraight(ROAD.LENGTH.MEDIUM)
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.HARD)
    addBigSCurves()

    // Section 6: Courbes extrêmes
    addStraight(ROAD.LENGTH.VERY_LONG)
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.EXTREME)
    addStraight(ROAD.LENGTH.SHORT)
    addCurve(ROAD.LENGTH.MEDIUM, -ROAD.CURVE.EXTREME)
    addStraight(ROAD.LENGTH.LONG)

    // Section 7: Finale technique
    addChicanes()
    addSCurves()
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM)
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM)
    addStraight(ROAD.LENGTH.VERY_LONG)

    // Section 8: Sprint final
    addBigSCurves()
    addStraight(ROAD.LENGTH.VERY_LONG)
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.EASY)
    addStraight(ROAD.LENGTH.LONG)

    // Ligne d'arrivée
    addStraight(ROAD.LENGTH.MEDIUM)

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
        this.player = updatePlayerPosition(
            this.player,
            deltaTime,
            window.innerWidth / 2,
            ROAD_WIDTH / 2
        )

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

            // Bordures avec effet de distance
            if (segment.p1.screen.w > 10) {
                // Ne dessiner les bordures que si assez larges
                // Bordure de terre (gauche)
                g.moveTo(
                    segment.p1.screen.x -
                        segment.p1.screen.w -
                        BORDER_WIDTH * DIRT_BORDER.WIDTH_FACTOR,
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
                        BORDER_WIDTH * DIRT_BORDER.WIDTH_FACTOR,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({
                    color: DIRT_BORDER.COLOR,
                    alpha: DIRT_BORDER.ALPHA * roadAlpha,
                })

                // Bordure de terre (droite)
                g.moveTo(
                    segment.p1.screen.x + segment.p1.screen.w,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p1.screen.x +
                        segment.p1.screen.w +
                        BORDER_WIDTH * DIRT_BORDER.WIDTH_FACTOR,
                    segment.p1.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x +
                        segment.p2.screen.w +
                        BORDER_WIDTH * DIRT_BORDER.WIDTH_FACTOR,
                    segment.p2.screen.y
                )
                g.lineTo(
                    segment.p2.screen.x + segment.p2.screen.w,
                    segment.p2.screen.y
                )
                g.closePath()
                g.fill({
                    color: DIRT_BORDER.COLOR,
                    alpha: DIRT_BORDER.ALPHA * roadAlpha,
                })

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
                g.fill({ color: BORDER_COLOR, alpha: roadAlpha })

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
                g.fill({ color: BORDER_COLOR, alpha: roadAlpha })
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
