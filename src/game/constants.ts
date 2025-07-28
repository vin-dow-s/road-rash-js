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
export const DRAW_DISTANCE = 60 // nombre de segments à dessiner
export const SEGMENT_LENGTH = 250 // longueur d'un segment (en px ou logique)
export const ROAD_WIDTH = 1700 // largeur de la route (utilisée partout)
export const ROAD_MIN_WIDTH = 150 // largeur minimale visuelle à l'horizon
export const ROAD_MAX_WIDTH = 1700 // largeur max visuelle proche joueur
export const RUMBLE_LENGTH = 3 // nombre de segments entre chaque bordure
export const LANE_COUNT = 3 // nombre de voies pour le joueur

export const CURVE_SCALE = 400 // facteur d'intensité des virages (affichage)

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
