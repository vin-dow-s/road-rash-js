import { Application, extend } from "@pixi/react"
import { Assets, Container, Graphics, Sprite as PixiSprite } from "pixi.js"
import React, { useCallback, useEffect, useState } from "react"
import {
    createPlayerState,
    PLAYER_HEIGHT,
    PLAYER_WIDTH,
    updatePlayerPosition,
} from "./Player"
import { useGameLoop } from "./useGameLoop"
import backgroundImg from "/src/assets/background.png"
import playerBike from "/src/assets/player.png"

extend({ Graphics, Container, Sprite: PixiSprite })

const ROAD_COLOR = 0x4d4d4d
const ROAD_SIDE_COLOR = 0x218c28
const ROAD_MAX_WIDTH = 2000
const ROAD_MIN_WIDTH = 200
const SEGMENTS = 120
const DASH_INTERVAL_SEGMENTS = 18
const DASH_LENGTH_SEGMENTS = 7
const BORDER_COLOR = 0xb89d70
const BORDER_WIDTH = 10

const HORIZON = window.innerHeight * 0.47
const ROAD_SPEED = 600
const MAX_SPEED = ROAD_SPEED * 2.5
const ACCELERATION = 800
const DECELERATION = 600

const PLAYER_LANES = 3
const MOTO_COLORS = [0xff0000, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]

const MAX_ENEMIES = 2
const ENEMY_SPAWN_RATE = 2.8

const TREE_COLOR = 0x117700
const ROCK_COLOR = 0x888888
const BUILDING_COLOR = 0x915621

function buildRoad() {
    const road = []
    for (let i = 0; i < 100; i++) road.push({ curve: 0 })
    for (let i = 0; i < 40; i++) road.push({ curve: 0.004 })
    for (let i = 0; i < 60; i++) road.push({ curve: 0 })
    for (let i = 0; i < 50; i++) road.push({ curve: -0.004 })
    for (let i = 0; i < 100; i++) road.push({ curve: 0 })
    return road
}
const road = buildRoad()
const ROAD_LENGTH = road.length

function accumulateCurve(road, from, to) {
    let acc = 0
    for (let z = from; z < to; z += 1) {
        const idx = Math.floor(z) % ROAD_LENGTH
        acc += road[idx].curve
    }
    return acc
}

