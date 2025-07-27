// Constantes pour le joueur
export const PLAYER_SPEED = 450 // Vitesse augmentée pour la route plus large
export const PLAYER_WIDTH = 40
export const PLAYER_HEIGHT = 80

// Création de l'état initial du joueur
export const createPlayerState = () => ({
    x: window.innerWidth / 2 - PLAYER_WIDTH / 2,
    y: window.innerHeight - PLAYER_HEIGHT - 170,
    speed: PLAYER_SPEED,
    isMovingLeft: false,
    isMovingRight: false,
})

// Mise à jour de la position du joueur avec limites adaptées à la route large
export const updatePlayerPosition = (playerState, deltaTime) => {
    let newX = playerState.x
    const movement = playerState.speed * deltaTime

    // Limites horizontales adaptées à la route large (plus permissives)
    const roadCenterX = window.innerWidth / 2
    const roadWidthAtPlayer = 800 // Largeur approximative de la route au niveau du joueur
    const minX = roadCenterX - roadWidthAtPlayer / 2 + 50
    const maxX = roadCenterX + roadWidthAtPlayer / 2 - PLAYER_WIDTH - 50

    if (playerState.isMovingLeft) {
        newX = Math.max(minX, newX - movement)
    }
    if (playerState.isMovingRight) {
        newX = Math.min(maxX, newX + movement)
    }

    return { ...playerState, x: newX }
}
