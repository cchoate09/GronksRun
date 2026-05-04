export interface MainMenuButtonLayout {
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface MainMenuLayout {
    titleY: number;
    titleFontSize: number;
    subtitleY: number;
    subtitleFontSize: number;
    buttons: MainMenuButtonLayout[];
}

const MAIN_BUTTON_LABELS = ['CONTINUE', 'ENDLESS RUN', 'LEVEL SELECT', 'SETTINGS'];

export function getMainMenuLayout(width: number, height: number): MainMenuLayout {
    const compact = height < 520 || width < 760;
    const safeWidth = Math.max(320, width);
    const safeHeight = Math.max(300, height);

    if (compact) {
        const titleFontSize = Math.min(48, Math.max(34, safeWidth * 0.058));
        const titleY = Math.min(62, Math.max(44, safeHeight * 0.16));
        const subtitleFontSize = Math.min(17, Math.max(13, safeWidth * 0.021));
        const subtitleY = titleY + Math.max(38, titleFontSize * 0.86);
        const gapX = Math.min(18, Math.max(10, safeWidth * 0.018));
        const gapY = 10;
        const buttonW = Math.min(230, Math.max(142, (safeWidth - 88 - gapX) / 2));
        const buttonH = safeHeight < 380 ? 42 : 46;
        const totalW = buttonW * 2 + gapX;
        const totalH = buttonH * 2 + gapY;
        const startX = (safeWidth - totalW) / 2;
        const preferredY = Math.max(subtitleY + 28, safeHeight * 0.42);
        const maxY = safeHeight - 18 - totalH;
        const startY = Math.max(118, Math.min(preferredY, maxY));

        return {
            titleY,
            titleFontSize,
            subtitleY,
            subtitleFontSize,
            buttons: MAIN_BUTTON_LABELS.map((label, index) => ({
                label,
                x: startX + (index % 2) * (buttonW + gapX),
                y: startY + Math.floor(index / 2) * (buttonH + gapY),
                w: buttonW,
                h: buttonH,
            })),
        };
    }

    const titleFontSize = Math.min(72, Math.max(44, safeWidth * 0.07));
    const titleY = Math.max(76, safeHeight * 0.2);
    const subtitleFontSize = 20;
    const subtitleY = titleY + 58;
    const buttonW = 260;
    const heights = [58, 54, 50, 46];
    const gap = 12;
    const totalH = heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
    const preferredY = Math.max(subtitleY + 48, safeHeight * 0.46);
    const startY = Math.min(preferredY, safeHeight - 22 - totalH);
    const x = safeWidth / 2 - buttonW / 2;
    let y = Math.max(210, startY);

    return {
        titleY,
        titleFontSize,
        subtitleY,
        subtitleFontSize,
        buttons: MAIN_BUTTON_LABELS.map((label, index) => {
            const button = { label, x, y, w: buttonW, h: heights[index] };
            y += heights[index] + gap;
            return button;
        }),
    };
}
