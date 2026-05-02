import { GameEngine } from './engine/GameEngine';
import { GameScene } from './game/scenes/GameScene';

declare global {
    interface Window {
        render_game_to_text?: () => string;
        advanceTime?: (ms: number) => void;
        ReactNativeWebView?: { postMessage: (payload: string) => void };
    }
}

async function bootstrap() {
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element 'c' not found.");
        return;
    }

    const engine = new GameEngine();
    await engine.initialize(canvas);
    
    // Load the main game scene
    await engine.scenes.loadScene(GameScene);

    window.render_game_to_text = () => JSON.stringify({
        coordinate_system: 'origin top-left, x right, y down',
        ...((engine.scenes.getSnapshot() as object | null) || { phase: 'LOADING' }),
    });
    window.advanceTime = (ms: number) => {
        engine.step(ms);
    };
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'gameReady' }));
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrap().catch((error) => {
            console.error('Game bootstrap failed:', error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'crash',
                phase: 'BOOTSTRAP',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            }));
        });
    });
} else {
    bootstrap().catch((error) => {
        console.error('Game bootstrap failed:', error);
        window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'crash',
            phase: 'BOOTSTRAP',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        }));
    });
}
