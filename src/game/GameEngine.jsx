import { Application, extend } from "@pixi/react"
import { Assets, Container, Graphics, Sprite as PixiSprite } from "pixi.js"
import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { createPlayerState, PLAYER_HEIGHT, PLAYER_WIDTH } from "./Player"
import { useGameLoop } from "./useGameLoop"
import backgroundImg from "/src/assets/background.png"
import playerBike from "/src/assets/player.png"

extend({ Graphics, Container, Sprite: PixiSprite })

function buildRoad() {
    const road = []
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

    for (let i = 0; i < 40; i++) road.push({ curve: 0 })

    for (let i = 0; i < 10; i++) {
        const progress = i / 10
        road.push({ curve: -0.003 * (1 - easeInOut(progress)) })
    }
    for (let i = 0; i < 20; i++) {
        const progress = i / 20
        road.push({ curve: -0.003 + 0.006 * easeInOut(progress) })
    }
    for (let i = 0; i < 10; i++) {
        const progress = i / 10
        road.push({ curve: 0.003 * (1 - easeInOut(progress)) })
    }

    for (let i = 0; i < 25; i++) road.push({ curve: 0 })

    for (let i = 0; i < 6; i++) {
        const progress = i / 6
        road.push({ curve: 0.003 * (1 - easeInOut(progress)) })
    }
    for (let i = 0; i < 25; i++) {
        const progress = i / 25
        road.push({ curve: 0.003 - 0.006 * easeInOut(progress) })
    }
    for (let i = 0; i < 6; i++) {
        const progress = i / 6
        road.push({ curve: -0.003 * (1 - easeInOut(progress)) })
    }

    for (let i = 0; i < 6; i++) {
        const progress = i / 6
        road.push({ curve: -0.005 * (1 - easeInOut(progress)) })
    }
    for (let i = 0; i < 15; i++) {
        const progress = i / 15
        road.push({ curve: -0.005 + 0.01 * easeInOut(progress) })
    }
    for (let i = 0; i < 6; i++) {
        const progress = i / 6
        road.push({ curve: 0.005 * (1 - easeInOut(progress)) })
    }

    for (let i = 0; i < 50; i++) road.push({ curve: 0 })

    return road
}
const road = buildRoad()
const ROAD_LENGTH = road.length

// Fonction temporaire pour mettre à jour la position du joueur
const updatePlayerPosition = (
    playerState,
    deltaTime,
    roadCenterX,
    roadWidthAtPlayer
) => {
    let newX = playerState.x
    const movement = 450 * deltaTime // PLAYER_SPEED

    // Limites dynamiques
    const minX = roadCenterX - roadWidthAtPlayer / 2 + 50
    const maxX = roadCenterX + roadWidthAtPlayer / 2 - PLAYER_WIDTH - 50

    if (playerState.isMovingLeft) {
        newX = Math.max(minX, newX - movement)
    }
    if (playerState.isMovingRight) {
        newX = Math.min(maxX, newX + movement)
    }

    // Calcul de la rotation
    const targetRotation = playerState.isMovingLeft
        ? -0.3 // Penché à gauche
        : playerState.isMovingRight
        ? 0.3 // Penché à droite
        : 0 // Droit

    // Lissage de la rotation
    const rotationSpeed = 8
    const newRotation =
        playerState.rotation +
        (targetRotation - playerState.rotation) *
            Math.min(1, deltaTime * rotationSpeed)

    return {
        ...playerState,
        x: newX,
        rotation: newRotation,
    }
}

