import { Graphics } from "pixi.js"

export interface SpeedGaugeOptions {
    x: number
    y: number
    width: number
    height: number
    currentSpeed: number
    maxSpeed: number
    minSpeed?: number
}

export function drawSpeedGauge(g: Graphics, options: SpeedGaugeOptions): void {
    const {
        x,
        y,
        width,
        height,
        currentSpeed,
        maxSpeed,
        minSpeed = 0,
    } = options

    // Fond de la jauge
    g.fill(0x111111, 0.75)
    g.rect(x, y, width, height)
    g.endFill()

    // Calcul du ratio de vitesse
    const currentSpeedClamped = Math.max(
        minSpeed,
        Math.min(maxSpeed, currentSpeed)
    )
    const speedRatio =
        maxSpeed > 0
            ? (currentSpeedClamped - minSpeed) / (maxSpeed - minSpeed)
            : 0

    // Largeur de la jauge (avec marge de 6px de chaque côté)
    const gaugeWidth = speedRatio * (width - 12)

    // Couleur de la jauge selon la vitesse
    let color = 0x4fff66 // Vert pour vitesse basse
    if (speedRatio > 0.4) color = 0xffaa44 // Orange pour vitesse moyenne
    if (speedRatio > 0.7) color = 0xff4444 // Rouge pour vitesse élevée

    // Effet de pulsation à haute vitesse
    const pulseScale =
        speedRatio > 0.8 ? 1 + Math.sin(Date.now() * 0.01) * 0.01 : 1

    // Jauge de vitesse
    g.fill(color)
    g.rect(x + 6, y + 6, gaugeWidth * pulseScale, height - 12)
    g.endFill()

    // Reflet sur la jauge
    g.fill(0xffffff, 0.4)
    g.rect(x + 6, y + 7, gaugeWidth * pulseScale, 3)
    g.endFill()
}
