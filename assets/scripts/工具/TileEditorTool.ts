import { _decorator, Component, Node, Prefab, instantiate, Sprite, SpriteFrame, Color, Graphics, UITransform, Vec3 } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode, disallowMultiple, menu } = _decorator;

@ccclass('TileEditorTool')
@executeInEditMode(true)
export class TileEditorTool extends Component {
    @property({ type: Prefab, tooltip: '要生成到每个地块上的预制体' })
    floorPrefab: Prefab | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为白色时使用的图片' })
    whiteImage: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为黄色时使用的图片' })
    yellowImage: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '当地块颜色为绿色时使用的图片' })
    greenImage: SpriteFrame | null = null;

    // 运行期：布尔开关，是否显示路径（四向相邻）
    @property({ tooltip: '运行时是否显示路径（四向相邻）' })
    showPath: boolean = false;
    @property({ type: Color, tooltip: '连线颜色' })
    lineColor: Color = new Color(0, 200, 255, 255);
    @property({ tooltip: '连线宽度' })
    lineWidth: number = 2;
    @property({ type: Node, tooltip: '用于挂载绘制线段的节点（可选）' })
    lineLayerNode: Node | null = null;
    @property({ tooltip: '权重矩形尺寸（像素）' })
    markerSize: number = 10;
    @property({ type: Node, tooltip: '权重容器（背景节点，决定颜色/成本）' })
    weightContainerNode: Node | null = null;
    @property({ type: Node, tooltip: '障碍容器（MapContainer，用于占用/封锁）' })
    obstacleContainerNode: Node | null = null;
    // 特殊景区出入口（可选，直接指定为场景中的节点）
    @property({ type: [Node], tooltip: '特殊景区出入口节点数组（与导航最近点相连，权重0）' })
    scenicEntranceNodes: Node[] = [];
    @property({ tooltip: '打印调试日志' })
    debugLog: boolean = true;

    // 运行期：可选的起点与终点 Tile 节点（不设置则自动选择首/尾可通行地块）
    @property({ type: Node, tooltip: '起点 Tile（可选）' })
    startTile: Node | null = null;
    @property({ type: Node, tooltip: '终点 Tile（可选）' })
    endTile: Node | null = null;

    @property({ tooltip: '切换为 true 执行一次处理（执行后会自动恢复为 false）' })
    runOnce = false;

    private _running = false;

    // 仅用于显示已被关闭的地块图片
    @property({ tooltip: '切换为 true 开启所有地块图片显示（执行后自动复位）' })
    showSpritesOnce = false;
    private _showRunning = false;

    // ===== 导航图数据（运行时使用） =====
    private _tilesByName: Map<string, Node> = new Map();
    private _costByName: Map<string, number> = new Map(); // Infinity 表示不可通行
    private _neighbors: Map<string, string[]> = new Map();
    private _currentPath: string[] = [];
    private _originalColors: Map<string, Color> = new Map();
    private _lastShowPath: boolean = false;
    private _lineLayer: Node | null = null;
    private _lineGraphics: Graphics | null = null;
    private _navContainer: Node | null = null; // 指向权重容器（背景）
    private _obstacleContainer: Node | null = null; // 指向障碍容器（MapContainer）
    private _entranceCounter = 0; // 生成唯一入口名称用

    onLoad() {
        // 不做自动构建，等待外部显式调用 buildNavigationGraph(container)
        // 支持在编辑器模式下显示路径
        this.dbg('onLoad', { EDITOR, showPath: this.showPath, lineLayerNode: this.lineLayerNode?.name || null });
    }

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
            // 删除所有 x >= 15 的地块
            if (x >= 15 || y > 20) {
                tile.destroy();
                continue;
            }

            const tileSprite = this.findSprite(tile);
            const colorType = this.getColorType(tileSprite);

            const childName = `${tile.name}-floor`;
            const existing = tile.getChildByName(childName);

            if (existing) {
                const prefabSprite = this.findSprite(existing);
                if (prefabSprite) {
                    const frame = this.pickSpriteFrame(colorType);
                    if (frame) prefabSprite.spriteFrame = frame;
                }
            } else if (this.floorPrefab) {
                const inst = instantiate(this.floorPrefab);
                inst.name = childName;
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
        const frame = sprite.spriteFrame;
        // 优先基于 SpriteFrame 判断（更可靠，不受颜色混合影响）
        // if (frame && this.whiteImage && frame === this.whiteImage) return 'white';
        // if (frame && this.yellowImage && frame === this.yellowImage) return 'yellow';
        // if (frame && this.greenImage && frame === this.greenImage) return 'green';

        // 兜底：基于颜色近似判断（允许轻微色差）
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
        const tol = 2; // 允许小幅色差
        return Math.abs(color.r - r) <= tol && Math.abs(color.g - g) <= tol && Math.abs(color.b - b) <= tol;
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

    // ====== 运行期：导航图构建与路径可视化 ======

    /**
     * 构建导航图（从指定容器读取，缺省为当前节点或其子节点中的 MapContainer）。
     * - 规则：
     *   1) Tile 下存在除 "Tile_x_y-floor" 以外的子节点 => 视为障碍，不可通行
     *   2) Floor 精灵图片：whiteImage => 不可通行；yellowImage => 成本 1；greenImage => 成本 5
     */
    buildNavigationGraph(obstacleContainer?: Node,weightContainer?: Node) {
        // 权重容器（背景）决定每个 Tile 的颜色与成本；障碍容器（MapContainer）用于覆写不可通行
        const weightRoot = weightContainer || this.weightContainerNode || this._navContainer || this.node;
        const obstacleRoot = obstacleContainer || this.obstacleContainerNode || this._obstacleContainer || null;
        if (!weightRoot) { this.dbg('buildNavigationGraph skipped: no weight container'); return; }
        this._navContainer = weightRoot;
        this._obstacleContainer = obstacleRoot;

        const weightTiles = this.collectTiles(weightRoot);
        this.dbg('buildNavigationGraph: weightRoot=', weightRoot.name, 'tiles=', weightTiles.length, 'obstacleRoot=', obstacleRoot ? obstacleRoot.name : 'none');
        this._tilesByName.clear();
        this._costByName.clear();
        this._neighbors.clear();

        let blockedCount = 0;
        let walkableCount = 0;
        // 不再在此处进行“障碍容器”占用判断，改由 TileOccupancyManager 统一传递占用键
        let blockedByColor = 0;
        const sampleBlocked: string[] = [];
        const sampleWalkable: string[] = [];

        for (const tile of weightTiles) {
            this._tilesByName.set(tile.name, tile);

            // 权重容器不参与占用判断，仅依据颜色确定成本；占用判断在障碍容器进行
            const floorName = `${tile.name}`;
            let cost = 1;
            let blocked = false;

            // 根据 floor 的图片确定成本/障碍
            console.log(tile.name)
            const sp =  this.findSprite(tile);
            const type = this.getColorType(sp);
            // 新规则：仅黄色(FFFF00)与绿色(00FF5C)可通行，其它颜色不可通行（按背景节点颜色）
            if (type === 'yellow') {
                cost = 1;
            } else if (type === 'green') {
                cost = 5;
            } else {
                blocked = true; blockedByColor++;
            }

            // 不根据障碍容器进行占用覆写，阻塞仅由颜色与后续 applyOccupancyBlocks(keys) 决定

            this._costByName.set(tile.name, blocked ? Number.POSITIVE_INFINITY : cost);

            if (blocked) {
                blockedCount++;
                if (sampleBlocked.length < 5) sampleBlocked.push(tile.name);
            } else {
                walkableCount++;
                if (sampleWalkable.length < 5) sampleWalkable.push(tile.name);
            }
        }

        // 邻接（仅四向）：按 Tile_i_j 命名推断
        for (const [name, tile] of this._tilesByName) {
            const coords = this.parseTileName(name);
            if (!coords) continue;
            const { x, y } = coords;
            const cand = [
                `Tile_${x + 1}_${y}`,
                `Tile_${x - 1}_${y}`,
                `Tile_${x}_${y + 1}`,
                `Tile_${x}_${y - 1}`
            ];
            const neigh = cand.filter(n => this._tilesByName.has(n));
            this._neighbors.set(name, neigh);
        }

        // 计算完基础导航图后：收集并连接所有入口到最近可通行点
        const obstacleEntrances = this.collectObstacleEntrances(obstacleRoot);
        const externalEntrances = (this.scenicEntranceNodes || []).filter(n => n && n.isValid);
        this.connectEntrancesToNearestTiles([...obstacleEntrances, ...externalEntrances]);

        // 统计潜在连线数量（两端都可通行的四向边）
        let potentialEdges = 0;
        for (const [u, neigh] of this._neighbors) {
            const cu = this._costByName.get(u) ?? Number.POSITIVE_INFINITY;
            if (!isFinite(cu)) continue;
            for (const v of neigh) {
                const cv = this._costByName.get(v) ?? Number.POSITIVE_INFINITY;
                if (!isFinite(cv)) continue;
                if (u < v) potentialEdges++;
            }
        }
        this.dbg('graph stats', { walkable: walkableCount, blocked: blockedCount, blockedByColor, sampleBlocked, sampleWalkable, edges: potentialEdges });
    }

    /** 在障碍容器中收集名为 enter 的入口节点 */
    private collectObstacleEntrances(obstacleRoot: Node | null): Node[] {
        const result: Node[] = [];
        if (!obstacleRoot) return result;
        const collectDeep = (n: Node) => {
            // 直接命中
            if (this.isEntranceNode(n)) result.push(n);
            // 递归子节点
            for (const c of n.children) collectDeep(c);
        };
        for (const tile of this.collectTiles(obstacleRoot)) {
            collectDeep(tile);
        }
        this.dbg('collectObstacleEntrances', { count: result.length });
        return result;
    }

    /** 入口节点命名规则，保证唯一 */
    private makeEntranceKey(n: Node): string {
        const id = (n as any).uuid || `${Date.now()}_${++this._entranceCounter}`;
        return `Enter_${id}`;
    }

    /** 判断是否为入口节点（名称为 enter） */
    private isEntranceNode(n: Node): boolean {
        return /^enter$/i.test(n.name);
    }

    /**
     * 将每个入口连接到最近的可通行 Tile（双向邻接），入口权重设为 0。
     * 入口只参与绘制与起终点使用，不改变原有 Tile 成本。
     */
    private connectEntrancesToNearestTiles(entrances: Node[]): void {
        let connected = 0;
        // 仅在已有可通行点时进行
        const walkableTiles: string[] = [];
        for (const [name, cost] of this._costByName) {
            const isTile = !!this.parseTileName(name);
            if (isTile && isFinite(cost)) walkableTiles.push(name);
        }
        if (walkableTiles.length === 0) { this.dbg('connectEntrancesToNearestTiles skipped: no walkable tiles'); return; }

        for (const ent of entrances) {
            if (!ent || !ent.isValid) continue;
            const entPos = ent.worldPosition;
            let bestName: string | null = null;
            let bestDist = Number.POSITIVE_INFINITY;
            for (const tname of walkableTiles) {
                const tnode = this._tilesByName.get(tname);
                if (!tnode) continue;
                const tp = tnode.worldPosition;
                const dx = entPos.x - tp.x;
                const dy = entPos.y - tp.y; // 忽略 z 维度，按平面距离
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDist) { bestDist = d2; bestName = tname; }
            }
            if (!bestName) { this.warn('entrance has no nearest tile', ent.name); continue; }
            const key = this.makeEntranceKey(ent);
            // 注册入口点
            this._tilesByName.set(key, ent);
            this._costByName.set(key, 0);
            // 建立双向邻接
            const nlist = this._neighbors.get(bestName) || [];
            nlist.push(key);
            this._neighbors.set(bestName, nlist);
            this._neighbors.set(key, [bestName]);
            connected++;
        }
        this.dbg('connectEntrancesToNearestTiles', { connected });
    }

    /** 根据占用键数组（如 "row_col"）将对应 Tile 标记为不可通行 */
    public applyOccupancyBlocks(keys: string[]): void {
        if (!keys || keys.length === 0) return;
        let applied = 0;
        for (const key of keys) {
            const m = key.match(/^(\d+)_(\d+)$/);
            if (!m) continue;
            const name = `Tile_${parseInt(m[1], 10)}_${parseInt(m[2], 10)}`;
            if (this._tilesByName.has(name)) {
                this._costByName.set(name, Number.POSITIVE_INFINITY);
                applied++;
            }
        }
        this.dbg('applyOccupancyBlocks', { applied, total: keys.length });
    }

    /** 查找最短路径（Dijkstra），仅四向，返回 Tile 名称数组 */
    private findPath(startName: string, endName: string): string[] {
        if (!this._tilesByName.has(startName) || !this._tilesByName.has(endName)) return [];
        const dist = new Map<string, number>();
        const prev = new Map<string, string | null>();
        const visited = new Set<string>();

        for (const key of this._tilesByName.keys()) {
            dist.set(key, Number.POSITIVE_INFINITY);
            prev.set(key, null);
        }
        dist.set(startName, 0);

        const pickMinUnvisited = () => {
            let bestKey: string | null = null;
            let bestVal = Number.POSITIVE_INFINITY;
            for (const [k, v] of dist) {
                if (!visited.has(k) && v < bestVal) {
                    bestVal = v;
                    bestKey = k;
                }
            }
            return bestKey;
        };

        while (true) {
            const u = pickMinUnvisited();
            if (!u) break;
            if (u === endName) break;
            visited.add(u);
            const neigh = this._neighbors.get(u) || [];
            for (const v of neigh) {
                const costV = this._costByName.get(v) ?? Number.POSITIVE_INFINITY;
                if (!isFinite(costV)) continue; // 障碍
                const alt = (dist.get(u) || Number.POSITIVE_INFINITY) + costV;
                if (alt < (dist.get(v) || Number.POSITIVE_INFINITY)) {
                    dist.set(v, alt);
                    prev.set(v, u);
                }
            }
        }

        // 回溯路径
        const path: string[] = [];
        let cur: string | null = endName;
        if (!isFinite(dist.get(endName) || Number.POSITIVE_INFINITY)) return [];
        while (cur) {
            path.unshift(cur);
            cur = prev.get(cur) || null;
        }
        return path;
    }

    /** 开关开启时更新并可视化：绘制所有可通行相邻地块的连线 */
    private updatePathVisualization() {
        if (!this._navContainer) return;
        this.drawNavLines();
    }

    private drawNavLines() {
        const container = this._navContainer || this.node;
        const g = this.ensureLineLayer(container);
        g.clear();
        const lt = this._lineLayer!.getComponent(UITransform)!;
        this.dbg('drawNavLines: using world coordinates -> line layer local', this._lineLayer?.name);

        let segments = 0;
        for (const [u, neigh] of this._neighbors) {
            const costU = this._costByName.get(u) ?? Number.POSITIVE_INFINITY;
            if (!isFinite(costU)) continue;
            const n1 = this._tilesByName.get(u);
            if (!n1) continue;
            const p1w = n1.worldPosition;
            const p1 = lt.convertToNodeSpaceAR(p1w);
            if (!isFinite(p1.x) || !isFinite(p1.y)) continue;
            for (const v of neigh) {
                const costV = this._costByName.get(v) ?? Number.POSITIVE_INFINITY;
                if (!isFinite(costV)) continue;
                // 避免重复绘制：只在字典序 u < v 时绘制
                if (u < v) {
                    const n2 = this._tilesByName.get(v);
                    if (!n2) continue;
                    const p2w = n2.worldPosition;
                    const p2 = lt.convertToNodeSpaceAR(p2w);
                    if (!isFinite(p2.x) || !isFinite(p2.y)) continue;
                    // 每条线单独 beginPath + stroke，避免一次性缓存过大导致 typed array 异常
                    try {
                        // 路径颜色保持为蓝色/lineColor
                        g.moveTo(p1.x, p1.y);
                        g.lineTo(p2.x, p2.y);
                        g.stroke();
                        segments++;
                    } catch (e) {
                        this.warn('stroke error between', u, 'and', v, e);
                    }
                }
            }
        }
        // 额外在每个可通行点绘制矩形表示权重：0 => 红，1 => 黄，5 => 绿
        let markers = 0;
        const red = new Color(255, 0, 0, 255);
        const yellow = new Color(255, 255, 0, 255);
        const green = new Color(0, 255, 92, 255);
        for (const [name, node] of this._tilesByName) {
            const c = this._costByName.get(name) ?? Number.POSITIVE_INFINITY;
            if (!isFinite(c)) continue;
            const pw = node.worldPosition;
            const p = lt.convertToNodeSpaceAR(pw);
            const size = this.markerSize;
            if (c === 0) g.fillColor = red;
            else if (c === 1) g.fillColor = yellow;
            else if (c === 5) g.fillColor = green;
            else continue;
            try {
                g.rect(p.x - size / 2, p.y - size / 2, size, size);
                g.fill();
                markers++;
            } catch (e) {
                this.warn('marker fill error at', name, e);
            }
        }
        this.dbg('drawNavLines done', { segments, markers, lineWidth: this.lineWidth, color: this.lineColor.toHEX ? (this.lineColor as any).toHEX() : `${this.lineColor.r},${this.lineColor.g},${this.lineColor.b}` });
    }

    private clearPathVisualization() {
        if (this._lineGraphics) this._lineGraphics.clear();
        this._originalColors.clear();
        this._currentPath = [];
    }

    // 运行期每帧检查布尔开关变化
    lateUpdate() {
        // 编辑器与运行期都允许根据布尔开关刷新
        if (this.showPath !== this._lastShowPath) {
            this._lastShowPath = this.showPath;
            if (this.showPath) this.updatePathVisualization();
            else this.clearPathVisualization();
        }
    }

    private ensureLineLayer(container: Node): Graphics {
        // 若用户在面板指定了挂载节点，则直接在该节点上绘制
        if (this.lineLayerNode && this.lineLayerNode.isValid) {
            this._lineLayer = this.lineLayerNode;
            // 确保有 UITransform 与 Graphics
            const t = this._lineLayer.getComponent(UITransform) || this._lineLayer.addComponent(UITransform);
            const ct = container.getComponent(UITransform);
            if (ct) t.setContentSize(ct.contentSize);
            this._lineGraphics = this._lineLayer.getComponent(Graphics) || this._lineLayer.addComponent(Graphics);
            this.dbg('ensureLineLayer: use provided node', this._lineLayer.name);
        } else {
            // 未指定则在传入的容器下创建一个临时 NavLines 层
            if (!this._lineLayer || !this._lineLayer.isValid || this._lineLayer.parent !== container) {
                if (this._lineLayer && this._lineLayer.isValid) this._lineLayer.destroy();
                this._lineLayer = new Node('NavLines');
                this._lineLayer.parent = container;
                this._lineLayer.setPosition(0, 0, 0);
                const t = this._lineLayer.addComponent(UITransform);
                const ct = container.getComponent(UITransform);
                if (ct) t.setContentSize(ct.contentSize);
                this._lineGraphics = this._lineLayer.addComponent(Graphics);
                this.dbg('ensureLineLayer: create temp layer under', container.name);
            }
        }
        const g = this._lineGraphics!;
        g.lineWidth = this.lineWidth;
        g.strokeColor = this.lineColor;
        // 放到最上层（如果在容器下）
        if (this._lineLayer && this._lineLayer.parent === container) {
            this._lineLayer.setSiblingIndex(container.children.length - 1);
        }
        if (!g) this.warn('Graphics component missing on line layer');
        return g;
    }

    private dbg(...args: any[]) {
        if (this.debugLog) console.log('[TileEditorTool]', ...args);
    }
    private warn(...args: any[]) {
        console.warn('[TileEditorTool]', ...args);
    }

    /** 外部调用：在导航图已构建的前提下刷新/清除可视化 */
    public refreshVisualization() {
        // 编辑器与运行期都可刷新
        if (this.showPath) this.updatePathVisualization();
        else this.clearPathVisualization();
    }

    /**
     * 在应用占用块（障碍）之后，重新收集并连接入口到最近的可通行Tile。
     * - 会清除之前添加到图中的所有入口点（Enter_ 开头），并从邻接表中移除引用；
     * - 重新从障碍容器递归收集名为 enter 的节点，以及 scenicEntranceNodes；
     * - 将入口与当前可通行的最近Tile建立双向邻接，入口权重为0。
     */
    public reconnectEntrancesAfterOccupancy(): void {
        // 移除已有入口点及其邻接
        const isEntranceKey = (k: string) => /^Enter_/i.test(k);
        const toRemove: string[] = [];
        for (const k of this._tilesByName.keys()) {
            if (isEntranceKey(k)) toRemove.push(k);
        }
        for (const k of toRemove) {
            this._tilesByName.delete(k);
            this._costByName.delete(k);
            this._neighbors.delete(k);
        }
        for (const [u, neigh] of this._neighbors) {
            this._neighbors.set(u, neigh.filter(v => !isEntranceKey(v)));
        }

        // 重新收集入口并连接到最近可通行Tile
        const obstacleEntrances = this.collectObstacleEntrances(this._obstacleContainer);
        const externalEntrances = (this.scenicEntranceNodes || []).filter(n => n && n.isValid);
        this.connectEntrancesToNearestTiles([...obstacleEntrances, ...externalEntrances]);
    }
}