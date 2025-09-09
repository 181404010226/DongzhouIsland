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
    @property
    autoMove: boolean = true;
    
    // 编辑器只读字段：游客状态信息
    @property({ type: [CCString], readonly: true, tooltip: '游客当前状态信息（编辑器查看）' })
    private readonly touristStatusInfo: string[] = [];
    
    // 编辑器只读字段：目标节点详细信息
    @property({ type: [CCString], readonly: true, tooltip: '目标节点详细信息（编辑器查看）' })
    private readonly targetNodeDetails: string[] = [];
    
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
        if (!this.autoMove || !this.navigationSystem) {
            return;
        }
        
        // 如果正在停留，更新停留计时器
        if (this.isStaying) {
            this.stayTimer += deltaTime;
            if (this.stayTimer >= this.stayDuration) {
                this.isStaying = false;
                this.stayTimer = 0;
                this.moveToRandomAdjacentPoint();
            }
            // 定期更新只读字段显示
            this.updateReadonlyFields();
            return;
        }
        
        // 如果没有在移动且没有在停留，开始移动
        if (!this.isMoving && !this.isStaying) {
            this.moveToRandomAdjacentPoint();
        }
        
        // 检查是否到达目标点
        if (this.isMoving && this._targetPoint) {
            const targetPosition = this.navigationSystem.getNavigationPointPosition(this._targetPoint);
            if (targetPosition) {
                const currentPosition = this.node.getWorldPosition();
                const distance = Vec3.distance(currentPosition, targetPosition);
                
                if (distance <= this.arrivalRange) {
                    this.onArriveAtTarget();
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
    moveToRandomAdjacentPoint(): void {
        if (!this.navigationSystem || !this._currentPoint) {
            return;
        }
        
        // 获取随机相邻点
        const randomAdjacentPoint = this.navigationSystem.getRandomAdjacentPoint(this._currentPoint);
        if (!randomAdjacentPoint) {
            console.warn(`导航点 ${this._currentPoint} 没有相邻点`);
            return;
        }
        
        this.moveToPoint(randomAdjacentPoint);
    }
    
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
        
        // 开始停留
        this.isStaying = true;
        this.stayTimer = 0;
        
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
    setAutoMove(enabled: boolean): void {
        this.autoMove = enabled;
        if (!enabled) {
            this.stopMoving();
            this.isStaying = false;
        }
    }
    
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
        statusInfo.push(`自动移动: ${this.autoMove ? '启用' : '禁用'}`);
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
        
        // 更新readonly数组（需要清空后重新填充）
        this.touristStatusInfo.length = 0;
        this.touristStatusInfo.push(...statusInfo);
        
        this.targetNodeDetails.length = 0;
        this.targetNodeDetails.push(...targetDetails);
    }
    
    onDestroy() {
        this.stopMoving();
    }
}