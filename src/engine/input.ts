export class InputManager {
    public keys: { [key: string]: boolean } = {};
    public previousKeys: { [key: string]: boolean } = {};
    
    public joystick: { x: number, y: number } = { x: 0, y: 0 };
    private actions: Set<string> = new Set();
    private processedActions: Set<string> = new Set();

    constructor() {
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        window.addEventListener('message', this.onMessage.bind(this));
    }

    private onKeyDown(e: KeyboardEvent): void {
        this.keys[e.code] = true;
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.keys[e.code] = false;
    }

    private onMessage(e: MessageEvent): void {
        try {
            const data = JSON.parse(e.data);
            if (data.type === 'joystickMove') {
                this.joystick.x = data.x;
                this.joystick.y = data.y;
            } else if (data.type === 'action') {
                this.actions.add(data.name);
            }
        } catch (err) {}
    }

    public update(): void {
        // Copy current state to previous state for 'just pressed' logic
        for (const key in this.keys) {
            this.previousKeys[key] = this.keys[key];
        }
        
        // Sync joystick to keys for hybrid support
        this.keys['ArrowLeft'] = this.joystick.x < -0.3;
        this.keys['ArrowRight'] = this.joystick.x > 0.3;
        
        // Clear processed actions
        this.processedActions.clear();
        for (const action of this.actions) {
            this.processedActions.add(action);
        }
        this.actions.clear();
    }

    public isDown(code: string): boolean {
        return !!this.keys[code];
    }

    public justPressed(code: string): boolean {
        return (!!this.keys[code] && !this.previousKeys[code]);
    }

    public actionJustPressed(name: string): boolean {
        return this.processedActions.has(name);
    }
}
