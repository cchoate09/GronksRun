export class InputManager {
    public keys: { [key: string]: boolean } = {};
    public previousKeys: { [key: string]: boolean } = {};
    
    public joystick: { x: number, y: number } = { x: 0, y: 0 };
    public previousJoystick: { x: number, y: number } = { x: 0, y: 0 };
    private actions: Set<string> = new Set();
    private processedActions: Set<string> = new Set();

    constructor() {
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Listen for messages from React Native WebView
        window.addEventListener('message', this.onMessage.bind(this));
        document.addEventListener('message', this.onMessage.bind(this) as any);
    }

    private onKeyDown(e: KeyboardEvent): void {
        this.keys[e.code] = true;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.keys[e.code] = false;
    }

    private onMessage(e: any): void {
        try {
            // Support both direct data and event.data (for window.postMessage vs document.message)
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            
            if (data.type === 'joystickMove') {
                this.joystick.x = data.x;
                this.joystick.y = data.y;
            } else if (data.type === 'action') {
                this.actions.add(data.name);
            }
        } catch (err) {
            console.error('Failed to parse message:', err);
        }
    }

    public update(): void {
        this.processedActions.clear();
        for (const action of this.actions) {
            this.processedActions.add(action);
        }
        this.actions.clear();
    }

    public endFrame(): void {
        for (const key in this.keys) {
            this.previousKeys[key] = this.keys[key];
        }
        this.previousJoystick = { ...this.joystick };
        this.processedActions.clear();
    }

    public isDown(code: string): boolean {
        if (code === 'ArrowLeft') return !!this.keys[code] || this.joystick.x < -0.3;
        if (code === 'ArrowRight') return !!this.keys[code] || this.joystick.x > 0.3;
        if (code === 'ArrowUp') return !!this.keys[code] || this.joystick.y < -0.55;
        if (code === 'ArrowDown') return !!this.keys[code] || this.joystick.y > 0.55;
        return !!this.keys[code];
    }

    public justPressed(code: string): boolean {
        if (code === 'ArrowUp') return (!!this.keys[code] && !this.previousKeys[code]) || (this.joystick.y < -0.55 && this.previousJoystick.y >= -0.55);
        if (code === 'ArrowDown') return (!!this.keys[code] && !this.previousKeys[code]) || (this.joystick.y > 0.55 && this.previousJoystick.y <= 0.55);
        return (!!this.keys[code] && !this.previousKeys[code]);
    }

    public actionJustPressed(name: string): boolean {
        return this.processedActions.has(name);
    }

    public suppressKey(code: string): void {
        this.keys[code] = false;
        this.previousKeys[code] = false;
    }

    public clearActions(): void {
        this.actions.clear();
        this.processedActions.clear();
    }
}
