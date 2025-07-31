import React, { useEffect, useRef } from "react"
import { GameEngine } from "../game/GameEngine3"

export default function GameCanvas() {
    const containerRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<GameEngine | null>(null)
    const isInitializingRef = useRef<boolean>(false)

    useEffect(() => {
        const initEngine = async () => {
            // Éviter les initialisations multiples (React StrictMode)
            if (
                isInitializingRef.current ||
                engineRef.current ||
                !containerRef.current
            ) {
                return
            }

            try {
                isInitializingRef.current = true

                const engine = new GameEngine()
                engineRef.current = engine

                await engine.init(containerRef.current)
            } catch (error) {
                // Cleanup en cas d'erreur
                if (engineRef.current) {
                    engineRef.current.destroy()
                    engineRef.current = null
                }
            } finally {
                isInitializingRef.current = false
            }
        }

        // Délai pour éviter les problèmes de double mounting en StrictMode
        const timeoutId = setTimeout(initEngine, 100)

        return () => {
            clearTimeout(timeoutId)

            if (engineRef.current && !isInitializingRef.current) {
                engineRef.current.destroy()
                engineRef.current = null
            }
        }
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100vw",
                height: "100vh",
                position: "absolute",
                top: 0,
                left: 0,
                overflow: "hidden",
                backgroundColor: "#000000", // Fallback pendant l'init
            }}
        />
    )
}
