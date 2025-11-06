import { _decorator, Component, Node, Vec3, tween, Tween, CCString, director, UIOpacity } from 'cc';
import { TileEditorTool } from '../工具/TileEditorTool';
import { TopBarManager } from '../UI面板/TopBarManager';
const { ccclass, property } = _decorator;

/**
 * 游客系统（每个游客身上挂载一个，并使用公共参数readonly实时显示目标点）
 * 暂时实现为随机向相邻点移动，后期再升级，移动到点一定范围内的时候寻找其他点
 */
@ccclass('TouristController')
export class TouristController extends Component {
    
    /**
     * 当前所在导航点名称（只读显示）
     */
    @property({ displayName: "当前点", readonly: true })
    private _currentPoint: string = '';
    
    /**
     * 目标导航点名称（只读显示）
     */
    @property({ displayName: "目标点", readonly: true })
    private _targetPoint: string = '';
    
    /**
     * 最终目标点名称（游客的最终目的地）
     */
    @property({ displayName: "最终目标点", readonly: true })
    private _finalDestination: string = '';
    
    /**
     * 当前路径（A*算法计算的路径）
     */
    private _currentPath: string[] = [];
    
    /**
     * 当前路径索引
     */
    private _currentPathIndex: number = 0;
    
    /**
     * 是否正在跟随路径
     */
    private _isFollowingPath: boolean = false;
    
    /**
     * 移动速度（像素/秒）
     */
    @property
    moveSpeed: number = 100;
    
    /**
     * 到达目标点的检测范围
     */
    @property
    arrivalRange: number = 10;
    
    /**
     * 在点停留的时间（秒）
     */
    @property
    stayDuration: number = 0.3;
    
    /**
     * 自动移动
     */

    
    // 编辑器只读字段：游客状态信息
    @property({ type: [CCString], readonly: true, tooltip: '游客当前状态信息（编辑器查看）' })
    private readonly touristStatusInfo: string[] = [];
    
    // 编辑器只读字段：目标节点详细信息
    @property({ type: [CCString], readonly: true, tooltip: '目标节点详细信息（编辑器查看）' })
    private readonly targetNodeDetails: string[] = [];
    
    /**
     * 当前计划路径信息（编辑器查看）
     */
    @property({ type: [CCString], readonly: true, tooltip: '当前A*算法计算的移动路径' })
    private readonly plannedPathInfo: string[] = [];
    
    /**
     * 路径跟随状态信息（编辑器查看）
     */
    @property({ type: [CCString], readonly: true, tooltip: '路径跟随的详细状态信息' })
    private readonly pathFollowingStatus: string[] = [];
    
    /**
     * 当前移动缓动
     */
    private currentTween: Tween<Node> = null;
    
    /**
     * 是否正在移动
     */
    private isMoving: boolean = false;
    
    /**
     * 停留计时器
     */
    private stayTimer: number = 0;
    
    /**
     * 是否正在停留
     */
    private isStaying: boolean = false;
    
    /**
     * TileEditorTool 引用
     */
    private tileEditorTool: TileEditorTool = null;

    /** 地图容器（包含所有 Tile_x_y 子节点） */
    @property({ type: Node, tooltip: '地图容器（包含所有 Tile_* 节点）' })
    mapContainer: Node | null = null;

    /** 中途换挂载是否已完成（一次移动只触发一次） */
    private _midReparentDone: boolean = false;

    /**
     * 访问计划：入口名称队列（Enter_*），按顺序前往
     */
    @property({ type: [CCString], tooltip: '访问计划：依次前往的入口名称（Enter_*）' })
    visitPlan: string[] = [];

    /** 自动按访问计划选择下一个入口 */
    @property({ tooltip: '到达入口后是否自动前往访问计划中的下一个入口' })
    autoFollowPlan: boolean = true;

    /** 进入建筑后停留时间（秒） */
    @property({ tooltip: '进入建筑后隐身停留时间（秒）' })
    visitStayDuration: number = 3;

    /** 淡入淡出时间（秒） */
    @property({ tooltip: '进入/离开建筑的淡入淡出时间（秒）' })
    fadeDuration: number = 0.5;

