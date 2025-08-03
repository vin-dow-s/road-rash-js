import { Graphics } from "pixi.js"

export interface Segment {
    index: number
    p1: {
        screen: { x: number; y: number; w: number }
    }
    p2: {
        screen: { x: number; y: number; w: number }
    }
    color: {
        road: number
        rumble: number
        lane?: number
    }
}

export interface RoadRendererOptions {
    lanes: number
}

export function drawRoadSegment(
    g: Graphics,
    segment: Segment,
    options: RoadRendererOptions
): void {
    const { lanes } = options

    // Rumble strips
    const r1 = segment.p1.screen.w / Math.max(6, 2 * lanes)
    const r2 = segment.p2.screen.w / Math.max(6, 2 * lanes)

    // ---- Flou/terre autour de la bordure marron (externe) ----
    const earthShadowColor = 0x85603c // un marron plus clair
    g.fill(earthShadowColor, 0.33) // alpha faible pour effet flou
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w - r1 * 1.7,
        segment.p1.screen.y,
        segment.p1.screen.x - segment.p1.screen.w + r1 * 0.25,
        segment.p1.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + r2 * 0.25,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w - r2 * 1.7,
        segment.p2.screen.y
    )
    g.endFill()
    g.fill(earthShadowColor, 0.33)
    polygon(
        g,
        segment.p1.screen.x + segment.p1.screen.w + r1 * 1.7,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w - r1 * 0.25,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - r2 * 0.25,
        segment.p2.screen.y,
        segment.p2.screen.x + segment.p2.screen.w + r2 * 1.7,
        segment.p2.screen.y
    )
    g.endFill()

    // --- MARRON (bordure extérieure) ---
    g.fill(segment.color.rumble)
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w - r1,
        segment.p1.screen.y,
        segment.p1.screen.x - segment.p1.screen.w,
        segment.p1.screen.y,
        segment.p2.screen.x - segment.p2.screen.w,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w - r2,
        segment.p2.screen.y
    )
    g.endFill()
    g.fill(segment.color.rumble)
    polygon(
        g,
        segment.p1.screen.x + segment.p1.screen.w + r1,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w,
        segment.p2.screen.y,
        segment.p2.screen.x + segment.p2.screen.w + r2,
        segment.p2.screen.y
    )
    g.endFill()

    // --- DORÉE (bordure fine à l'intérieur du marron) ---
    const goldWidth1 = r1 * 0.35
    const goldWidth2 = r2 * 0.35

    // ---- Lueur diffuse dorée (optionnel) ----
    g.fill(0xb89d70, 0.18)
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w - goldWidth1 * 0.6,
        segment.p1.screen.y,
        segment.p1.screen.x - segment.p1.screen.w + goldWidth1 * 1.5,
        segment.p1.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + goldWidth2 * 1.5,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w - goldWidth2 * 0.6,
        segment.p2.screen.y
    )
    g.endFill()
    g.fill(0xb89d70, 0.18)
    polygon(
        g,
        segment.p1.screen.x + segment.p1.screen.w + goldWidth1 * 0.6,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w - goldWidth1 * 1.5,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - goldWidth2 * 1.5,
        segment.p2.screen.y,
        segment.p2.screen.x + segment.p2.screen.w + goldWidth2 * 0.6,
        segment.p2.screen.y
    )
    g.endFill()

    g.fill(0xb89d70)
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w,
        segment.p1.screen.y,
        segment.p1.screen.x - segment.p1.screen.w + goldWidth1,
        segment.p1.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + goldWidth2,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w,
        segment.p2.screen.y
    )
    g.endFill()
    g.fill(0xb89d70)
    polygon(
        g,
        segment.p1.screen.x + segment.p1.screen.w,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w - goldWidth1,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - goldWidth2,
        segment.p2.screen.y,
        segment.p2.screen.x + segment.p2.screen.w,
        segment.p2.screen.y
    )
    g.endFill()

    // --- BLANCHE (encore plus fine, à l'intérieur du doré) ---
    const whiteWidth1 = goldWidth1 * 0.4
    const whiteWidth2 = goldWidth2 * 0.4
    g.fill(0xffffff)
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w + goldWidth1,
        segment.p1.screen.y,
        segment.p1.screen.x - segment.p1.screen.w + goldWidth1 + whiteWidth1,
        segment.p1.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + goldWidth2 + whiteWidth2,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + goldWidth2,
        segment.p2.screen.y
    )
    g.endFill()
    g.fill(0xffffff)
    polygon(
        g,
        segment.p1.screen.x + segment.p1.screen.w - goldWidth1,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w - goldWidth1 - whiteWidth1,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - goldWidth2 - whiteWidth2,
        segment.p2.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - goldWidth2,
        segment.p2.screen.y
    )
    g.endFill()

    // Road (trapèze)
    g.fill(segment.color.road)
    polygon(
        g,
        segment.p1.screen.x - segment.p1.screen.w + goldWidth1 + whiteWidth1,
        segment.p1.screen.y,
        segment.p1.screen.x + segment.p1.screen.w - goldWidth1 - whiteWidth1,
        segment.p1.screen.y,
        segment.p2.screen.x + segment.p2.screen.w - goldWidth2 - whiteWidth2,
        segment.p2.screen.y,
        segment.p2.screen.x - segment.p2.screen.w + goldWidth2 + whiteWidth2,
        segment.p2.screen.y
    )
    g.endFill()

    // Lane markers
    if (segment.color.lane) {
        drawLaneMarkers(g, segment, lanes)
    }
}

