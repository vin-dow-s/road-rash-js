// Constantes pour le joueur
export const PLAYER_SPEED = 450 // Vitesse augmentée pour la route plus large
export const PLAYER_WIDTH = 175
export const PLAYER_HEIGHT = 175

// Création de l'état initial du joueur
export const createPlayerState = () => ({
    x: window.innerWidth / 2 - PLAYER_WIDTH / 2,
    y: window.innerHeight - PLAYER_HEIGHT - 170,
    speed: PLAYER_SPEED,
    isMovingLeft: false,
    isMovingRight: false,
    rotation: 0, // Angle de rotation de la moto
})

// Mise à jour de la position du joueur avec limites adaptées à la route large
export const updatePlayerPosition = (
    playerState,
    deltaTime,
    roadCenterX,
    roadWidthAtPlayer
) => {
    let newX = playerState.x
    const movement = playerState.speed * deltaTime

    // Limites dynamiques
    const minX = roadCenterX - roadWidthAtPlayer / 2 + 50
    const maxX = roadCenterX + roadWidthAtPlayer / 2 - PLAYER_WIDTH - 50

    if (playerState.isMovingLeft) {
        newX = Math.max(minX, newX - movement)
    }
    if (playerState.isMovingRight) {
        newX = Math.min(maxX, newX + movement)
    }

    // Calcul de la rotation
    const targetRotation = playerState.isMovingLeft
        ? -0.3 // Penché à gauche
        : playerState.isMovingRight
        ? 0.3 // Penché à droite
        : 0 // Droit

    // Lissage de la rotation (interpolation)
    const rotationSpeed = 8 // Vitesse de transition
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
