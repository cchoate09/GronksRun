export class InputManager {
    public keys: { [key: string]: boolean } = {};
    public previousKeys: { [key: string]: boolean } = {};

    public joystick: { x: number, y: number } = { x: 0, y: 0 };
    public previousJoystick: { x: number, y: number } = { x: 0, y: 0 };

    // Inbox: actions arriving from the WebView bridge between frames.
    // The inbox itself preserves order and multiplicity, but consumers query
    // via actionJustPressed(name) which is membership-only. Net semantics:
    // "for each unique action name received this frame, fire at most once."
    // That matches every current consumer (Player guards every action with
    // its own state machine: !isAttacking, onGround, cooldown, etc.) so a
    // second tap of the same action within one outer frame would be ignored
    // anyway. If a future consumer needs true multi-fire, change this field
    // to a Map<string, number> and expose consumeAction(name): number.
    private inbox: string[] = [];
    // Drained on the first sub-step of each outer update() and held for the
    // entire frame, so consumers in render or post-substep logic still see
    // actionJustPressed() as true. NB: it's intentional that inbox can be
    // non-empty later in the frame (messages arriving between sub-steps);
    // those wait until the next frame's first sub-step.
    private processedActions: string[] = [];
    private firstSubStepThisFrame: boolean = true;

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
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

            if (data.type === 'joystickMove') {
                const x = typeof data.x === 'number' && Number.isFinite(data.x) ? data.x : 0;
                const y = typeof data.y === 'number' && Number.isFinite(data.y) ? data.y : 0;
                this.joystick.x = Math.max(-1, Math.min(1, x));
                this.joystick.y = Math.max(-1, Math.min(1, y));
            } else if (data.type === 'action' && typeof data.name === 'string' && data.name.length > 0) {
                this.inbox.push(data.name);
            }
        } catch (err) {
            console.error('Failed to parse message:', err);
        }
    }

    // Called at the start of every outer engine frame. Clears the previous
    // frame's processed actions and resets the sub-step latch.
    public beginFrame(): void {
        this.processedActions.length = 0;
        this.firstSubStepThisFrame = true;
    }

    // Called once per fixed-step sub-step. Drains the inbox into
    // processedActions on the first sub-step only so a tap consumed by
    // sub-step #1 stays visible to sub-steps #2..N within the same outer frame.
    public update(): void {
        if (this.firstSubStepThisFrame && this.inbox.length > 0) {
            for (const action of this.inbox) this.processedActions.push(action);
            this.inbox.length = 0;
        }
        this.firstSubStepThisFrame = false;
    }

    public endFrame(): void {
        for (const key in this.keys) {
            this.previousKeys[key] = this.keys[key];
        }
        this.previousJoystick = { x: this.joystick.x, y: this.joystick.y };
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
        return this.processedActions.includes(name);
    }

    public suppressKey(code: string): void {
        this.keys[code] = false;
        this.previousKeys[code] = false;
    }

    public clearActions(): void {
        this.inbox.length = 0;
        this.processedActions.length = 0;
        this.firstSubStepThisFrame = true;
    }
}
