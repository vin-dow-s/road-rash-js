import {
    BORDER_COLOR,
    ROAD,
    ROAD_COLOR,
    RUMBLE_LENGTH,
    SEGMENT_LENGTH,
} from "../constants"
import { easeIn, easeInOut } from "./easing"
import type { Segment } from "./roadCurve"

/**
 * Génère tous les segments de la route avec différents types de sections
 */
export function buildRoadSegments(): Segment[] {
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
    addStraight(ROAD.LENGTH.VERY_LONG)
    addStraight(ROAD.LENGTH.VERY_LONG)
    addStraight(ROAD.LENGTH.VERY_LONG)
    addStraight(ROAD.LENGTH.VERY_LONG)

    /*     // Section 1: Introduction progressive
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
    addStraight(ROAD.LENGTH.MEDIUM) */

    return segments
}
