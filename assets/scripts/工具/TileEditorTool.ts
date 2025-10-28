import { _decorator, Component, Node, Prefab, instantiate, Sprite, SpriteFrame, Color } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode, disallowMultiple, menu } = _decorator;

@ccclass('TileEditorTool')
@executeInEditMode(true)
@disallowMultiple()
@menu('工具/TileEditorTool')
export class TileEditorTool extends Component {
    @property({ type: Prefab, tooltip: '要生成到每个地块上的预制体' })
    floorPrefab: Prefab | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为白色时使用的图片' })
    whiteImage: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为黄色时使用的图片' })
    yellowImage: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为绿色时使用的图片' })
    greenImage: SpriteFrame | null = null;

    @property({ tooltip: '切换为 true 执行一次处理（执行后会自动恢复为 false）' })
    runOnce = false;

    private _running = false;

    // 仅用于显示已被关闭的地块图片
    @property({ tooltip: '切换为 true 开启所有地块图片显示（执行后自动复位）' })
    showSpritesOnce = false;
    private _showRunning = false;

    update() {
        if (!EDITOR) return;
        if (this.runOnce && !this._running) {
            this._running = true;
            try {
                this.processTiles();
            } finally {
                this.runOnce = false;
                this._running = false;
            }
        }

        if (this.showSpritesOnce && !this._showRunning) {
            this._showRunning = true;
            try {
                this.setTileSpritesVisible(true);
            } finally {
                this.showSpritesOnce = false;
                this._showRunning = false;
            }
        }
    }

    private processTiles() {
        const tiles = this.collectTiles(this.node);
        for (const tile of tiles) {
            const coords = this.parseTileName(tile.name);
            if (!coords) continue;
            const { x, y } = coords;
            if (x > 20 || y > 20) {
                tile.destroy();
                continue;
            }

            const tileSprite = this.findSprite(tile);
            const colorType = this.getColorType(tileSprite);

            if (this.floorPrefab) {
                const inst = instantiate(this.floorPrefab);
                inst.name = `${tile.name}-floor`;
                tile.addChild(inst);
                inst.setPosition(0, 0, 0);
                // 生成后取消预制体关联（避免运行时被还原）
                this.unlinkPrefabInstance(inst);

                const prefabSprite = this.findSprite(inst);
                if (prefabSprite) {
                    const frame = this.pickSpriteFrame(colorType);
                    if (frame) prefabSprite.spriteFrame = frame;
                }
            }

            // 按用户要求：处理后将地块的图片关闭显示
            // if (tileSprite) tileSprite.enabled = false;
        }
    }

    private collectTiles(root: Node): Node[] {
        const result: Node[] = [];
        for (const child of root.children) {
            if (this.isTileNode(child.name)) result.push(child);
        }
        return result;
    }

    private isTileNode(name: string): boolean {
        return /^([Tt]ile)_\d+_\d+$/.test(name);
    }

    private parseTileName(name: string): { x: number; y: number } | null {
        const m = name.match(/^([Tt]ile)_(\d+)_(\d+)$/);
        if (!m) return null;
        return { x: parseInt(m[2], 10), y: parseInt(m[3], 10) };
    }

    private findSprite(node: Node): Sprite | null {
        return node.getComponent(Sprite) || node.getComponentInChildren(Sprite);
    }

    private getColorType(sprite: Sprite | null): 'white' | 'yellow' | 'green' | null {
        if (!sprite) return null;
        const c = sprite.color;
        if (this.colorEquals(c, 255, 255, 255)) return 'white';
        if (this.colorEquals(c, 255, 255, 0)) return 'yellow';
        // 绿色编号为 00FF5C => (0, 255, 92)
        if (this.colorEquals(c, 0, 255, 92)) return 'green';
        return null;
    }

    private pickSpriteFrame(type: 'white' | 'yellow' | 'green' | null): SpriteFrame | null {
        switch (type) {
            case 'white':
                return this.whiteImage;
            case 'yellow':
                return this.yellowImage;
            case 'green':
                return this.greenImage;
            default:
                return null;
        }
    }

    private setTileSpritesVisible(visible: boolean) {
        const tiles = this.collectTiles(this.node);
        for (const tile of tiles) {
            const sp = this.findSprite(tile);
            if (sp) sp.enabled = visible;
        }
    }

    private colorEquals(color: Color, r: number, g: number, b: number): boolean {
        return color.r === r && color.g === g && color.b === b;
    }

    // 取消与预制体的关联：清除内部 _prefab 标记（编辑器环境下）
    private unlinkPrefabInstance(node: Node) {
        const clear = (n: Node) => {
            try {
                (n as any)._prefab = null;
            } catch {}
            for (const c of n.children) clear(c);
        };
        clear(node);
    }
}