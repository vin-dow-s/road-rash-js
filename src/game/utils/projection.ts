import { CAMERA_HEIGHT, PLAYER_Z, SEGMENT_LENGTH } from "../constants"
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