function drawLaneMarkers(g: Graphics, segment: Segment, lanes: number): void {
    const lanew1 = (segment.p1.screen.w * 2) / lanes
    const lanew2 = (segment.p2.screen.w * 2) / lanes
    const l1 = segment.p1.screen.w / Math.max(32, 8 * lanes)
    const l2 = segment.p2.screen.w / Math.max(32, 8 * lanes)
    let lanex1 = segment.p1.screen.x - segment.p1.screen.w + lanew1
    let lanex2 = segment.p2.screen.x - segment.p2.screen.w + lanew2

    for (
        let lane = 1;
        lane < lanes;
        lanex1 += lanew1, lanex2 += lanew2, lane++
    ) {
        // Pointillés blancs
        if (segment.index % 50 < 10) {
            g.fill(segment.color.lane!)
            g.moveTo(lanex1 - l1 / 2, segment.p1.screen.y)
            g.lineTo(lanex1 + l1 / 2, segment.p1.screen.y)
            g.lineTo(lanex2 + l2 / 2, segment.p2.screen.y)
            g.lineTo(lanex2 - l2 / 2, segment.p2.screen.y)
            g.closePath()
            g.endFill()
        }

        // Lignes foncées au milieu des voies avec effet de flou
        const lanePositions = [
            { x1: lanex1 - lanew1 / 2, x2: lanex2 - lanew2 / 2 }, // Première voie
            { x1: lanex1 + lanew1 / 2, x2: lanex2 + lanew2 / 2 }, // Deuxième voie
            {
                x1: lanex1 + lanew1 * 1.5,
                x2: lanex2 + lanew2 * 1.5,
            }, // Troisième voie
        ]

        // Pour chaque voie
        lanePositions.forEach((pos) => {
            // 5 couches de flou
            for (let i = 0; i < 5; i++) {
                const width1 = l1 * (4 - i * 0.5) // Diminue progressivement la largeur
                const width2 = l2 * (4 - i * 0.5)
                const alpha = 0.04 * Math.pow(0.8, i) // Opacité réduite pour un effet plus subtil

                g.fill(0x606060, alpha) // Gris plus clair
                polygon(
                    g,
                    pos.x1 - width1 / 2,
                    segment.p1.screen.y,
                    pos.x1 + width1 / 2,
                    segment.p1.screen.y,
                    pos.x2 + width2 / 2,
                    segment.p2.screen.y,
                    pos.x2 - width2 / 2,
                    segment.p2.screen.y
                )
                g.endFill()
            }
        })
    }
}

function polygon(
    g: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
): void {
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.lineTo(x3, y3)
    g.lineTo(x4, y4)
    g.closePath()
}
