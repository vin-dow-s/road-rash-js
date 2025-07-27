// --- RENDERING & LOGIC ---
export const FPS = 60
export const STEP = 1 / FPS

export const WIDTH = window.innerWidth // largeur logique du canvas
export const HEIGHT = window.innerHeight
export const HORIZON = HEIGHT * 0.47 // position verticale de l'horizon

export const FIELD_OF_VIEW = 100 // angle du FOV en degrés (inutile si tu restes en 2.5D)
export const CAMERA_HEIGHT = 1000 // hauteur de la caméra au-dessus de la route
export const PLAYER_Z = CAMERA_HEIGHT * 1.0 // profondeur du joueur derrière la caméra

// --- ROUTE & SEGMENTS ---
export const DRAW_DISTANCE = 40 // nombre de segments à dessiner
export const SEGMENT_LENGTH = 250 // longueur d'un segment (en px ou logique)
export const ROAD_WIDTH = 2000 // largeur de la route (utilisée partout)
export const ROAD_MIN_WIDTH = 150 // largeur minimale visuelle à l'horizon
export const ROAD_MAX_WIDTH = 2000 // largeur max visuelle proche joueur
export const RUMBLE_LENGTH = 3 // nombre de segments entre chaque bordure
export const LANE_COUNT = 3 // nombre de voies pour le joueur

export const CURVE_SCALE = 900 // facteur d'intensité des virages (affichage)

// --- GAMEPLAY & PHYSIQUE ---
export const MAX_SPEED = SEGMENT_LENGTH / STEP / 7 // vitesse max (un segment par frame max)
export const ACCELERATION = MAX_SPEED // accélération (ressenti arcade)
export const BRAKE = MAX_SPEED // frein
export const OFF_ROAD_DECEL = -MAX_SPEED / 2 // décélération hors route
export const OFF_ROAD_LIMIT = MAX_SPEED / 4 // vitesse max hors route
export const ROAD_SPEED = 450 // vitesse de croisière (base, peut être utile pour IA/ennemis)

// --- ENNEMIS / AUTRES ---
export const MAX_ENEMIES = 2
export const ENEMY_SPAWN_RATE = 2.8

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
