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
    deltaTime: number,
    roadCenterX: number,
    roadWidthAtPlayer: number
): PlayerState {
    let newX = playerState.x
    const movement = playerState.speed * deltaTime

    // Limites d'écran absolues (priorité sur les limites de route)
    const screenMinX = 0
    const screenMaxX = window.innerWidth - PLAYER_WIDTH

    // Le mouvement latéral est géré dans GameEngine maintenant
    // Cette fonction ne gère que les limites d'écran et la détection hors route

    // newX est déjà défini à playerState.x, pas de mouvement ici
    // Appliquer les limites d'écran en priorité
    newX = Math.max(screenMinX, Math.min(screenMaxX, newX))

    // Calculer le "centre" du joueur (milieu du sprite)
    const playerCenterX = newX + PLAYER_WIDTH / 2

    // Limites visuelles de la route (bord gauche/droit)
    const roadMinX = roadCenterX - roadWidthAtPlayer
    const roadMaxX = roadCenterX + roadWidthAtPlayer

    // Détecter si le joueur est hors route
    const isOffRoad = playerCenterX < roadMinX || playerCenterX > roadMaxX

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
        isOffRoad: isOffRoad,
    }
}