export default function GameEngine() {
    const [paused, setPaused] = useState(false)

    const [playerTexture, setPlayerTexture] = useState(null)
    const [backgroundTexture, setBackgroundTexture] = useState(null)
    const [playerState, setPlayerState] = useState(createPlayerState)
    const [scrollPos, setScrollPos] = useState(0)
    const [speed, setSpeed] = useState(ROAD_SPEED)
    const [enemies, setEnemies] = useState([])
    const [lastEnemySpawn, setLastEnemySpawn] = useState(0)
    const [sceneryItems, setSceneryItems] = useState([])

    const pausedRef = useRef(paused)
    const speedRef = useRef(speed)
    const isAcceleratingRef = useRef(false)
    const isBrakingRef = useRef(false)

    useEffect(() => {
        pausedRef.current = paused
    }, [paused])

    useEffect(() => {
        speedRef.current = speed
    }, [speed])

    useEffect(() => {
        let isMounted = true
        Assets.load(playerBike).then((texture) => {
            if (isMounted) setPlayerTexture(texture)
        })
        Assets.load(backgroundImg).then((texture) => {
            if (isMounted) setBackgroundTexture(texture)
        })
        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        const items = []
        for (let i = 0; i < 80; i++) {
            items.push({
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
        setSceneryItems(items)
    }, [])

    /**
     * Gestionnaire pour les touches pressées
     */
    const handleKeyDown = useCallback((e) => {
        if (e.key === " " || e.key === "p" || e.key === "P") {
            setPaused((paused) => !paused)
            return // très important, ne pas faire d'autres actions sur pause
        }

        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? true : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? true : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") {
            isAcceleratingRef.current = true
        }
        if (e.key === "ArrowDown") {
            isBrakingRef.current = true
        }
    }, [])

    /**
     * Gestionnaire pour les touches relâchées
     */
    const handleKeyUp = useCallback((e) => {
        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? false : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? false : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") {
            isAcceleratingRef.current = false
        }
        if (e.key === "ArrowDown") {
            isBrakingRef.current = false
        }
    }, [])

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [handleKeyDown, handleKeyUp])

    useGameLoop((deltaTime) => {
        if (pausedRef.current) return

        // 1. Calcul de la prochaine vitesse locale (avant le setState)
        let currentSpeed = speedRef.current
        let nextSpeed = currentSpeed

        if (isAcceleratingRef.current) {
            const acceleration = ACCELERATION * deltaTime
            nextSpeed = Math.min(currentSpeed + acceleration, MAX_SPEED)
        } else if (isBrakingRef.current) {
            const brakeForce = BRAKE * deltaTime
            nextSpeed = Math.max(ROAD_SPEED, currentSpeed - brakeForce)
        }

        // 2. Mets à jour la vitesse dans le state (pour l'affichage/hud)
        setSpeed(nextSpeed)
        const speedFactor = nextSpeed / ROAD_SPEED

        // Gestion de la position du joueur
        setPlayerState((prev) =>
            updatePlayerPosition(
                prev,
                deltaTime,
                window.innerWidth / 2, // Centre de l'écran
                800 // Largeur de route au niveau du joueur
            )
        )

        setScrollPos((prev) => prev + nextSpeed * deltaTime)
        setLastEnemySpawn((prev) => prev + deltaTime)

        // Mise à jour de la vitesse de défilement du décor
        setSceneryItems((prev) =>
            prev.map((item) => ({
                ...item,
                z: (item.z + 0.28 * speedFactor * deltaTime) % 1,
            }))
        )

        if (lastEnemySpawn > ENEMY_SPAWN_RATE && enemies.length < MAX_ENEMIES) {
            setEnemies((prev) => [
                ...prev,
                {
                    id: Date.now() + Math.random(),
                    z: 0.13,
                    lane: Math.floor(Math.random() * 3) - 1,
                    color: MOTO_COLORS[
                        Math.floor(Math.random() * MOTO_COLORS.length)
                    ],
                    speed: (0.55 + Math.random() * 0.45) * speedFactor,
                },
            ])
            setLastEnemySpawn(0)
        }
        setEnemies((prev) =>
            prev
                .map((enemy) => ({
                    ...enemy,
                    z: enemy.z + enemy.speed * deltaTime,
                }))
                .filter((enemy) => enemy.z < 1.22)
        )
    })

    const getRoadWidth = useCallback((t) => {
        return ROAD_MIN_WIDTH + (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * t
    }, [])

    /**
     * Fonction de rendu qui dessine la route 3D avec virages à l'horizon
     */
    const draw = useCallback(
        (g) => {
            g.clear()
            const screenW = window.innerWidth
            const screenH = window.innerHeight

            // Sol/herbe
            g.rect(0, HORIZON, screenW, screenH - HORIZON)
            g.fill({ color: ROAD_SIDE_COLOR })

            // 1. Calculer courbe cumulée à l'horizon (total visible)
            const position = scrollPos / 100
            let curveSums = new Array(DRAW_DISTANCE + 1).fill(0)
            for (let i = DRAW_DISTANCE; i >= 0; i--) {
                // Somme des courbes du segment i jusqu'à la fin
                let sum = 0
                for (let j = i; j < DRAW_DISTANCE; j++) {
                    const idx = (Math.floor(position) + j) % ROAD_LENGTH
                    sum += road[idx].curve
                }
                curveSums[i] = sum
            }

            // 2. Générer tous les segments du haut (horizon) vers le bas (joueur)
            for (let i = 0; i < DRAW_DISTANCE; i++) {
                const t1 = i / DRAW_DISTANCE
                const t2 = (i + 1) / DRAW_DISTANCE

                const roadW1 = getRoadWidth(t1)
                const roadW2 = getRoadWidth(t2)

                const y1 = HORIZON + (screenH - HORIZON) * t1
                const y2 = HORIZON + (screenH - HORIZON) * t2

                // Offset courbe calculé à partir de l'horizon (le haut)
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
                    (DASH_GROUP - ((scrollPos / 2) % DASH_GROUP)) % DASH_GROUP

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
                    const laneCenter1 =
                        x1 + ((lane + 0.5) * roadW1) / PLAYER_LANES
                    const laneCenter2 =
                        x2 + ((lane + 0.5) * roadW2) / PLAYER_LANES
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
            sceneryItems.forEach((item) => {
                if (item.z > 0.05 && item.z < 0.98) {
                    const t = item.z
                    const i = Math.floor(t * DRAW_DISTANCE)

                    // Offset courbe décor
                    const decorCurveOffset = curveSums[i] * CURVE_SCALE
                    const itemY = HORIZON + (screenH - HORIZON) * t
                    const roadW = getRoadWidth(t)
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
                Math.min(maxSpeed, speed)
            )
            const speedRatio =
                (currentSpeedClamped - minSpeed) / (maxSpeed - minSpeed)

            // Largeur de la jauge (minimum 20%, maximum 100%)
            const gaugeWidth = 36 + speedRatio * 144 // 36 = 20% de 180, 144 = 80% de 180

            // Couleur en fonction de la vitesse
            let color = 0x4fff66 // Vert par défaut
            if (speedRatio > 0.4) color = 0xffaa44 // Orange à 40%
            if (speedRatio > 0.7) color = 0xff4444 // Rouge à 70%

            // Effet de pulsation à haute vitesse
            const pulseScale =
                speedRatio > 0.8 ? 1 + Math.sin(Date.now() * 0.01) * 0.01 : 1

            // Jauge de vitesse avec effet de pulsation
            g.rect(18, 20, gaugeWidth * pulseScale, 13)
            g.fill({ color })

            // Effet de brillance
            g.rect(18, 21, gaugeWidth * pulseScale, 3)
            g.fill({ color: 0xffffff, alpha: 0.4 })
        },
        [
            scrollPos,
            sceneryItems,
            speed, // Vitesse pour la jauge
            getRoadWidth,
        ]
    )

    function PlayerOnRoad() {
        const screenW = window.innerWidth
        const playerScreenX = screenW / 2 + (playerState.x - screenW / 2)

        if (!playerTexture) return null

        return (
            <>
                <graphics
                    draw={(g) => {
                        g.clear()
                        g.ellipse(
                            playerScreenX + PLAYER_WIDTH / 2,
                            playerState.y + PLAYER_HEIGHT - 10,
                            PLAYER_WIDTH / 5,
                            10
                        )
                        g.fill({ color: 0x000000, alpha: 0.3 })
                    }}
                />
                <sprite
                    texture={playerTexture}
                    x={playerScreenX + PLAYER_WIDTH / 2}
                    y={playerState.y + PLAYER_HEIGHT / 2}
                    width={PLAYER_WIDTH}
                    height={PLAYER_HEIGHT}
                    anchor={0.5}
                    rotation={playerState.rotation}
                />
            </>
        )
    }

    return (
        <>
            {paused && (
                <div
                    style={{
                        position: "absolute",
                        top: 30,
                        left: 0,
                        width: "100vw",
                        textAlign: "center",
                        fontSize: 48,
                        color: "#fff",
                        textShadow: "0 0 16px #000",
                        pointerEvents: "none",
                        fontWeight: "bold",
                        zIndex: 99,
                    }}
                >
                    PAUSE
                </div>
            )}

            <Application
                width={window.innerWidth}
                height={window.innerHeight}
                background={0x000000}
            >
                <container>
                    {/* Background statique */}
                    {backgroundTexture && (
                        <sprite
                            texture={backgroundTexture}
                            width={window.innerWidth}
                            height={window.innerHeight}
                            x={0}
                            y={-100}
                        />
                    )}
                    <graphics draw={draw} />
                    <PlayerOnRoad />
                </container>
            </Application>
        </>
    )
}