export default function GameEngine() {
    const [playerTexture, setPlayerTexture] = useState(null)
    const [backgroundTexture, setBackgroundTexture] = useState(null)
    const [playerState, setPlayerState] = useState(createPlayerState)
    const [scrollPos, setScrollPos] = useState(0)
    const [isAccelerating, setIsAccelerating] = useState(false)
    const [speed, setSpeed] = useState(ROAD_SPEED)
    const [playerOffset, setPlayerOffset] = useState(0)
    const [enemies, setEnemies] = useState([])
    const [lastEnemySpawn, setLastEnemySpawn] = useState(0)
    const [sceneryItems, setSceneryItems] = useState([])

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

    const handleKeyDown = useCallback((e) => {
        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? true : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? true : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") setIsAccelerating(true)
    }, [])
    const handleKeyUp = useCallback((e) => {
        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? false : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? false : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") setIsAccelerating(false)
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
        let currentSpeed = speed
        setSpeed((prevSpeed) => {
            if (isAccelerating) {
                currentSpeed = Math.min(
                    prevSpeed + ACCELERATION * deltaTime,
                    MAX_SPEED
                )
            } else {
                currentSpeed = Math.max(
                    ROAD_SPEED,
                    prevSpeed - DECELERATION * deltaTime
                )
            }
            return currentSpeed
        })

        const speedFactor = currentSpeed / ROAD_SPEED

        // --- Calcul dynamique du centre et largeur de la route au niveau du joueur ---
        const screenW = window.innerWidth
        const cameraZ = scrollPos / 100
        const playerDepthRatio = 0.85 // 85% vers nous
        const zPlayer = cameraZ + SEGMENTS * playerDepthRatio
        const playerCurveOffset = accumulateCurve(road, cameraZ, zPlayer) * 1500
        const roadCenterX = screenW / 2 + playerCurveOffset
        const tPlayer = playerDepthRatio
        const roadWidthAtPlayer =
            ROAD_MIN_WIDTH +
            (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * Math.pow(tPlayer, 1)

        setPlayerState((prev) =>
            updatePlayerPosition(
                prev,
                deltaTime,
                roadCenterX,
                roadWidthAtPlayer
            )
        )
        setScrollPos((prev) => prev + currentSpeed * deltaTime)
        setLastEnemySpawn((prev) => prev + deltaTime)

        setPlayerOffset((prev) => {
            let target = 0
            if (playerState.isMovingLeft) target = -1
            if (playerState.isMovingRight) target = 1
            return prev + (target - prev) * 0.13
        })

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
        setSceneryItems((prev) =>
            prev.map((item) => ({
                ...item,
                z: (item.z + 0.28 * speedFactor * deltaTime) % 1,
            }))
        )
    })

    const getRoadWidth = useCallback((t) => {
        const exp = 1
        const ratio = Math.pow(t, exp)
        return ROAD_MIN_WIDTH + (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * ratio
    }, [])

    // Rendu principal
    const draw = useCallback(
        (g) => {
            g.clear()
            const screenW = window.innerWidth
            const screenH = window.innerHeight

            // Sol/herbe
            g.rect(0, HORIZON, screenW, screenH - HORIZON)
            g.fill({ color: ROAD_SIDE_COLOR })

            // Calcul pour le centrage caméra/axe route
            const cameraZ = scrollPos / 100
            const cameraHorizonZ = cameraZ + SEGMENTS
            const curveOffsetHorizon =
                accumulateCurve(road, cameraZ, cameraHorizonZ) * 1500

            for (let i = 0; i < SEGMENTS; i++) {
                const t1 = i / SEGMENTS
                const t2 = (i + 1) / SEGMENTS

                const z1 = cameraZ + i
                const z2 = cameraZ + i + 1

                const accCurve1 =
                    accumulateCurve(road, cameraZ, z1) * 1500 -
                    curveOffsetHorizon
                const accCurve2 =
                    accumulateCurve(road, cameraZ, z2) * 1500 -
                    curveOffsetHorizon

                const roadW1 = getRoadWidth(t1)
                const roadW2 = getRoadWidth(t2)

                const y1 = HORIZON + (screenH - HORIZON) * t1
                const y2 = HORIZON + (screenH - HORIZON) * t2

                const x1 = screenW / 2 + accCurve1 - roadW1 / 2
                const x2 = screenW / 2 + accCurve2 - roadW2 / 2

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

                // Traces de pneus ultra soft/floues façon Road Rash
                for (let lane = 0; lane < PLAYER_LANES; lane++) {
                    // Centre de la lane en bas et en haut du segment
                    const laneCenter1 =
                        x1 + ((lane + 0.5) * roadW1) / PLAYER_LANES
                    const laneCenter2 =
                        x2 + ((lane + 0.5) * roadW2) / PLAYER_LANES

                    // Largeur fixe (pas de perspective) ~35 px, ajustable
                    const SKID_WIDTH = 36

                    // 3 à 4 couches très floues, très peu opaques
                    for (let blur = 0; blur < 4; blur++) {
                        const blurAlpha = [0.07, 0.045, 0.028, 0.015][blur]
                        const blurExtra = blur * 11

                        g.moveTo(laneCenter1 - SKID_WIDTH / 2 - blurExtra, y1)
                        g.lineTo(laneCenter1 + SKID_WIDTH / 2 + blurExtra, y1)
                        g.lineTo(laneCenter2 + SKID_WIDTH / 2 + blurExtra, y2)
                        g.lineTo(laneCenter2 - SKID_WIDTH / 2 - blurExtra, y2)
                        g.closePath()
                        g.fill({
                            // Gris bleuté asphalte usé
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
                    const z = cameraZ + t * SEGMENTS
                    const accCurve =
                        accumulateCurve(road, cameraZ, z) * 1500 -
                        curveOffsetHorizon
                    const itemY = HORIZON + (screenH - HORIZON) * t
                    const roadW = getRoadWidth(t)
                    const centerX = screenW / 2 + accCurve
                    const sideOffset =
                        item.side === "left"
                            ? -roadW / 2 - item.offset
                            : roadW / 2 + item.offset
                    const decorX = centerX + sideOffset
                    const scale = 0.3 + 0.7 * t

                    if (item.type === "tree") {
                        g.rect(
                            decorX,
                            itemY - 360 * scale,
                            60 * scale,
                            360 * scale
                        )
                        g.fill({ color: 0x8b4513 })
                        g.circle(
                            decorX + 30 * scale,
                            itemY - 300 * scale,
                            135 * scale
                        )
                        g.fill({ color: TREE_COLOR })
                    } else if (item.type === "rock") {
                        g.circle(decorX, itemY - 20 * scale, 35 * scale)
                        g.fill({ color: ROCK_COLOR })
                    } else if (item.type === "building") {
                        g.rect(
                            decorX,
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
            g.rect(
                18,
                20,
                180 * Math.max(0.18, (speed - ROAD_SPEED) / ROAD_SPEED + 0.22),
                13
            )
            g.fill({ color: speed > ROAD_SPEED ? 0xff4444 : 0x4fff66 })
        },
        [
            scrollPos,
            playerState,
            enemies,
            sceneryItems,
            speed,
            playerOffset,
            getRoadWidth,
        ]
    )

    function PlayerOnRoad() {
        const screenW = window.innerWidth
        const cameraZ = scrollPos / 100

        // Profondeur joueur
        const playerDepthRatio = 0.85
        const zPlayer = cameraZ + SEGMENTS * playerDepthRatio
        const playerCurveOffset = accumulateCurve(road, cameraZ, zPlayer) * 1500

        const playerScreenX =
            screenW / 2 + playerCurveOffset + (playerState.x - screenW / 2)

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
        <Application
            width={window.innerWidth}
            height={window.innerHeight}
            background={0x000000}
        >
            <container>
                {/* Background */}
                {backgroundTexture && (
                    <sprite
                        texture={backgroundTexture}
                        width={window.innerWidth}
                        height={window.innerHeight}
                        x={0}
                        y={0}
                    />
                )}
                <graphics draw={draw} />
                <PlayerOnRoad />
            </container>
        </Application>
    )
}