    /** 进入建筑时向前推进距离（像素） */
    @property({ tooltip: '到达入口后沿当前移动方向继续前进的距离（像素）' })
    enterForwardDistance: number = 30;

    /** 当前访问计划索引 */
    private _currentVisitIndex: number = 0;

    /** 最近一次移动的起点与终点，用于计算进入方向 */
    private _lastMoveStart: Vec3 = new Vec3();
    private _lastMoveTarget: Vec3 = new Vec3();
    
    
    /**
     * 路径重新计算的冷却时间（秒）
     */
    private _pathRecalculationCooldown: number = 2.0;
    
    /**
     * 上次路径重新计算的时间
     */
    private _lastPathRecalculationTime: number = 0;
    
    /**
     * 移动被阻塞的检测时间（秒）
     */
    private _moveBlockedThreshold: number = 3.0;
    
    /**
     * 开始移动的时间
     */
    private _moveStartTime: number = 0;
    
    /**
     * 上次位置（用于检测是否被阻塞）
     */
    private _lastPosition: Vec3 = new Vec3();
    
    /**
     * 位置变化的最小阈值
     */
    private _positionChangeThreshold: number = 5.0;

    /**
     * 检测移动是否被阻塞
     */
    private checkForObstacles(): boolean {
        if (!this.isMoving || !this._isFollowingPath) {
            return false;
        }
        
        const currentTime = Date.now() / 1000;
        const currentPosition = this.node.getWorldPosition();
        
        // 检查是否移动了足够长的时间
        if (currentTime - this._moveStartTime < this._moveBlockedThreshold) {
            return false;
        }
        
        // 检查位置是否有显著变化
        const positionChange = Vec3.distance(currentPosition, this._lastPosition);
        
        if (positionChange < this._positionChangeThreshold) {
            console.warn(`检测到移动被阻塞，位置变化: ${positionChange.toFixed(2)} < ${this._positionChangeThreshold}`);
            return true;
        }
        
        // 更新上次位置
        this._lastPosition.set(currentPosition);
        return false;
    }
    
    /**
     * 重新计算路径（带冷却时间）
     */
    private recalculatePathIfNeeded(): void {
        // 仅在“要移动过去的点”变为不可通行时重新计算路径
        if (!this.tileEditorTool || !this._finalDestination) {
            return;
        }

        // 场景1：正在移动到某个目标点，过程中该点变为不可通行
        if (this.isMoving && this._targetPoint) {
            const walkable = this.tileEditorTool.isNavigationPointWalkable(this._targetPoint);
            if (!walkable) {
                console.warn(`目标点变为不可通行，重新规划路径: ${this._targetPoint}`);
                this.stopMoving();
                this.stopFollowingPath();
                this.navigateToDestination();
            }
            return;
        }

        // 场景2：准备开始移动到路径中的下一个节点，但该节点当前不可通行
        if (!this.isMoving && this._isFollowingPath && this._currentPathIndex < this._currentPath.length) {
            const nextPoint = this._currentPath[this._currentPathIndex];
            const walkable = this.tileEditorTool.isNavigationPointWalkable(nextPoint);
            if (!walkable) {
                console.warn(`下一节点不可通行，重新规划路径: ${nextPoint}`);
                this.stopFollowingPath();
                this.navigateToDestination();
            }
        }
    }
    
    start() {
        this.tileEditorTool = this.getTileEditorTool();
        if (!this.tileEditorTool) {
            console.error('TileEditorTool 未找到');
            return;
        }

        // 自动解析场景中的 MapContainer（若未在面板指定）
        if (!this.mapContainer) {
            this.mapContainer = this.findMapContainerNode();
        }
        
        // 如果没有设置当前点，尝试找到最近的导航点
        if (!this._currentPoint) {
            this.findNearestNavigationPoint();
        }
        
        // 当前点已设置，无需在导航系统注册
        
        // 初始化只读字段显示
        this.updateReadonlyFields();
    }
    
