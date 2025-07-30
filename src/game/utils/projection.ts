import {
    CAMERA_HEIGHT,
    PLAYER_Z,
    ROAD_MAX_WIDTH,
    ROAD_MIN_WIDTH,
    ROAD_WIDTH,
    SEGMENT_LENGTH,
} from "../constants"
import type { Point, Segment } from "./roadCurve"

/**
 * Projette un point 3D vers l'écran 2D
 */
export function project3D(
    point: Point,
    camX: number,
    camY: number,
    camZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number
): void {
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

export function getProjectedRoadBordersAtPlayer(
    road: Segment[],
    scrollPos: number,
    playerZ: number,
    cameraDepth: number,
    screenW: number,
    screenH: number,
    roadWidth: number
) {
    const playerSegmentIndex =
        Math.floor(playerZ / SEGMENT_LENGTH) % road.length
    const segment = road[playerSegmentIndex]

    // On calcule l’offset cumulé des courbes jusqu’à ce segment
    let x = 0
    let dx = 0
    for (let i = 0; i < playerSegmentIndex; i++) {
        const s = road[i % road.length]
        x += dx
        dx += s.curve
    }

    // On projette p1 (near = où la moto est) avec la caméra
    const p: Point = {
        world: { x, y: 0, z: playerZ },
        camera: { x: 0, y: 0, z: 0 },
        screen: { x: 0, y: 0, w: 0 },
    }
    project3D(
        p,
        0, // playerRoadX à 0 car on veut la vraie “route” (centrée)
        CAMERA_HEIGHT,
        scrollPos + PLAYER_Z,
        cameraDepth,
        screenW,
        screenH,
        roadWidth
    )

    // Les bords projetés à l’écran :
    const roadLeft = p.screen.x - p.screen.w
    const roadRight = p.screen.x + p.screen.w

    return { roadLeft, roadRight, roadScreenY: p.screen.y }
}

/**
 * Version synchronisée avec draw() - utilise exactement la même logique de rendu
 */
export function getProjectedRoadBordersAtPlayerSynced(
    road: Segment[],
    scrollPos: number,
    playerZ: number,
    cameraDepth: number,
    screenW: number,
    screenH: number,
    roadWidth: number,
    playerX: number,
    playerWidth: number,
    cameraSmoothing: { currentX: number }
) {
    // UTILISE EXACTEMENT LA MÊME LOGIQUE QUE draw() !!!

    const baseSegmentIndex = Math.floor(scrollPos / SEGMENT_LENGTH)
    const playerSegmentIndex =
        Math.floor(playerZ / SEGMENT_LENGTH) % road.length

    // Calcul du playerRoadX (identique à draw())
    const playerRoadX =
        (2 * (playerX + playerWidth / 2 - screenW / 2)) / roadWidth

    // MÊME calcul de targetCameraX que dans draw()
    let targetCameraX = 0
    let dx = 0
    for (let i = 0; i < 3; i++) {
        const segIdx = baseSegmentIndex + i
        if (segIdx < road.length) {
            targetCameraX += dx
            dx += road[segIdx].curve * 50 // MÊME facteur d'anticipation
        }
    }

    // Utilise le MÊME lissage de caméra que draw()
    let x = -cameraSmoothing.currentX
    dx = 0

    // MÊME algorithme de progression des courbes que draw()
    const currentSegmentProgress = (scrollPos % SEGMENT_LENGTH) / SEGMENT_LENGTH

    // On veut les bordures du PREMIER segment visible (celui au bas de l'écran)
    // C'est le segment baseSegmentIndex (n=0 dans draw()) qui définit visuellement les bordures

    // Pour n=0, on utilise la progression partielle du segment actuel
    const firstSegment = road[baseSegmentIndex % road.length]

    // Application de la courbe partielle comme dans draw() pour n=0
    dx += firstSegment.curve * (1 - currentSegmentProgress)
    x += dx // IMPORTANT : Appliquer l'offset calculé !

    // On projette le point légèrement devant la caméra pour avoir une bonne perspective
    const projectionZ = scrollPos + PLAYER_Z + SEGMENT_LENGTH * 0.5
    const p: Point = {
        world: { x, y: 0, z: projectionZ },
        camera: { x: 0, y: 0, z: 0 },
        screen: { x: 0, y: 0, w: 0 },
    }

    // Calcul de la largeur de route adaptée à la distance
    const adaptedRoadWidth = ROAD_WIDTH

    project3D(
        p,
        (playerRoadX * roadWidth) / 2, // MÊME offset de caméra que draw()
        CAMERA_HEIGHT,
        scrollPos + PLAYER_Z,
        cameraDepth,
        screenW,
        screenH,
        adaptedRoadWidth // Utiliser la largeur adaptée à la distance
    )

    // Les bords projetés à l'écran (identiques à draw())
    const roadLeft = p.screen.x - p.screen.w
    const roadRight = p.screen.x + p.screen.w

    let clampedRoadLeft = roadLeft
    let clampedRoadRight = roadRight

    if (roadRight - roadLeft > ROAD_MAX_WIDTH) {
        // Recentre sur l’écran et limite la largeur à MAX_ROUTE_WIDTH
        const center = (roadLeft + roadRight) / 2
        clampedRoadLeft = center - ROAD_MAX_WIDTH / 2
        clampedRoadRight = center + ROAD_MAX_WIDTH / 2
    }
    if (clampedRoadRight - clampedRoadLeft < ROAD_MIN_WIDTH) {
        // (En cas de bug d'horizon, pour éviter division par zéro)
        const center = (clampedRoadLeft + clampedRoadRight) / 2
        clampedRoadLeft = center - ROAD_MIN_WIDTH / 2
        clampedRoadRight = center + ROAD_MIN_WIDTH / 2
    }
    console.log(
        "🚀 ~ getProjectedRoadBordersAtPlayerSynced ~ roadLeft:",
        clampedRoadLeft
    )
    console.log(
        "🚀 ~ getProjectedRoadBordersAtPlayerSynced ~ roadRight:",
        clampedRoadRight
    )
    return {
        roadLeft: clampedRoadLeft,
        roadRight: clampedRoadRight,
        roadScreenY: p.screen.y,
    }
}
