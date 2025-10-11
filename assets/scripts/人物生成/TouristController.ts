import { _decorator, Component, Node, Vec3, tween, Tween, CCString } from 'cc';
import { NavigationSystem } from './NavigationSystem';
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
    moveSpeed: number = 10;
    
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
     * 导航系统引用
     */
    private navigationSystem: NavigationSystem = null;
    
    
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
        const currentTime = Date.now() / 1000;
        
        // 检查冷却时间
        if (currentTime - this._lastPathRecalculationTime < this._pathRecalculationCooldown) {
            return;
        }
        
        // 检测是否有障碍
        if (!this.checkForObstacles()) {
            return;
        }
        
        console.log(`重新计算路径，从 ${this._currentPoint} 到 ${this._finalDestination}`);
        
        // 停止当前移动
        this.stopMoving();
        this.stopFollowingPath();
        
        // 重新计算路径
        this.navigateToDestination();
        
        // 更新重新计算时间
        this._lastPathRecalculationTime = currentTime;
    }
    
    start() {
        this.navigationSystem = NavigationSystem.getInstance();
        if (!this.navigationSystem) {
            console.error('导航系统未初始化');
            return;
        }
        
        // 如果没有设置当前点，尝试找到最近的导航点
        if (!this._currentPoint) {
            this.findNearestNavigationPoint();
        }
        
        // 初始化只读字段显示
        this.updateReadonlyFields();
    }
    
    update(deltaTime: number) {
        if (!this.navigationSystem) {
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
            // 跟随路径移动
            const nextPoint = this._currentPath[this._currentPathIndex];
            this.moveToPoint(nextPoint);
        }
        
        // 检查是否到达目标点
        if (this.isMoving && this._targetPoint) {
            const targetPosition = this.navigationSystem.getNavigationPointPosition(this._targetPoint);
            if (targetPosition) {
                const currentPosition = this.node.getWorldPosition();
                const distance = Vec3.distance(currentPosition, targetPosition);
                
                if (distance <= this.arrivalRange) {
                    this.onArriveAtTarget();
                } else {
                    // 检查是否需要重新计算路径（障碍检测）
                    this.recalculatePathIfNeeded();
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
        this._currentPoint = pointName;
        this.updateReadonlyFields();
        
        // 如果有最终目标点且导航系统可用，开始导航
        if (this._finalDestination && this._currentPoint && this.navigationSystem) {
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
        if (!this.navigationSystem) {
            return;
        }
        
        const targetPosition = this.navigationSystem.getNavigationPointPosition(pointName);
        if (!targetPosition) {
            console.error(`无法找到导航点: ${pointName}`);
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
        
        // 记录移动开始时间和位置（用于障碍检测）
        this._moveStartTime = Date.now() / 1000;
        this._lastPosition.set(currentPosition);
        
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
        
        // 检查是否正在跟随路径
        if (this._isFollowingPath && this._currentPath.length > 0) {
            // 检查是否到达最终目标点
            if (this._currentPoint === this._finalDestination) {
                console.log(`游客已到达最终目标点: ${this._finalDestination}`);
                this.stopFollowingPath();
                // 开始停留
                this.isStaying = true;
                this.stayTimer = 0;
            } else {
                // 移动到路径中的下一个节点
                this._currentPathIndex++;
                if (this._currentPathIndex < this._currentPath.length) {
                    const nextPoint = this._currentPath[this._currentPathIndex];
                    console.log(`路径跟随中，移动到下一个节点: ${nextPoint} (${this._currentPathIndex}/${this._currentPath.length - 1})`);
                    // 短暂停留后继续移动
                    this.isStaying = true;
                    this.stayTimer = 0;
                } else {
                    // 路径已完成，但没有到达最终目标（可能路径计算有问题）
                    console.warn(`路径跟随完成但未到达最终目标。当前点: ${this._currentPoint}, 目标: ${this._finalDestination}`);
                    this.stopFollowingPath();
                    this.isStaying = true;
                    this.stayTimer = 0;
                }
            }
        } else {
            // 普通移动模式，开始停留
            this.isStaying = true;
            this.stayTimer = 0;
        }
        
        // 更新只读字段
        this.updateReadonlyFields();
    }
    
    /**
     * 查找最近的导航点
     */
    private findNearestNavigationPoint(): void {
        if (!this.navigationSystem) {
            return;
        }
        
        const currentPosition = this.node.getWorldPosition();
        const allPointNames = this.navigationSystem.getAllNavigationPointNames();
        
        let nearestPoint: string = null;
        let nearestDistance = Infinity;
        
        for (const pointName of allPointNames) {
            const pointPosition = this.navigationSystem.getNavigationPointPosition(pointName);
            if (pointPosition) {
                const distance = Vec3.distance(currentPosition, pointPosition);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPoint = pointName;
                }
            }
        }
        
        if (nearestPoint) {
            this.setCurrentPoint(nearestPoint);
        }
    }
    
    /**
     * 传送到指定导航点
     * @param pointName 导航点名称
     */
    teleportToPoint(pointName: string): void {
        if (!this.navigationSystem) {
            return;
        }
        
        const targetPosition = this.navigationSystem.getNavigationPointPosition(pointName);
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
        if (this._targetPoint && this.navigationSystem) {
            const targetPosition = this.navigationSystem.getNavigationPointPosition(this._targetPoint);
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
                const adjacentPoints = this.navigationSystem.getAdjacentPoints(this._targetPoint);
                if (adjacentPoints && adjacentPoints.length > 0) {
                    targetDetails.push(`目标点相邻点: ${adjacentPoints.join(', ')}`);
                }
            }
        } else {
            targetDetails.push('当前无目标点');
        }
        
        // 当前点详细信息
        if (this._currentPoint && this.navigationSystem) {
            const currentAdjacentPoints = this.navigationSystem.getAdjacentPoints(this._currentPoint);
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
        this._finalDestination = destinationName;
        this.start();
        // 如果设置了最终目标点且有当前点，开始导航
        if (this._finalDestination && this._currentPoint && this.navigationSystem) {
            console.log(`设置目标点: ${destinationName}, 当前点: ${this._currentPoint}`);
            this.navigateToDestination();
        } else if (this._finalDestination && !this._currentPoint) {
            console.log(`目标点已设置为: ${destinationName}, 等待设置当前点后开始导航`);
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
        if (!this._finalDestination || !this.navigationSystem) {
            return;
        }
        
        // 如果当前点就是目标点，无需移动
        if (this._currentPoint === this._finalDestination) {
            console.log(`游客已在目标点: ${this._finalDestination}`);
            return;
        }
        
        // 使用A*算法计算路径
        const path = this.navigationSystem.getPath(this._currentPoint, this._finalDestination);
        
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
    
    onDestroy() {
        this.stopMoving();
    }
}