    update(deltaTime: number) {
        if (!this.tileEditorTool) {
            return;
        }
        
        // 如果正在停留，更新停留计时器
        if (this.isStaying) {
            this.stayTimer += deltaTime;
            if (this.stayTimer >= this.stayDuration) {
                this.isStaying = false;
                this.stayTimer = 0;
                
                // 只有在跟随路径时才继续移动
                if (this._isFollowingPath && this._currentPath.length > 0 && this._currentPathIndex < this._currentPath.length) {
                    // 继续跟随路径
                    const nextPoint = this._currentPath[this._currentPathIndex];
                    this.moveToPoint(nextPoint);
                }
            }
            // 定期更新只读字段显示
            this.updateReadonlyFields();
            return;
        }
        
        // 如果没有在移动且没有在停留，且正在跟随路径，开始移动
        if (!this.isMoving && !this.isStaying && this._isFollowingPath && this._currentPath.length > 0 && this._currentPathIndex < this._currentPath.length) {
            // 跟随路径移动前，检查下一节点是否可通行
            const nextPoint = this._currentPath[this._currentPathIndex];
            if (this.tileEditorTool && !this.tileEditorTool.isNavigationPointWalkable(nextPoint)) {
                console.warn(`下一节点不可通行，重新规划路径: ${nextPoint}`);
                this.stopFollowingPath();
                this.navigateToDestination();
            } else {
                this.moveToPoint(nextPoint);
            }
        }
        
        // 检查是否到达目标点
        if (this.isMoving && this._targetPoint) {
            // 正在移动过程中，如目标点变为不可通行则立即重新规划
            if (this.tileEditorTool && !this.tileEditorTool.isNavigationPointWalkable(this._targetPoint)) {
                console.warn(`移动过程中目标点不可通行，路径重算: ${this._targetPoint}`);
                this.stopMoving();
                this.stopFollowingPath();
                this.navigateToDestination();
                this.updateReadonlyFields();
                return;
            }
            const targetPosition = this.tileEditorTool.getNavigationPointPosition(this._targetPoint);
            if (targetPosition) {
                const currentPosition = this.node.getWorldPosition();
                const distance = Vec3.distance(currentPosition, targetPosition);

                if (distance <= this.arrivalRange) {
                    this.onArriveAtTarget();
                } else {
                    // 检查是否需要重新计算路径（障碍检测）
                    this.recalculatePathIfNeeded();
                    // 在移动到另一 Tile 的过程中，累计到一半距离后切换父节点到目标 Tile
                    this.tryMidwayReparent();
                }

                // 移动过程中定期更新只读字段显示
                this.updateReadonlyFields();
            }
        }
    }
    
    /**
     * 设置当前导航点
     * @param pointName 导航点名称
     */
    setCurrentPoint(pointName: string): void {
        // 直接更新当前点
        
        this._currentPoint = pointName;
        
        // 不再在导航系统中注册
        
        this.updateReadonlyFields();

        // 初始挂载到当前点对应的 Tile
        this.reparentToTileForPoint(this._currentPoint);
        
        // 如果有最终目标点且导航系统可用，开始导航
        if (this._finalDestination && this._currentPoint && this.tileEditorTool) {
            console.log(`当前点已设置为: ${pointName}, 开始导航到目标点: ${this._finalDestination}`);
            this.navigateToDestination();
        }
    }
    
    /**
     * 获取当前导航点
     */
    getCurrentPoint(): string {
        return this._currentPoint;
    }
    
    /**
     * 获取目标导航点
     */
    getTargetPoint(): string {
        return this._targetPoint;
    }
    
    /**
     * 移动到随机相邻点
     */

    
    /**
     * 移动到指定导航点
     * @param pointName 目标导航点名称
     */
    moveToPoint(pointName: string): void {
        if (!this.tileEditorTool) {
            return;
        }
        
        const targetPosition = this.tileEditorTool.getNavigationPointPosition(pointName);
        if (!targetPosition) {
            console.error(`无法找到导航点: ${pointName}`);
            return;
        }

        // 如果目标点当前不可通行，则不发起移动，改为重新规划路径
        if (!this.tileEditorTool.isNavigationPointWalkable(pointName)) {
            console.warn(`目标点不可通行，取消本次移动并重新规划: ${pointName}`);
            if (this._finalDestination) {
                this.stopFollowingPath();
                this.navigateToDestination();
            }
            return;
        }
        
        // 停止当前移动
        this.stopMoving();
        
        // 设置目标点
        this._targetPoint = pointName;
        this.updateReadonlyFields();
        
        // 计算移动时间
        const currentPosition = this.node.getWorldPosition();
        const distance = Vec3.distance(currentPosition, targetPosition);
        const moveTime = distance / this.moveSpeed;
        
        // 记录移动开始时间和位置（用于障碍检测与进入方向）
        this._moveStartTime = Date.now() / 1000;
        this._lastPosition.set(currentPosition);
        this._lastMoveStart.set(currentPosition);
        this._lastMoveTarget.set(targetPosition);
        
        // 每次新移动重置中途换挂载标记，并确保当前挂载为起点 Tile
        this._midReparentDone = false;
        this.reparentToTileForPoint(this._currentPoint);

        // 开始移动
        this.isMoving = true;
        this.currentTween = tween(this.node)
            .to(moveTime, { worldPosition: targetPosition })
            .call(() => {
                this.onArriveAtTarget();
            })
            .start();
        

    }
    
