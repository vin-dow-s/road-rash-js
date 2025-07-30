export const PLAYER_SPEED = 450
export const PLAYER_WIDTH = 175
export const PLAYER_HEIGHT = 175

// Définition du type pour l'état du joueur
export interface PlayerState {
    x: number
    y: number
    speed: number
    isMovingLeft: boolean
    isMovingRight: boolean
    rotation: number
    isOffRoad: boolean
}

/**
 * Crée un état initial du joueur
 */
export function createPlayerState(): PlayerState {
    return {
        x: window.innerWidth / 2 - PLAYER_WIDTH / 2,
        y: window.innerHeight - PLAYER_HEIGHT - 170,
        speed: PLAYER_SPEED,
        isMovingLeft: false,
        isMovingRight: false,
        rotation: 0,
        isOffRoad: false,
    }
}

/**
 * Met à jour la position du joueur (sans dépendance à React)
 * @param playerState
 * @param deltaTime
 * @param roadCenterX - Centre de la route à la position du joueur
 * @param roadWidthAtPlayer - Largeur de la route à la position du joueur
 */
export function updatePlayerPosition(
    playerState: PlayerState,
    deltaTime: number
): PlayerState {
    let newX = playerState.x

    // Limites d'écran absolues (priorité sur les limites de route)
    const screenMinX = 0
    const screenMaxX = window.innerWidth - PLAYER_WIDTH

    // Appliquer les limites d'écran en priorité
    newX = Math.max(screenMinX, Math.min(screenMaxX, newX))

    // Calcul de la rotation
    const targetRotation = playerState.isMovingLeft
        ? -0.3
        : playerState.isMovingRight
        ? 0.3
        : 0

    // Lissage de la rotation (interpolation)
    const rotationSpeed = 8
    const newRotation =
        playerState.rotation +
        (targetRotation - playerState.rotation) *
            Math.min(1, deltaTime * rotationSpeed)

    return {
        ...playerState,
        x: newX,
        rotation: newRotation,
    }
}
