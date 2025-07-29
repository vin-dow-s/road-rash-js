// --- RENDERING & LOGIC ---
export const FPS = 60
export const STEP = 1 / FPS

export const WIDTH = window.innerWidth // largeur logique du canvas
export const HEIGHT = window.innerHeight
export const HORIZON = HEIGHT * 0.47 // position verticale de l'horizon

export const FIELD_OF_VIEW = 100 // angle du FOV en degrés (utile si jamais 3d)
export const CAMERA_HEIGHT = 1000 // hauteur de la caméra au-dessus de la route
export const PLAYER_Z = CAMERA_HEIGHT * 1.0 // profondeur du joueur derrière la caméra

// --- ROUTE & SEGMENTS ---
export const DRAW_DISTANCE = 300 // distance de vue augmentée (2x plus loin)
export const SEGMENT_LENGTH = 250 // longueur d'un segment (en px ou logique)
export const ROAD_WIDTH = 1700 // largeur de la route (utilisée partout)
export const ROAD_MIN_WIDTH = 150 // largeur minimale visuelle à l'horizon
export const ROAD_MAX_WIDTH = 1700 // largeur max visuelle proche joueur
export const RUMBLE_LENGTH = 3 // nombre de segments entre chaque bordure
export const LANE_COUNT = 3 // nombre de voies pour le joueur

export const CURVE_SCALE = 400 // facteur d'intensité des virages (affichage)
export const CENTRIFUGAL_FORCE = 0.15 // force centrifuge dans les virages (réduite de moitié)

// --- PERSPECTIVE & BROUILLARD ---
export const FOG_DENSITY = 8 // densité du brouillard pour l'effet de distance
export const HORIZON_FADE_START = 5 // à partir de quelle distance commencer le fondu vers l'horizon
export const ROAD_HORIZON_COLOR = 0x87ceeb // couleur de la route à l'horizon (bleu ciel)
export const MIN_SEGMENT_WIDTH = 2 // largeur minimale des segments à l'horizon

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
export const MAX_SPEED = SEGMENT_LENGTH / STEP // vitesse max multipliée par 4 pour sensation Road Rash extrême
export const ACCELERATION = MAX_SPEED // accélération progressive mais puissante
export const BRAKE = MAX_SPEED * 1.8 // frein plus efficace
export const OFF_ROAD_DECEL = -MAX_SPEED / 1.5 // décélération hors route plus forte
export const OFF_ROAD_LIMIT = MAX_SPEED / 3 // vitesse max hors route
export const ROAD_SPEED = 7500 // vitesse de croisière plus élevée pour sensation de vitesse

// --- ENNEMIS / AUTRES ---
export const MAX_ENEMIES = 4 // Plus d'ennemis pour plus d'action
export const ENEMY_SPAWN_RATE = 1.8 // Spawn plus fréquent des ennemis

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