    /**
     * 停止移动
     */
    stopMoving(): void {
        if (this.currentTween) {
            this.currentTween.stop();
            this.currentTween = null;
        }
        this.isMoving = false;
    }
    
    /**
     * 到达目标点时的处理
     */
    private onArriveAtTarget(): void {
        if (!this._targetPoint) {
            return;
        }
        
        // 更新当前点
        this._currentPoint = this._targetPoint;
        this._targetPoint = '';
        
        // 停止移动
        this.stopMoving();
        this._midReparentDone = false;

        // 检查是否正在跟随路径
        if (this._isFollowingPath && this._currentPath.length > 0) {
            // 检查是否到达最终目标点
            if (this._currentPoint === this._finalDestination) {
                console.log(`游客已到达最终目标点: ${this._finalDestination}`);
                // 目的地为入口时执行进入/停留/再出发流程
                if (this.tileEditorTool && this.tileEditorTool.isEntrancePointName(this._finalDestination)) {
                    this.handleArrivalAtEntrance();
                } else {
                    this.stopFollowingPath();
                    // 普通点到达后不再停顿，由生成器或上层逻辑决定下一步
                }
            } else {
                // 移动到路径中的下一个节点
                this._currentPathIndex++;
                if (this._currentPathIndex < this._currentPath.length) {
                    const nextPoint = this._currentPath[this._currentPathIndex];
                    console.log(`路径跟随中，移动到下一个节点: ${nextPoint} (${this._currentPathIndex}/${this._currentPath.length - 1})`);
                    // 直接继续移动到下一个节点，不再停顿
                    this.moveToPoint(nextPoint);
                } else {
                    // 路径已完成，但没有到达最终目标（可能路径计算有问题）
                    console.warn(`路径跟随完成但未到达最终目标。当前点: ${this._currentPoint}, 目标: ${this._finalDestination}`);
                    this.stopFollowingPath();
                    // 立即尝试重新规划以继续移动
                    this.navigateToDestination();
                }
            }
        } else {
            // 普通移动模式：不再自动停留
        }

        // 抵达后确保父节点为当前 Tile
        this.reparentToTileForPoint(this._currentPoint);

        // 更新只读字段
        this.updateReadonlyFields();
    }

    /**
     * 到达入口后的处理：淡出+向前推进，隐身等待，再淡入并前往下一个入口
     */
    private handleArrivalAtEntrance(): void {
        // 停止路径跟随
        this.stopFollowingPath();

        // 计算向前推进目标
        const dir = new Vec3(
            this._lastMoveTarget.x - this._lastMoveStart.x,
            this._lastMoveTarget.y - this._lastMoveStart.y,
            this._lastMoveTarget.z - this._lastMoveStart.z
        );
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
        dir.x /= len; dir.y /= len; dir.z /= len;

        const cur = this.node.getWorldPosition();
        const forwardTarget = new Vec3(
            cur.x + dir.x * this.enterForwardDistance,
            cur.y + dir.y * this.enterForwardDistance,
            cur.z + dir.z * this.enterForwardDistance
        );
        const forwardTime = this.enterForwardDistance / Math.max(this.moveSpeed, 1);

        // 获取/添加 UIOpacity 进行淡入淡出
        let opacity = this.node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.node.addComponent(UIOpacity);
        }
        opacity.opacity = 255;

