// --- RENDERING & LOGIC ---
export const FPS = 60
export const STEP = 1 / FPS
export const WIDTH = window.innerWidth // largeur logique du canvas
export const HEIGHT = window.innerHeight
export const FIELD_OF_VIEW = 100 // angle du FOV en degrés (utile si jamais 3d)
export const CAMERA_HEIGHT = 1000 // hauteur de la caméra au-dessus de la route
export const PLAYER_Z = CAMERA_HEIGHT * 1.0 // profondeur du joueur derrière la caméra
export const HORIZON = HEIGHT * 0.47 // position verticale de l'horizon

// --- ROUTE & SEGMENTS ---
export const ROAD_WIDTH = 1200 // largeur de la route (utilisée partout)
export const DRAW_DISTANCE = 300 // distance de vue augmentée (2x plus loin)
export const SEGMENT_LENGTH = 250 // longueur d'un segment (en px ou logique)
export const RUMBLE_LENGTH = 3 // nombre de segments entre chaque bordure
export const LANE_COUNT = 3 // nombre de voies pour le joueur

// --- CAMERA DEADZONE ROAD RASH ---
export const CAMERA_DEADZONE = 100 // Zone neutre où la caméra ne bouge pas (pixels)
export const CAMERA_OFFSET_MAX = 300 // Décalage maximum de la caméra (pixels)
export const CAMERA_SMOOTH = 0.1 // Lissage de la caméra (plus bas = plus smooth)
export const CURVE_SCALE = 200 // facteur d'intensité des virages (affichage)
export const CENTRIFUGAL_FORCE = 0.15 // force centrifuge dans les virages (réduite de moitié)

// --- DÉCOR & BORDURES ---
export const SCENERY_SCALE_RANGE = {
    MIN: 0.05, // Taille minimale au loin
    MAX: 3.0, // Taille maximale hors écran
    PLAYER_LEVEL: 0.9, // Taille au niveau du joueur (80% de la taille max)
    CURVE: 2, // Courbe de progression
} // échelle min/max des éléments de décor

export const DIRT_BORDER = {
    COLOR: 0x5c3c24, // marron foncé pour la terre
    WIDTH_FACTOR: 0.4, // 40% de la largeur de la bordure principale
    ALPHA: 0.6, // légère transparence pour l'effet flou
}

// --- CONTRÔLES JOUEUR ---
export const PLAYER_MOVE_SPEED = 0.1 // vitesse de déplacement latéral (plus lent)
export const PLAYER_BOUNDS_FACTOR = 0.85 // limite les déplacements à 85% de la largeur de la route

// --- INCLINAISON JOUEUR ---
export const PLAYER_TILT_MAX = 0.2 // inclinaison maximale en radians (~11.5 degrés)
export const PLAYER_TILT_SPRING = 10 // vitesse de retour à la position neutre (plus rapide)
export const PLAYER_TILT_CURVE_RESPONSE = 1.2 // sensibilité aux virages (plus réactif)
export const PLAYER_LOOK_AHEAD_SEGMENTS = 6 // moins de segments pour une réponse plus directe

// --- CONSTANTES POUR LA GÉNÉRATION DE ROUTE (méthode Jake Gordon) ---
export const ROAD = {
    LENGTH: {
        NONE: 0,
        SHORT: 25,
        MEDIUM: 50,
        LONG: 100,
        VERY_LONG: 200,
    },
    CURVE: {
        NONE: 0,
        EASY: 2,
        MEDIUM: 4,
        HARD: 6,
        EXTREME: 8,
    },
}

// --- GAMEPLAY & PHYSIQUE ---
export const ROAD_SPEED = 2000 // vitesse de base pour le calcul du speedFactor
export const MAX_SPEED = (SEGMENT_LENGTH / STEP) * 1.5 // vitesse max beaucoup plus élevée pour sensation Road Rash extrême
export const ACCELERATION = MAX_SPEED * 2 // accélération puissante mais progressive
export const BRAKE = MAX_SPEED * 1.2 // frein efficace
export const AUTO_DECELERATION = -MAX_SPEED / 5 // décélération automatique plus douce et plus lente
export const OFF_ROAD_DECEL = -MAX_SPEED / 2 // décélération hors route brutale
export const OFF_ROAD_LIMIT = MAX_SPEED / 4 // vitesse max hors route
export const MIN_SPEED = 0 // vitesse minimale du jeu

// --- COULEURS ---
export const ROAD_COLOR = 0x4d4d4d
export const ROAD_SIDE_COLOR = 0x218c28
export const BORDER_COLOR = 0xb89d70
export const BORDER_WIDTH = 10

export const DASH_INTERVAL_SEGMENTS = 18
export const DASH_LENGTH_SEGMENTS = 7

export const PLAYER_LANES = LANE_COUNT // alias pour l'affichage

export const MOTO_COLORS = [0xff0000, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]

export const TREE_COLOR = 0x117700
export const ROCK_COLOR = 0x888888
export const BUILDING_COLOR = 0x915621

// Couleurs pour les segments de terrain en perspective
export const TERRAIN_FAR_COLOR = 0x1e7a1e // Vert foncé pour l'horizon
export const TERRAIN_FIELD_COLOR = 0x2d8a2d // Vert légèrement différent pour les champs
