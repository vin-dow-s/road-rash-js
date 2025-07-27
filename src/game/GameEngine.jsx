import { Application, extend } from "@pixi/react"
import { Container, Graphics } from "pixi.js"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
    createPlayerState,
    PLAYER_HEIGHT,
    PLAYER_WIDTH,
    updatePlayerPosition,
} from "./Player"
import { useGameLoop } from "./useGameLoop"

extend({ Graphics, Container })

// CONFIGS ROUTE
const ROAD_COLOR = 0x4d4d4d
const ROAD_SIDE_COLOR = 0x218c28
const ROAD_MAX_WIDTH = 2000
const ROAD_MIN_WIDTH = 200
const SEGMENTS = 120
const DASH_INTERVAL_SEGMENTS = 18 // Espace entre dashes (en segments)
const DASH_LENGTH_SEGMENTS = 7 // Longueur du dash (en segments)

const HORIZON = window.innerHeight * 0.47
const ROAD_SPEED = 370

const PLAYER_LANES = 3
const MOTO_COLORS = [0xff0000, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]

// ENNEMIS
const MAX_ENEMIES = 2
const ENEMY_SPAWN_RATE = 2.8

// DÉCOR
const TREE_COLOR = 0x117700
const ROCK_COLOR = 0x888888
const BUILDING_COLOR = 0x915621