        // 并行：向前移动与淡出
        this.isMoving = true;
        tween(this.node)
            .to(forwardTime, { worldPosition: forwardTarget })
            .call(() => {
                this.isMoving = false;
                this.isStaying = true;
                this.stayTimer = 0;
            })
            .start();

        tween(opacity)
            .to(this.fadeDuration, { opacity: 0 })
            .delay(this.visitStayDuration)
            .to(this.fadeDuration, { opacity: 255 })
            .call(() => {
                // 结束隐身停留，前往下一个入口
                this.isStaying = false;

                // 离开建筑入口时（非景区入口）奖励金币并播放上涨效果
                try {
                    if (this.tileEditorTool && this.tileEditorTool.isEntrancePointName(this._currentPoint)) {
                        const isScenic = this.tileEditorTool.isScenicEntrancePointName(this._currentPoint);
                        if (!isScenic) {
                            const topBar = TopBarManager.getInstance();
                            if (topBar) {
                                const amount = Math.floor(30 + Math.random() * 271); // 30~300 随机
                                const addAnimated = (topBar as any).addCoinsAnimated;
                                if (typeof addAnimated === 'function') {
                                    (topBar as any).addCoinsAnimated(amount);
                                } else {
                                    topBar.addCoins(amount);
                                }
                            }
                        }
                    }
                } catch {}
                const next = this.selectNextEntrance();
                if (next) {
                    // 更新访问计划索引到下一个
                    if (this.autoFollowPlan && this.visitPlan && this.visitPlan.length > 0) {
                        // 将索引推进到 next 的后一个位置
                        const idx = this.visitPlan.findIndex(n => n === next);
                        if (idx >= 0) this._currentVisitIndex = (idx + 1) % this.visitPlan.length;
                    }
                    this.setTargetDestination(next);
                }
            })
            .start();

