/**
 * Fonctions d'easing pour les courbes (méthode Jake Gordon)
 */

/**
 * Transition en ease-in (accélération)
 */
export function easeIn(a: number, b: number, percent: number): number {
    return a + (b - a) * Math.pow(percent, 2)
}

/**
 * Transition en ease-out (décélération)
 */
export function easeOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (1 - Math.pow(1 - percent, 2))
}

/**
 * Transition en ease-in-out (accélération puis décélération)
 */
export function easeInOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5)
}
