import { useEffect, useRef } from "react"

export const useGameLoop = (callback) => {
    const frameId = useRef()
    const previousTime = useRef()

    const animate = (currentTime) => {
        if (previousTime.current !== undefined) {
            const deltaTime = (currentTime - previousTime.current) / 1000
            callback(deltaTime)
        }
        previousTime.current = currentTime
        frameId.current = requestAnimationFrame(animate)
    }

    useEffect(() => {
        frameId.current = requestAnimationFrame(animate)
        return () => {
            if (frameId.current) {
                cancelAnimationFrame(frameId.current)
            }
        }
    }, [])
}