        // 更新只读字段
        this.updateReadonlyFields();
    }

    /** 选择下一个入口（优先访问计划） */
    private selectNextEntrance(): string | null {
        if (!this.tileEditorTool) return null;

        // 访问计划优先
        if (this.autoFollowPlan && this.visitPlan && this.visitPlan.length > 0) {
            const len = this.visitPlan.length;
            for (let attempt = 0; attempt < len; attempt++) {
                const idx = (this._currentVisitIndex + attempt) % len;
                const name = this.visitPlan[idx];
                if (!name) continue;
                if (name === this._currentPoint) continue; // 必须是其他入口
                if (this.tileEditorTool.hasNavigationPoint(name) && this.tileEditorTool.isNavigationPointWalkable(name)) {
                    this._currentVisitIndex = (idx + 1) % len; // 下次从下一个开始
                    return name;
                }
            }
        }

        // 退化：随机入口（排除当前）
        const rand = this.tileEditorTool.getRandomEntranceName(this._currentPoint);
        return rand;
    }

    /** 保证目的地为“其他入口”，否则改为选择下一个入口 */
    private ensureEntranceDestination(dest: string): string {
        if (this.tileEditorTool && this.tileEditorTool.isEntrancePointName(dest) && dest !== this._currentPoint) {
            return dest;
        }
        const next = this.selectNextEntrance();
        return next || dest;
    }
    
    /**
     * 查找最近的导航点
     */
    private findNearestNavigationPoint(): void {
        if (!this.tileEditorTool) {
            return;
        }
        
        const currentPosition = this.node.getWorldPosition();
        const nearest = this.tileEditorTool.findNearestNavigationPointName(currentPosition, true);
        if (nearest) {
            this.setCurrentPoint(nearest);
        }
    }
    
    /**
     * 传送到指定导航点
     * @param pointName 导航点名称
     */
    teleportToPoint(pointName: string): void {
        if (!this.tileEditorTool) {
            return;
        }
        
        const targetPosition = this.tileEditorTool.getNavigationPointPosition(pointName);
        if (!targetPosition) {
            console.error(`无法找到导航点: ${pointName}`);
            return;
        }
        
        // 停止当前移动
        this.stopMoving();
        
        // 设置位置
        this.node.setWorldPosition(targetPosition);
        
        // 更新当前点
        this.setCurrentPoint(pointName);
        this._targetPoint = '';
        

    }
    
    /**
     * 设置移动速度
     * @param speed 移动速度
     */
    setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }
    
    /**
     * 设置停留时间
     * @param duration 停留时间
     */
    setStayDuration(duration: number): void {
        this.stayDuration = duration;
    }
    
    /**
     * 设置自动移动状态
     * @param enabled 是否启用自动移动
     */

    
    /**
     * 获取是否正在移动
     */
    getIsMoving(): boolean {
        return this.isMoving;
    }
    
    /**
     * 获取是否正在停留
     */
    getIsStaying(): boolean {
        return this.isStaying;
    }
    
    /**
     * 更新编辑器只读字段
     */
    private updateReadonlyFields(): void {
        // 更新游客状态信息
        const statusInfo: string[] = [];
        const targetDetails: string[] = [];
        
        // 基本状态信息
        statusInfo.push(`当前点: ${this._currentPoint || '未设置'}`);
        statusInfo.push(`目标点: ${this._targetPoint || '无'}`);
        statusInfo.push(`移动状态: ${this.isMoving ? '移动中' : '静止'}`);
        statusInfo.push(`停留状态: ${this.isStaying ? '停留中' : '非停留'}`);
       statusInfo.push(`移动速度: ${this.moveSpeed} 像素/秒`);
        statusInfo.push(`停留时间: ${this.stayDuration} 秒`);
        
        // 目标节点详细信息
        if (this._targetPoint && this.tileEditorTool) {
            const targetPosition = this.tileEditorTool.getNavigationPointPosition(this._targetPoint);
            if (targetPosition) {
                targetDetails.push(`目标点名称: ${this._targetPoint}`);
                targetDetails.push(`目标位置: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                
                const currentPosition = this.node.getWorldPosition();
                const distance = Vec3.distance(currentPosition, targetPosition);
                targetDetails.push(`距离目标: ${distance.toFixed(2)} 像素`);
                
                if (this.isMoving) {
                    const estimatedTime = distance / this.moveSpeed;
                    targetDetails.push(`预计到达时间: ${estimatedTime.toFixed(2)} 秒`);
                }
                
                // 获取相邻点信息
                const adjacentPoints = this.tileEditorTool.getAdjacentPoints(this._targetPoint);
                if (adjacentPoints && adjacentPoints.length > 0) {
                    targetDetails.push(`目标点相邻点: ${adjacentPoints.join(', ')}`);
                }
            }
        } else {
            targetDetails.push('当前无目标点');
        }
        
        // 当前点详细信息
        if (this._currentPoint && this.tileEditorTool) {
            const currentAdjacentPoints = this.tileEditorTool.getAdjacentPoints(this._currentPoint);
            if (currentAdjacentPoints && currentAdjacentPoints.length > 0) {
                statusInfo.push(`当前点相邻点: ${currentAdjacentPoints.join(', ')}`);
            }
        }
        
        // 更新路径信息
        const pathInfo: string[] = [];
        const pathStatus: string[] = [];
        
        if (this._currentPath && this._currentPath.length > 0) {
            pathInfo.push(`路径总长度: ${this._currentPath.length} 个节点`);
            pathInfo.push(`完整路径: ${this._currentPath.join(' → ')}`);
            pathInfo.push(`当前进度: ${this._currentPathIndex + 1}/${this._currentPath.length}`);
            
            if (this._currentPathIndex < this._currentPath.length) {
                pathInfo.push(`下一个节点: ${this._currentPath[this._currentPathIndex]}`);
            }
            
            // 显示剩余路径
            if (this._currentPathIndex < this._currentPath.length - 1) {
                const remainingPath = this._currentPath.slice(this._currentPathIndex);
                pathInfo.push(`剩余路径: ${remainingPath.join(' → ')}`);
            }
        } else {
            pathInfo.push('当前无计划路径');
        }
        
        // 路径跟随状态
        pathStatus.push(`路径跟随状态: ${this._isFollowingPath ? '跟随中' : '未跟随'}`);
        pathStatus.push(`最终目标: ${this._finalDestination || '未设置'}`);
        
        if (this._isFollowingPath) {
            pathStatus.push(`路径索引: ${this._currentPathIndex}`);
            if (this._currentPath && this._currentPathIndex < this._currentPath.length) {
                const currentTarget = this._currentPath[this._currentPathIndex];
                pathStatus.push(`当前目标节点: ${currentTarget}`);
                
                // 计算到最终目标的剩余距离
                const remainingNodes = this._currentPath.length - this._currentPathIndex - 1;
                pathStatus.push(`剩余节点数: ${remainingNodes}`);
            }
        } else {
            pathStatus.push('当前使用随机移动模式');
        }
        
        // 更新readonly数组（需要清空后重新填充）
        this.touristStatusInfo.length = 0;
        this.touristStatusInfo.push(...statusInfo);
        
        this.targetNodeDetails.length = 0;
        this.targetNodeDetails.push(...targetDetails);
        
        this.plannedPathInfo.length = 0;
        this.plannedPathInfo.push(...pathInfo);
        
        this.pathFollowingStatus.length = 0;
        this.pathFollowingStatus.push(...pathStatus);
    }
    
    /**
     * 设置最终目标点
     * @param destinationName 最终目标点名称
     */
    setTargetDestination(destinationName: string): void {
        this._finalDestination = this.ensureEntranceDestination(destinationName);
        this.start();
        // 如果设置了最终目标点且有当前点，开始导航
        if (this._finalDestination && this._currentPoint && this.tileEditorTool) {
            console.log(`设置目标点: ${this._finalDestination}, 当前点: ${this._currentPoint}`);
            this.navigateToDestination();
        } else if (this._finalDestination && !this._currentPoint) {
            console.log(`目标点已设置为: ${this._finalDestination}, 等待设置当前点后开始导航`);
        }
    }
    
    /**
     * 获取最终目标点
     */
    getTargetDestination(): string {
        return this._finalDestination;
    }
    
    /**
     * 导航到最终目标点
     */
    private navigateToDestination(): void {
        if (!this._finalDestination || !this.tileEditorTool) {
            return;
        }
        
        // 如果当前点就是目标点，无需移动
        if (this._currentPoint === this._finalDestination) {
            console.log(`游客已在目标点: ${this._finalDestination}`);
            return;
        }
        
        // 使用A*算法计算路径
        const path = this.tileEditorTool.getPath(this._currentPoint, this._finalDestination);
        
        if (path.length === 0) {
            console.warn(`无法找到从 ${this._currentPoint} 到 ${this._finalDestination} 的路径`);
            return;
        }
        
        // 开始跟随路径
        this.startFollowingPath(path);
    }
    
    /**
     * 开始跟随指定路径
     * @param path 路径节点数组
     */
    private startFollowingPath(path: string[]): void {
        this._currentPath = path;
        this._isFollowingPath = true;
        
        console.log(`开始跟随路径: ${path.join(' -> ')}`);
        
        // 检查路径是否有效
        if (path.length === 0) {
            console.warn('路径为空，停止跟随');
            this.stopFollowingPath();
            return;
        }
        
        // 如果路径只有一个节点（起点和终点相同），直接完成
        if (path.length === 1) {
            console.log('起点和终点相同，路径跟随完成');
            this.stopFollowingPath();
            return;
        }
        
        // 设置路径索引，从第二个节点开始（跳过当前位置）
        this._currentPathIndex = 1;
        
        // 立即开始移动到下一个节点
        const nextPoint = path[this._currentPathIndex];
        console.log(`开始移动到路径中的第一个目标节点: ${nextPoint}`);
        this.moveToPoint(nextPoint);
    }
    
    /**
     * 停止路径跟随
     */
    private stopFollowingPath(): void {
        this._isFollowingPath = false;
        this._currentPath = [];
        this._currentPathIndex = 0;
    }
    
    /**
     * 强制重新计算路径（当导航点被禁用时调用）
     */
    forceRecalculatePath(): void {
        console.log(`游客 ${this.node.name} 被要求重新计算路径`);
        
        // 如果没有最终目标点，无需重新计算
        if (!this._finalDestination || !this.tileEditorTool) {
            console.log('没有最终目标点或导航系统不可用，跳过路径重新计算');
            return;
        }
        
        // 停止当前移动
        this.stopMoving();
        this.stopFollowingPath();
        
        // 重新计算路径
        console.log(`重新计算从 ${this._currentPoint} 到 ${this._finalDestination} 的路径`);
        this.navigateToDestination();
    }
    
    /**
     * 检查当前路径是否包含指定的导航点
     * @param pointName 导航点名称
     * @returns 如果路径包含该点则返回true
     */
    isPathContainingPoint(pointName: string): boolean {
        return this._currentPath.includes(pointName);
    }
    
    /**
     * 获取当前路径的副本
     * @returns 当前路径数组的副本
     */
    getCurrentPath(): string[] {
        return [...this._currentPath];
    }
    
    /**
     * 检查游客是否正在跟随路径
     * @returns 如果正在跟随路径则返回true
     */
    isFollowingPath(): boolean {
        return this._isFollowingPath;
    }
    
    onDestroy() {
        // 清理移动状态
        this.stopMoving();
    }

    /** 获取场景中的第一个 TileEditorTool */
    private getTileEditorTool(): TileEditorTool | null {
        try {
            const scene = director.getScene();
            if (!scene) return null;
            const tools = scene.getComponentsInChildren(TileEditorTool) || [];
            return tools.length > 0 ? tools[0] : null;
        } catch {
            return null;
        }
    }

    /** 在移动到另一 Tile 的路径中途执行一次换父节点 */
    private tryMidwayReparent(): void {
        if (this._midReparentDone || !this._targetPoint) return;
        const total = Vec3.distance(this._lastMoveStart, this._lastMoveTarget);
        if (total <= 0) return;
        const cur = this.node.getWorldPosition();
        const moved = Vec3.distance(cur, this._lastMoveStart);
        if (moved >= total * 0.5) {
            this.reparentToTileForPoint(this._targetPoint);
            this._midReparentDone = true;
        }
    }

    /** 根据导航点名称确定应挂载的 Tile 名称，并进行挂载 */
    private reparentToTileForPoint(pointName: string): void {
        const tileName = this.getTileNameForPoint(pointName);
        if (!tileName) return;
        const tileNode = this.getTileNodeByName(tileName);
        if (tileNode) {
            this.node.setParent(tileNode, true);
        } else if (this.mapContainer) {
            this.node.setParent(this.mapContainer, true);
        }
    }

    /** 获取某导航点对应的 Tile 名称（入口点映射到最近Tile） */
    private getTileNameForPoint(pointName: string): string | null {
        if (!pointName) return null;
        // 已是 Tile 名称
        if (/^Tile_\d+_\d+$/i.test(pointName)) return pointName;
        // 入口：寻找与其相邻的 Tile
        if (this.tileEditorTool && this.tileEditorTool.isEntrancePointName(pointName)) {
            const adj = this.tileEditorTool.getAdjacentPoints(pointName) || [];
            const tileAdj = adj.find(n => /^Tile_\d+_\d+$/i.test(n));
            if (tileAdj) return tileAdj;
            // 兜底：按入口世界坐标查找最近可通行 Tile
            const pos = this.tileEditorTool.getNavigationPointPosition(pointName);
            if (pos) {
                const nearest = this.tileEditorTool.findNearestNavigationPointName(pos, true);
                if (nearest && /^Tile_\d+_\d+$/i.test(nearest)) return nearest;
            }
        }
        return null;
    }

    /** 通过名称在 MapContainer 下查找 Tile 节点 */
    private getTileNodeByName(tileName: string): Node | null {
        if (!this.mapContainer || !tileName) return null;
        // 直接子节点优先
        const direct = this.mapContainer.getChildByName(tileName);
        if (direct) return direct;
        // 兜底：遍历搜索
        for (const child of this.mapContainer.children) {
            if (child.name === tileName) return child;
        }
        return null;
    }

    /** 尝试在场景中查找名为 MapContainer 的节点 */
    private findMapContainerNode(): Node | null {
        try {
            const scene = director.getScene();
            if (!scene) return null;
            let candidate: Node | null = scene.getChildByName('MapContainer');
            if (candidate) return candidate;
            const stack: Node[] = [scene];
            while (stack.length > 0) {
                const n = stack.pop()!;
                for (const c of n.children) {
                    if (c.name === 'MapContainer') return c;
                    stack.push(c);
                }
            }
            return null;
        } catch {
            return null;
        }
    }
}