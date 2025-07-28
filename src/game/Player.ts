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
    deltaTime: number,
    roadCenterX: number,
    roadWidthAtPlayer: number
): PlayerState {
    let newX = playerState.x
    const movement = playerState.speed * deltaTime

    // Limites dynamiques
    const minX = roadCenterX - roadWidthAtPlayer
    const maxX = roadCenterX + roadWidthAtPlayer - PLAYER_WIDTH

    if (playerState.isMovingLeft) {
        newX = Math.max(minX, newX - movement)
    }
    if (playerState.isMovingRight) {
        newX = Math.min(maxX, newX + movement)
    }

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
