import type { Point } from "./roadCurve"

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

export function getRoadScreenBorders(
    roadX: number, // x = position du segment sur la route, souvent 0
    roadZ: number, // z = profondeur du segment
    camX: number, // position caméra X = joueur.x
    camY: number,
    camZ: number,
    cameraDepth: number,
    screenW: number,
    screenH: number,
    roadWidth: number
) {
    const point: Point = {
        world: { x: roadX, y: 0, z: roadZ },
        camera: { x: 0, y: 0, z: 0 },
        screen: { x: 0, y: 0, w: 0 },
    }
    project3D(point, camX, camY, camZ, cameraDepth, screenW, screenH, roadWidth)
    return {
        left: point.screen.x - point.screen.w,
        right: point.screen.x + point.screen.w,
        y: point.screen.y,
    }
}