export default function GameEngine() {
    const [playerState, setPlayerState] = useState(createPlayerState)
    const [scrollPos, setScrollPos] = useState(0)
    const [speed, setSpeed] = useState(ROAD_SPEED)
    const [curve, setCurve] = useState(0)
    const curveTarget = useRef(0)
    const curveTimer = useRef(0)
    const [playerOffset, setPlayerOffset] = useState(0)

    const [enemies, setEnemies] = useState([])
    const [lastEnemySpawn, setLastEnemySpawn] = useState(0)
    const [sceneryItems, setSceneryItems] = useState([])

    // Init décor
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
                offset: Math.random() * 120 + 45,
            })
        }
        setSceneryItems(items)
    }, [])

    // Touches joueur
    const handleKeyDown = useCallback((e) => {
        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? true : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? true : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") setSpeed(ROAD_SPEED * 1.5)
    }, [])

    const handleKeyUp = useCallback((e) => {
        setPlayerState((prev) => ({
            ...prev,
            isMovingLeft: e.key === "ArrowLeft" ? false : prev.isMovingLeft,
            isMovingRight: e.key === "ArrowRight" ? false : prev.isMovingRight,
        }))
        if (e.key === "ArrowUp") setSpeed(ROAD_SPEED)
    }, [])

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [handleKeyDown, handleKeyUp])

    // Game loop
    useGameLoop((deltaTime) => {
        // Mise à jour du joueur avec déplacements physiques réels
        setPlayerState((prev) => updatePlayerPosition(prev, deltaTime))
        setScrollPos((prev) => prev + speed * deltaTime)
        setLastEnemySpawn((prev) => prev + deltaTime)

        // Virages aléatoires
        curveTimer.current += deltaTime
        if (curveTimer.current > 3 + Math.random() * 3) {
            const newCurve = (Math.random() - 0.5) * 1.6
            curveTarget.current = newCurve
            curveTimer.current = 0
        }
        setCurve((prev) => prev + (curveTarget.current - prev) * 0.1)

        // Décalage visuel du joueur (pour l'effet de glissement de la route)
        setPlayerOffset((prev) => {
            let target = 0
            if (playerState.isMovingLeft) target = -1
            if (playerState.isMovingRight) target = 1
            return prev + (target - prev) * 0.13
        })

        // Spawn ennemis
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
                    speed: 0.55 + Math.random() * 0.45,
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
                z: (item.z + 0.28 * deltaTime) % 1,
            }))
        )
    })

    const getRoadWidth = useCallback((t) => {
        const exp = 1
        const ratio = Math.pow(t, exp)
        return ROAD_MIN_WIDTH + (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * ratio
    }, [])

    /* const getRoadWidth = useCallback((t) => {
        const exp = 2.8
        const ratio = Math.pow(t, exp)
        return ROAD_MIN_WIDTH + (ROAD_MAX_WIDTH - ROAD_MIN_WIDTH) * ratio
    }, []) */

    // La magie: centerX = centre + courbe + playerOffset
    const getLaneX = useCallback(
        (lane, roadWidth, screenW, curveVal, t) => {
            const curveOffset =
                curveVal * (1 - t) * 230 + playerOffset * 160 * (1 - t)
            const centerX = screenW / 2 + curveOffset
            const laneWidth = roadWidth / PLAYER_LANES
            return centerX + lane * laneWidth
        },
        [playerOffset]
    )

    const draw = useCallback(
        (g) => {
            g.clear()
            const screenW = window.innerWidth
            const screenH = window.innerHeight

            // Ciel
            g.rect(0, 0, screenW, HORIZON)
            g.fill({ color: 0x9fd9f6 })

            // Sol/herbe
            g.rect(0, HORIZON, screenW, screenH - HORIZON)
            g.fill({ color: ROAD_SIDE_COLOR })

            // Road Rash: la route pseudo-3D
            for (let i = 0; i < SEGMENTS; i++) {
                const t1 = (i + (scrollPos % 100) / 100) / SEGMENTS
                const t2 = (i + 1 + (scrollPos % 100) / 100) / SEGMENTS

                const roadW1 = getRoadWidth(t1)
                const roadW2 = getRoadWidth(t2)

                const y1 = HORIZON + (screenH - HORIZON) * t1
                const y2 = HORIZON + (screenH - HORIZON) * t2

                const curveOffset1 =
                    curve * (1 - t1) * 230 + playerOffset * 160 * (1 - t1)
                const curveOffset2 =
                    curve * (1 - t2) * 230 + playerOffset * 160 * (1 - t2)

                const x1 = screenW / 2 + curveOffset1 - roadW1 / 2
                const x2 = screenW / 2 + curveOffset2 - roadW2 / 2

                g.moveTo(x1, y1)
                g.lineTo(x1 + roadW1, y1)
                g.lineTo(x2 + roadW2, y2)
                g.lineTo(x2, y2)
                g.closePath()
                g.fill({ color: ROAD_COLOR })

                // Dashes longs et espacés (pointillés centraux)
                const DASH_GROUP = DASH_INTERVAL_SEGMENTS + DASH_LENGTH_SEGMENTS
                const dashOffset = (scrollPos / 100) % DASH_GROUP // décalage progressif avec la vitesse

                for (let lane = 1; lane < PLAYER_LANES; lane++) {
                    // Calcul pour chaque segment: est-on sur une zone dash ou intervalle?
                    const dashPos = (i + dashOffset) % DASH_GROUP
                    if (dashPos < DASH_LENGTH_SEGMENTS && t1 > 0.08) {
                        const laneWidth1 = roadW1 / PLAYER_LANES
                        const laneWidth2 = roadW2 / PLAYER_LANES
                        g.moveTo(x1 + lane * laneWidth1, y1)
                        g.lineTo(x1 + lane * laneWidth1 + 4, y1)
                        g.lineTo(x2 + lane * laneWidth2 + 4, y2)
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

                // Lignes blanches plus longues sur les bords
                if (i % 4 === 0 && t1 > 0.08) {
                    // Ligne gauche
                    g.moveTo(x1, y1)
                    g.lineTo(x1 + 8, y1)
                    g.lineTo(x2 + 8, y2)
                    g.lineTo(x2, y2)
                    g.closePath()
                    g.fill({ color: 0xffffff })

                    // Ligne droite
                    g.moveTo(x1 + roadW1 - 8, y1)
                    g.lineTo(x1 + roadW1, y1)
                    g.lineTo(x2 + roadW2, y2)
                    g.lineTo(x2 + roadW2 - 8, y2)
                    g.closePath()
                    g.fill({ color: 0xffffff })
                }

                // Bordures
                g.moveTo(x1 - 20, y1)
                g.lineTo(x1, y1)
                g.lineTo(x2, y2)
                g.lineTo(x2 - 20, y2)
                g.closePath()
                g.fill({ color: 0x694934 })

                g.moveTo(x1 + roadW1, y1)
                g.lineTo(x1 + roadW1 + 20, y1)
                g.lineTo(x2 + roadW2 + 20, y2)
                g.lineTo(x2 + roadW2, y2)
                g.closePath()
                g.fill({ color: 0x694934 })
            }

            // Décor: arbres/rochers/buildings courbés
            sceneryItems.forEach((item) => {
                if (item.z > 0.05 && item.z < 0.98) {
                    const itemY = HORIZON + (screenH - HORIZON) * item.z
                    const t = item.z
                    const roadW = getRoadWidth(t)
                    const curveOffset =
                        curve * (1 - t) * 230 + playerOffset * 160 * (1 - t)
                    const centerX = screenW / 2 + curveOffset
                    const sideOffset =
                        item.side === "left"
                            ? -item.offset
                            : roadW + item.offset
                    const itemX = centerX - roadW / 2 + sideOffset
                    const scale = 0.3 + 0.7 * t

                    if (item.type === "tree") {
                        g.rect(itemX, itemY - 40 * scale, 8 * scale, 40 * scale)
                        g.fill({ color: 0x8b4513 })
                        g.circle(
                            itemX + 4 * scale,
                            itemY - 35 * scale,
                            15 * scale
                        )
                        g.fill({ color: TREE_COLOR })
                    } else if (item.type === "rock") {
                        g.circle(itemX, itemY, 12 * scale)
                        g.fill({ color: ROCK_COLOR })
                    } else if (item.type === "building") {
                        g.rect(
                            itemX,
                            itemY - 60 * scale,
                            30 * scale,
                            60 * scale
                        )
                        g.fill({ color: BUILDING_COLOR })
                    }
                }
            })

            // Ennemis
            enemies.forEach((enemy) => {
                if (enemy.z > 0.1) {
                    const enemyY = HORIZON + (screenH - HORIZON) * enemy.z
                    const t = enemy.z
                    const roadWEnemy = getRoadWidth(t)
                    const enemyScale = 0.25 + 1 * t
                    const enemyX =
                        getLaneX(enemy.lane, roadWEnemy, screenW, curve, t) -
                        (PLAYER_WIDTH * enemyScale) / 2
                    g.rect(
                        enemyX,
                        enemyY - PLAYER_HEIGHT * enemyScale,
                        PLAYER_WIDTH * enemyScale,
                        PLAYER_HEIGHT * enemyScale
                    )
                    g.fill({ color: enemy.color })
                    g.ellipse(
                        enemyX + (PLAYER_WIDTH * enemyScale) / 2,
                        enemyY + 7,
                        (PLAYER_WIDTH * enemyScale) / 2,
                        8 * enemyScale
                    )
                    g.fill({ color: 0x000000, alpha: 0.27 })
                }
            })

            // Moto joueur - COMBINAISON : position physique + effet visuel
            // Position physique réelle du joueur
            const playerRealX = playerState.x

            // Effet tilt/penché visuel basé sur les virages
            const tiltOffset = curve * 7

            // Position finale = position réelle + effet de tilt
            const finalPlayerX = playerRealX + tiltOffset

            // Ombre du joueur
            g.ellipse(
                finalPlayerX + PLAYER_WIDTH / 2,
                playerState.y + PLAYER_HEIGHT + 6,
                PLAYER_WIDTH / 2,
                10
            )
            g.fill({ color: 0x000000, alpha: 0.4 })

            // Moto du joueur
            g.rect(finalPlayerX, playerState.y, PLAYER_WIDTH, PLAYER_HEIGHT)
            g.fill({ color: 0xff0000 })

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
            curve,
            playerOffset,
            getRoadWidth,
            getLaneX,
        ]
    )

    return (
        <Application
            width={window.innerWidth}
            height={window.innerHeight}
            background={0x87ceeb}
        >
            <container>
                <graphics draw={draw} />
            </container>
        </Application>
    )
}
