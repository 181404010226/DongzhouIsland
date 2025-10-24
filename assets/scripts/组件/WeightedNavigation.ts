import { _decorator, Component, Node, Vec3, Graphics, Color, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WeightedNodeGroup')
export class WeightedNodeGroup {
    @property({ type: [Node] })
    nodes: Node[] = [];

    @property
    weight: number = 1.0; // 该区域移动代价倍数（>= 0.1）
}

@ccclass('WeightedNavigation')
export class WeightedNavigation extends Component {
    // 12 个等分方向（在 XY 平面）
    private directions: Vec3[] = [];

    @property
    stepLength: number = 50; // 导航步长（像素或单位）

    @property
    moveSpeed: number = 120; // 实际移动速度（单位/秒）

    @property
    maxSearchSteps: number = 4000; // A* 最大扩展步数，防止爆栈

    @property
    maxSearchRadius: number = 4000; // 从起点起的最大搜索半径

    @property
    maxExpandPerFrame: number = 200; // 分帧：每帧最多扩展的节点次数

    @property({ type: [WeightedNodeGroup] })
    regionGroups: WeightedNodeGroup[] = [];

    @property({ type: Node })
    targetNode: Node | null = null;

    @property
    recomputeOnStart: boolean = false; // 勾选时触发一次重算

    @property
    showPath: boolean = true;

    @property({ type: Graphics })
    pathGraphics: Graphics | null = null; // 可选：在 2D 画布上可视化路径

    // 只读：当前路径点（不在 Inspector 暴露可编辑）
    private path: Vec3[] = [];
    private pathComputed = false;
    private currentIdx = 0;

    // 分帧 A* 状态
    private inc_openSet: Map<string, { pos: Vec3; g: number; f: number }> | null = null;
    private inc_cameFrom: Map<string, string> | null = null;
    private inc_gScore: Map<string, number> | null = null;
    private inc_fScore: Map<string, number> | null = null;
    private inc_closed: Set<string> | null = null;
    private inc_startKey: string = '';
    private inc_goalKey: string = '';
    private inc_start: Vec3 | null = null;
    private inc_goal: Vec3 | null = null;
    private inc_steps: number = 0;
    private inc_running: boolean = false;

    onLoad() {
        this.initDirections();
        // 自动创建一个 Graphics 用于预览（如果未手动设置）
        if (!this.pathGraphics) {
            const gNode = new Node('PathPreview');
            gNode.setParent(this.node);
            this.pathGraphics = gNode.addComponent(Graphics);
            // 让预览覆盖在父节点局部坐标系下
            const ui = gNode.getComponent(UITransform);
            ui.setContentSize(2000, 2000); // 大一点以便画线
        }
    }

    start() {
        // 改为仅在勾选时重算，不在启动时自动重算
    }

    update(dt: number) {
        // 勾选触发一次重算，随后自动复位为未勾选
        if (this.recomputeOnStart) {
            this.recomputeOnStart = false;
            this.recomputePath();
        }

        // 分帧推进 A*
        if (this.inc_running) {
            const finished = this.stepAStarIncremental(this.maxExpandPerFrame);
            if (finished) {
                this.inc_running = false;
            }
        }

        this.followPath(dt);
        if (this.showPath) {
            this.drawPath();
        }
    }

    // 公共接口：设置目标并重新计算路径（改为分帧启动）
    public setTarget(node: Node | null) {
        this.targetNode = node;
        this.recomputePath();
    }

    // 公共接口：重新计算路径（分帧）
    public recomputePath() {
        this.pathComputed = false;
        this.path = [];
        this.currentIdx = 0;

        const start = this.node.worldPosition.clone();
        const target = this.getTargetWorld();
        if (!target) {
            this.inc_running = false;
            return;
        }
        this.beginAStarIncremental(start, target);
    }

    // 只计算一次路径（保留同步版本）
    private computePathOnce() {
        if (this.pathComputed) return;
        const start = this.node.worldPosition.clone();
        const target = this.getTargetWorld();
        if (!target) return;

        const result = this.aStar(start, target);
        if (result && result.length > 0) {
            this.path = result;
            this.pathComputed = true;
            this.currentIdx = 0;
        } else {
            // 同步版没找到路径也标记完成，避免重复尝试
            this.path = [];
            this.pathComputed = true;
            this.currentIdx = 0;
        }
    }

    private getTargetWorld(): Vec3 | null {
        if (!this.targetNode) return null;
        return this.targetNode.worldPosition.clone();
    }

    private initDirections() {
        this.directions = [];
        const count = 12;
        const step = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
            const angle = step * i;
            const dir = new Vec3(Math.cos(angle), Math.sin(angle), 0);
            this.directions.push(dir);
        }
    }

    private drawPath() {
        if (!this.pathGraphics) return;
        const g = this.pathGraphics;
        g.clear();
        g.strokeColor = Color.GREEN;
        g.lineWidth = 3;

        if (this.path.length === 0) return;

        // 将世界坐标转换到 pathGraphics 的局部坐标系绘制
        const toLocal = (world: Vec3) => {
            const local = new Vec3();
            g.node.inverseTransformPoint(local, world);
            return local;
        };

        const p0 = toLocal(this.path[0]);
        g.moveTo(p0.x, p0.y);
        for (let i = 1; i < this.path.length; i++) {
            const p = toLocal(this.path[i]);
            g.lineTo(p.x, p.y);
        }
        g.stroke();
    }

    private followPath(dt: number) {
        if (!this.pathComputed || this.path.length === 0) return;
        if (this.currentIdx >= this.path.length) return;

        const world = this.node.worldPosition.clone();
        const target = this.path[this.currentIdx];
        const toTarget = new Vec3(target.x - world.x, target.y - world.y, 0);
        const dist = toTarget.length();
        if (dist < 1e-2) {
            this.currentIdx++;
            return;
        }
        toTarget.normalize();
        const step = this.moveSpeed * dt;
        const move = Math.min(step, dist);
        const newPos = new Vec3(world.x + toTarget.x * move, world.y + toTarget.y * move, 0);
        this.node.worldPosition = newPos;
    }

    // A* 搜索（同步版，在连续空间上离散化，邻居为 12 个方向 * stepLength）
    private aStar(start: Vec3, goal: Vec3): Vec3[] {
        const openSet = new Map<string, { pos: Vec3; g: number; f: number; parent?: string }>();
        const cameFrom = new Map<string, string>();
        const gScore = new Map<string, number>();
        const fScore = new Map<string, number>();
        const closed = new Set<string>();

        const key = (p: Vec3) => `${Math.round(p.x)}_${Math.round(p.y)}`;
        const startKey = key(start);
        const goalKey = key(goal);

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, goal));
        openSet.set(startKey, { pos: start.clone(), g: 0, f: fScore.get(startKey)! });

        let steps = 0;
        const maxR2 = this.maxSearchRadius * this.maxSearchRadius;

        while (openSet.size > 0 && steps++ < this.maxSearchSteps) {
            // 取 f 最小的节点
            let currentKey: string | null = null;
            let currentF = Number.POSITIVE_INFINITY;
            for (const [k, v] of openSet) {
                if (v.f < currentF) { currentF = v.f; currentKey = k; }
            }
            if (!currentKey) break;
            const current = openSet.get(currentKey)!;

            // 目标判定：足够接近
            if (this.distance(current.pos, goal) <= this.stepLength) {
                cameFrom.set(goalKey, currentKey);
                return this.reconstructPath(cameFrom, startKey, goalKey, goal);
            }

            openSet.delete(currentKey);
            closed.add(currentKey);

            // 半径限制：超过最大搜索半径则跳过
            if (this.sqrDistance(start, current.pos) > maxR2) continue;

            // 遍历 12 个方向邻居
            for (const d of this.directions) {
                const neighbor = new Vec3(
                    current.pos.x + d.x * this.stepLength,
                    current.pos.y + d.y * this.stepLength,
                    0
                );
                const nk = key(neighbor);
                if (closed.has(nk)) continue;

                const weight = this.weightAt(neighbor);
                const tentativeG = (gScore.get(currentKey)! + this.stepLength * weight);

                const existing = gScore.get(nk);
                if (existing === undefined || tentativeG < existing) {
                    cameFrom.set(nk, currentKey);
                    gScore.set(nk, tentativeG);
                    const f = tentativeG + this.heuristic(neighbor, goal);
                    fScore.set(nk, f);
                    openSet.set(nk, { pos: neighbor, g: tentativeG, f });
                }
            }
        }

        // 未找到路径，返回空
        return [];
    }

    private reconstructPath(
        cameFrom: Map<string, string>,
        startKey: string,
        goalKey: string,
        goalPos: Vec3
    ): Vec3[] {
        const path: Vec3[] = [goalPos.clone()];
        let k = goalKey;
        while (cameFrom.has(k)) {
            const pKey = cameFrom.get(k)!;
            if (pKey === startKey) break;
            const [x, y] = pKey.split('_').map(Number);
            path.push(new Vec3(x, y, 0));
            k = pKey;
        }
        path.reverse();
        return path;
    }

    private heuristic(a: Vec3, b: Vec3): number {
        // 使用欧氏距离作为启发式
        return this.distance(a, b);
    }

    private distance(a: Vec3, b: Vec3): number {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private sqrDistance(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy;
    }

    // 新增：使用 UITransform 矩形判定（世界坐标 -> 节点局部）
    private isInsideUITransform(worldPoint: Vec3, node: Node): boolean {
        const ui = node.getComponent(UITransform);
        if (!ui) return false;
        const local = new Vec3();
        node.inverseTransformPoint(local, worldPoint);
        const width = ui.contentSize.width;
        const height = ui.contentSize.height;
        const anchor = ui.anchorPoint; // (anchor.x, anchor.y) ∈ [0,1]
        const minX = -anchor.x * width;
        const minY = -anchor.y * height;
        const maxX = (1 - anchor.x) * width;
        const maxY = (1 - anchor.y) * height;
        return local.x >= minX && local.x <= maxX && local.y >= minY && local.y <= maxY;
    }

    // 根据传入的区域组计算当前位置的移动权重（越大越慢）
    private weightAt(p: Vec3): number {
        if (!this.regionGroups || this.regionGroups.length === 0) return 1.0;
        let w = 1.0;
        for (const g of this.regionGroups) {
            const rw = Math.max(0.1, g.weight);
            for (const n of g.nodes) {
                if (!n) continue;
                if (this.isInsideUITransform(p, n)) {
                    // 命中该 UI 区域，采用更大的权重（你也可改为叠乘）
                    w = Math.max(w, rw);
                }
            }
        }
        return w;
    }

    // ===== 分帧 A* 实现 =====
    private nodeKey(p: Vec3): string {
        return `${Math.round(p.x)}_${Math.round(p.y)}`;
    }

    private beginAStarIncremental(start: Vec3, goal: Vec3) {
        this.inc_openSet = new Map();
        this.inc_cameFrom = new Map();
        this.inc_gScore = new Map();
        this.inc_fScore = new Map();
        this.inc_closed = new Set();
        this.inc_start = start.clone();
        this.inc_goal = goal.clone();
        this.inc_startKey = this.nodeKey(this.inc_start);
        this.inc_goalKey = this.nodeKey(this.inc_goal);
        this.inc_steps = 0;
        this.inc_running = true;

        this.inc_gScore.set(this.inc_startKey, 0);
        const f0 = this.heuristic(this.inc_start, this.inc_goal);
        this.inc_fScore.set(this.inc_startKey, f0);
        this.inc_openSet.set(this.inc_startKey, { pos: this.inc_start.clone(), g: 0, f: f0 });
    }

    // 返回 true 表示已完成（找到或失败）；false 表示仍在进行中
    private stepAStarIncremental(maxSteps: number): boolean {
        if (!this.inc_running || !this.inc_openSet || !this.inc_start || !this.inc_goal) return true;

        const openSet = this.inc_openSet;
        const cameFrom = this.inc_cameFrom!;
        const gScore = this.inc_gScore!;
        const fScore = this.inc_fScore!;
        const closed = this.inc_closed!;
        const start = this.inc_start;
        const goal = this.inc_goal;
        const startKey = this.inc_startKey;
        const goalKey = this.inc_goalKey;
        const maxR2 = this.maxSearchRadius * this.maxSearchRadius;

        let iter = 0;
        while (openSet.size > 0 && iter++ < maxSteps && this.inc_steps < this.maxSearchSteps) {
            this.inc_steps++;

            // 取 f 最小的节点
            let currentKey: string | null = null;
            let currentF = Number.POSITIVE_INFINITY;
            for (const [k, v] of openSet) {
                if (v.f < currentF) { currentF = v.f; currentKey = k; }
            }
            if (!currentKey) break;
            const current = openSet.get(currentKey)!;

            // 目标判定：足够接近
            if (this.distance(current.pos, goal) <= this.stepLength) {
                cameFrom.set(goalKey, currentKey);
                const result = this.reconstructPath(cameFrom, startKey, goalKey, goal);
                this.path = result;
                this.pathComputed = true;
                this.currentIdx = 0;
                return true;
            }

            openSet.delete(currentKey);
            closed.add(currentKey);

            // 半径限制：超过最大搜索半径则跳过
            if (this.sqrDistance(start, current.pos) > maxR2) continue;

            // 遍历 12 个方向邻居
            for (const d of this.directions) {
                const neighbor = new Vec3(
                    current.pos.x + d.x * this.stepLength,
                    current.pos.y + d.y * this.stepLength,
                    0
                );
                const nk = this.nodeKey(neighbor);
                if (closed.has(nk)) continue;

                const weight = this.weightAt(neighbor);
                const tentativeG = (gScore.get(currentKey)! + this.stepLength * weight);

                const existing = gScore.get(nk);
                if (existing === undefined || tentativeG < existing) {
                    cameFrom.set(nk, currentKey);
                    gScore.set(nk, tentativeG);
                    const f = tentativeG + this.heuristic(neighbor, goal);
                    fScore.set(nk, f);
                    openSet.set(nk, { pos: neighbor, g: tentativeG, f });
                }
            }
        }

        // 结束条件：openSet 空或超过最大步数 => 未找到
        if (openSet.size === 0 || this.inc_steps >= this.maxSearchSteps) {
            this.path = [];
            this.pathComputed = true;
            this.currentIdx = 0;
            return true;
        }

        // 还未完成
        return false;
    }
}