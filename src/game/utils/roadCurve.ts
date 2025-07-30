import { SEGMENT_LENGTH } from "../constants"

/**
 * Interface pour les segments de route
 */
export interface Segment {
    index: number
    curve: number
    p1: Point
    p2: Point
    color: number
}

export interface Point {
    world: { x: number; y: number; z: number }
    camera: { x: number; y: number; z: number }
    screen: { x: number; y: number; w: number }
}

/**
 * Calcule l'offset horizontal de la route à une position Z donnée
 */
export function getRoadCurveOffset(road: Segment[], z: number): number {
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

/**
 * Calcule la différence d'offset entre deux positions Z
 */
export function getRoadCurveOffsetDelta(
    road: Segment[],
    fromZ: number,
    toZ: number
): number {
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

/**
 * Fonction pour interpoler en douceur entre les courbes des segments
 */
export function getInterpolatedCurve(road: Segment[], z: number): number {
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
