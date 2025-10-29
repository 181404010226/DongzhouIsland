import { _decorator, Component, Node, Vec2, EventTouch, input, Input, Camera, UITransform, Vec3, Canvas } from 'cc';
import { InteractionManager } from './InteractionManager';

const { ccclass, property } = _decorator;

/**
 * 交互阶段枚举
 */
enum TouchPhase {
    INITIAL = 'initial',        // 初始阶段 (0-150ms)
    SHORT_PRESS = 'short_press', // 短按阶段 (150-300ms)
    LONG_PRESS = 'long_press'   // 长按阶段 (>300ms)
}

/**
 * 交互状态锁枚举
 */
enum InteractionLock {
    NONE = 'none',
    BUILDING_DRAG = 'building_drag',    // 建筑拖拽锁
    BUILDING_BAR = 'building_bar',      // 建造栏滚动锁
    MAP_DRAG = 'map_drag'               // 地图拖拽锁
}

/**
 * 交互控制器
 * 负责输入事件监听、触摸阶段识别、滑动方向判定和状态锁管理
 * 将处理后的交互意图分发给InteractionManager执行具体逻辑
 */
@ccclass('InteractionControl')
export class InteractionControl extends Component {
    @property({ type: InteractionManager, tooltip: '交互管理器' })
    interactionManager: InteractionManager = null;
    
    @property({ type: Node, tooltip: '建造栏节点（用于区域检测和自定义滚动）' })
    buildingBarNode: Node = null;
    
    @property({ type: Node, tooltip: '地图视觉窗口节点，定义地图操作的有效区域范围' })
    mapCanvas: Node = null;
    
    @property({ type: Canvas, tooltip: '地图区域Canvas组件（Canvas节点）' })
    mapCanvasComponent: Canvas = null;
    
    @property({ type: Canvas, tooltip: '建造栏区域Canvas组件（CanvasUI节点）' })
    uiCanvasComponent: Canvas = null;
    
    @property({ tooltip: '初始阶段时间（秒）' })
    initialPhaseTime: number = 0.15;
    
    @property({ tooltip: '短按阶段时间（秒）' })
    shortPressTime: number = 0.3;
    
    @property({ tooltip: '滑动方向判定阈值（像素）' })
    slideThreshold: number = 10;
    
    @property({ tooltip: '横纵向滑动比例阈值' })
    horizontalRatio: number = 1.5;
    
    @property({ tooltip: '滑动速度阈值（像素/秒）' })
    slideSpeedThreshold: number = 100;
    
    // 拖拽行为优化：仅当Y坐标超过阈值时触发“拖出”
    @property({ tooltip: '触发拖出效果的Y坐标阈值（UI坐标）' })
    dragOutYThreshold: number = 200;
    
    
    @property({ tooltip: '启用详细的区域检测调试日志' })
    enableRegionDebugLog: boolean = true;
    
    // 触摸状态变量
    private touchStartPos: Vec2 = new Vec2();
    private lastTouchPos: Vec2 = new Vec2();
    private currentTouchPos: Vec2 = new Vec2();
    private touchStartTime: number = 0;
    private lastMoveTime: number = 0;
    private touchStartEvent: EventTouch = null;
    
    // 阶段和锁状态
    private currentPhase: TouchPhase = TouchPhase.INITIAL;
    private currentLock: InteractionLock = InteractionLock.NONE;
    private phaseTimer: number = 0;
    
    // 移动状态
    private isTouching: boolean = false;
    private hasMovedBeyondThreshold: boolean = false;
    private isInBuildingBarArea: boolean = false;
    
    start() {
        this.setupInput();
        this.setupOperationStateListener();
        
        // 初始化建造栏自定义滚动功能
        if (this.buildingBarNode) {
            console.log('[InteractionControl] 建造栏自定义滚动功能已启用');
            // BuildingBarManager现在通过PlayerOperationState统一管理，不再直接获取引用
        } else {
            console.log('[InteractionControl] 警告：建造栏节点未配置，滚动功能将不可用');
        }
        
        console.log('InteractionControl 初始化完成');
    }
    
    /**
     * 设置输入事件监听
     */
    private setupInput() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    
    /**
     * 设置操作状态监听器
     * 注意：移除PlayerOperationState依赖后，状态管理现在由各组件独立处理
     */
    private setupOperationStateListener() {
        // 移除PlayerOperationState依赖，状态管理现在分布式处理
        console.log('InteractionControl: 状态管理已改为分布式处理');
    }
    
    /**
     * 触摸开始事件
     */
    private onTouchStart(event: EventTouch) {
        // 获取UI坐标
        const touchPos = event.getUILocation();
        this.touchStartPos.set(touchPos);
        this.lastTouchPos.set(touchPos);
        this.currentTouchPos.set(touchPos);
        this.touchStartTime = Date.now();
        this.lastMoveTime = this.touchStartTime;
        this.touchStartEvent = event;
        
        // 重置状态
        this.isTouching = true;
        this.hasMovedBeyondThreshold = false;
        this.currentPhase = TouchPhase.INITIAL;
        this.phaseTimer = 0;
        
        // 预检测触摸区域（使用屏幕坐标）
        this.isInBuildingBarArea = this.buildingBarNode && this.checkPointInBuildingBar(touchPos);
        const isInMapArea = this.mapCanvas && this.isPointInMapArea(touchPos);
        
        if (this.enableRegionDebugLog) {
            console.log(`[InteractionControl] 触摸区域检测结果: BuildingBar=${this.isInBuildingBarArea}, MapArea=${isInMapArea}`);
        }
        
        if (this.isInBuildingBarArea) {
            console.log('[InteractionControl] 触摸在建造栏区域内，准备处理滚动交互');
        } else if (isInMapArea) {
            console.log('[InteractionControl] 触摸在地图区域内，准备处理地图交互');
        } else {
            console.log('[InteractionControl] 触摸在未定义区域，使用默认交互逻辑');
        }
        
        // 通知InteractionManager处理触摸开始
        if (this.interactionManager) {
            this.interactionManager.handleTouchStart(event);
        }
        
        console.log('触摸开始，进入初始阶段');
    }
    
    /**
     * 触摸移动事件
     */
    private onTouchMove(event: EventTouch) {
        if (!this.isTouching) return;
        
        // 获取UI坐标
        const touchPos = event.getUILocation();
        const currentTime = Date.now();
        
        // 计算移动距离和速度
        const deltaX = touchPos.x - this.touchStartPos.x;
        const deltaY = touchPos.y - this.touchStartPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 计算瞬时速度（像素/秒）- 使用当前触摸位置和上次触摸位置
        const timeDelta = currentTime - this.lastMoveTime;
        const moveDeltaX = touchPos.x - this.currentTouchPos.x;
        const moveDeltaY = touchPos.y - this.currentTouchPos.y;
        const moveDistance = Math.sqrt(moveDeltaX * moveDeltaX + moveDeltaY * moveDeltaY);
        const speed = timeDelta > 0 ? (moveDistance / timeDelta) * 1000 : 0; // 转换为像素/秒
        
        // 更新触摸位置记录
        this.lastTouchPos.set(this.currentTouchPos);
        this.currentTouchPos.set(touchPos);
        
        // 检查是否超过滑动阈值
        if (!this.hasMovedBeyondThreshold) {
            if (distance > this.slideThreshold || speed > this.slideSpeedThreshold) {
                this.hasMovedBeyondThreshold = true;
                this.handleSlideStart(deltaX, deltaY, speed);
            }
        }
        
        // 根据交互锁状态处理不同的移动逻辑
        switch (this.currentLock) {
            case InteractionLock.BUILDING_DRAG:
                // 建筑拖拽状态，传递给InteractionManager处理
                if (this.interactionManager) {
                    this.interactionManager.handleTouchMove(event, this.lastTouchPos);
                }
                break;
                
            case InteractionLock.BUILDING_BAR:
                // 建造栏区域内的所有移动都只处理建造栏滚动，不处理建筑拖拽或地图移动
                this.handleBuildingBarMove(event);
                // 建造栏区域内的移动不应该传递给地图处理
                break;
                
            case InteractionLock.MAP_DRAG:
                // 地图拖拽状态，传递给InteractionManager处理
                if (this.interactionManager) {
                    this.interactionManager.handleTouchMove(event, this.lastTouchPos);
                }
                break;
                
            case InteractionLock.NONE:
                // 无锁状态，通知InteractionManager处理触摸移动
                if (this.interactionManager) {
                    this.interactionManager.handleTouchMove(event, this.lastTouchPos);
                }
                break;
        }
        
        // 更新时间记录
        this.lastMoveTime = currentTime;
    }
    
    /**
     * 触摸结束事件
     */
    private onTouchEnd(event: EventTouch) {
        if (!this.isTouching) return;
        
        const touchDuration = Date.now() - this.touchStartTime;
        console.log(`[InteractionControl] 触摸结束，持续时间: ${touchDuration}ms，当前锁状态: ${this.currentLock}`);
        
        // 根据当前交互锁状态处理触摸结束
        switch (this.currentLock) {
            case InteractionLock.BUILDING_BAR:
                // 建造栏区域内，区分点击和滑动
                if (this.hasMovedBeyondThreshold) {
                    // 发生了滑动，处理滚动结束
                    this.handleBuildingBarEnd(event, touchDuration);
                } else {
                    // 没有滑动，处理点击事件 - 传递事件对象而不是坐标
                    if (this.interactionManager) {
                        this.interactionManager.handleTapEvent(event);
                        console.log('建造栏区域内点击事件');
                    }
                }
                break;
            case InteractionLock.BUILDING_DRAG:
            case InteractionLock.MAP_DRAG:
                // 通知InteractionManager处理触摸结束
                if (this.interactionManager) {
                    this.interactionManager.handleTouchEnd(event, this.currentPhase === TouchPhase.LONG_PRESS);
                }
                break;
            default:
                // 无锁状态，根据当前阶段和移动状态处理触摸结束
                this.handleTouchEndByPhase(event);
                // 通知InteractionManager处理触摸结束
                if (this.interactionManager) {
                    this.interactionManager.handleTouchEnd(event, this.currentPhase === TouchPhase.LONG_PRESS);
                }
                break;
        }
        
        // 重置状态
        this.resetTouchState();
        
        console.log('触摸结束，重置状态');
    }
    
    /**
     * 处理滑动开始
     */
    private handleSlideStart(deltaX?: number, deltaY?: number, speed?: number) {
        if (this.currentLock !== InteractionLock.NONE) {
            return; // 已经有锁定状态
        }
        
        // 如果没有传入参数，则计算当前位置的滑动方向
        if (deltaX === undefined || deltaY === undefined) {
            deltaX = this.currentTouchPos.x - this.touchStartPos.x;
            deltaY = this.currentTouchPos.y - this.touchStartPos.y;
        }
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        console.log(`[InteractionControl] 滑动开始: deltaX=${deltaX.toFixed(1)}, deltaY=${deltaY.toFixed(1)}, speed=${speed ? speed.toFixed(1) : 'N/A'}px/s`);
        
        const isInMapArea = this.mapCanvas && this.isPointInMapArea(this.touchStartPos);
        console.log(`[InteractionControl] 区域检测结果:`);
        console.log(`  - 建造栏滚动区域(BuildingBar): ${this.isInBuildingBarArea}`);
        console.log(`  - 地图操作区域(MapCanvas): ${isInMapArea}`);
        console.log(`  - 触摸起始位置: (${this.touchStartPos.x.toFixed(1)}, ${this.touchStartPos.y.toFixed(1)})`);
        
        // 区域优先级检测和交互锁分配
        const lockResult = this.determineLockByRegionAndDirection(isInMapArea, absX, absY);
        this.assignLock(lockResult.lock);
        console.log(`[InteractionControl] 分配交互锁: ${lockResult.lock} (${lockResult.reason})`);
        
        console.log(`滑动开始，方向判定: deltaX=${absX.toFixed(1)}, deltaY=${absY.toFixed(1)}, 锁定状态: ${this.currentLock}`);
    }
    
    /**
     * 根据区域和滑动方向确定交互锁
     */
    private determineLockByRegionAndDirection(isInMapArea: boolean, absX: number, absY: number): { lock: InteractionLock, reason: string } {
        // 最高优先级：建造栏区域内根据拖拽方向智能判定
        if (this.isInBuildingBarArea) {
            return this.determineBuildingBarLockByDirection(absX, absY);
        }
        
        // 判断滑动方向并根据区域分配状态锁
        if (absX > absY * this.horizontalRatio) {
            // 横向滑动
            if (isInMapArea) {
                return { lock: InteractionLock.MAP_DRAG, reason: '地图区域内水平滑动' };
            } else {
                return { lock: InteractionLock.MAP_DRAG, reason: '非特定区域水平滑动，默认地图拖拽' };
            }
        } else if (absY > absX * this.horizontalRatio) {
            // 纵向滑动
            if (isInMapArea) {
                return { lock: InteractionLock.MAP_DRAG, reason: '地图区域内垂直滑动' };
            } else {
                return { lock: InteractionLock.BUILDING_DRAG, reason: '非特定区域垂直滑动，建筑拖拽操作' };
            }
        } else {
            // 斜向滑动
            if (isInMapArea) {
                return { lock: InteractionLock.MAP_DRAG, reason: '地图区域内对角线滑动' };
            } else {
                return { lock: InteractionLock.MAP_DRAG, reason: '非特定区域对角线滑动，默认地图拖拽' };
            }
        }
    }
    
    /**
     * 建造栏区域内根据拖拽方向确定交互锁
     * 水平拖动：滚动视图
     * 垂直拖动：拖拽建筑
     * 斜向拖动：以45°为基准，斜向上为拖拽建筑，其他为滚动视图
     */
    private determineBuildingBarLockByDirection(absX: number, absY: number): { lock: InteractionLock, reason: string } {
        // 若触摸起始Y未超过阈值，则在建造栏内一律视为滚动视图（仅水平滚动）
        if (this.touchStartPos && this.touchStartPos.y <= this.dragOutYThreshold) {
            return { lock: InteractionLock.BUILDING_BAR, reason: `起始Y(${this.touchStartPos.y.toFixed(1)})未超过阈值(${this.dragOutYThreshold})，保持滚动视图` };
        }
        
        // 计算拖拽角度（相对于水平方向的角度，单位：度）
        const angle = Math.atan2(absY, absX) * (180 / Math.PI);
        
        console.log(`[InteractionControl] 建造栏区域拖拽方向分析: absX=${absX.toFixed(1)}, absY=${absY.toFixed(1)}, angle=${angle.toFixed(1)}°`);
        
        // 精确的45度角判定逻辑
        // 水平拖动：角度在0°-22.5°和157.5°-180°范围内
        if (angle <= 22.5 || angle >= 157.5) {
            return { lock: InteractionLock.BUILDING_BAR, reason: `建造栏区域水平拖动(${angle.toFixed(1)}°)，滚动视图` };
        }
        
        // 垂直拖动：角度在67.5°-112.5°范围内
        if (angle >= 67.5 && angle <= 112.5) {
            return { lock: InteractionLock.BUILDING_DRAG, reason: `建造栏区域垂直拖动(${angle.toFixed(1)}°)，拖拽建筑` };
        }
        
        // 斜向拖动：以45°为基准进行精确判定
        // 右上斜向（22.5°-67.5°）：属于拖拽建筑（斜向上）
        if (angle > 22.5 && angle < 67.5) {
            // 进一步细分：更接近45°的角度优先拖拽建筑
            const distanceFrom45 = Math.abs(angle - 45);
            if (distanceFrom45 <= 22.5) {
                return { lock: InteractionLock.BUILDING_DRAG, reason: `建造栏区域右上斜向拖动(${angle.toFixed(1)}°)，接近45°，拖拽建筑` };
            } else {
                // 更接近水平或垂直的斜向，根据主导方向判定
                return angle < 45 ? 
                    { lock: InteractionLock.BUILDING_BAR, reason: `建造栏区域偏水平斜向(${angle.toFixed(1)}°)，滚动视图` } :
                    { lock: InteractionLock.BUILDING_DRAG, reason: `建造栏区域偏垂直斜向(${angle.toFixed(1)}°)，拖拽建筑` };
            }
        }
        
        // 左上斜向（112.5°-157.5°）：属于拖拽建筑（斜向上）
        if (angle > 112.5 && angle < 157.5) {
            // 进一步细分：更接近135°的角度优先拖拽建筑
            const distanceFrom135 = Math.abs(angle - 135);
            if (distanceFrom135 <= 22.5) {
                return { lock: InteractionLock.BUILDING_DRAG, reason: `建造栏区域左上斜向拖动(${angle.toFixed(1)}°)，接近135°，拖拽建筑` };
            } else {
                // 更接近水平或垂直的斜向，根据主导方向判定
                return angle > 135 ? 
                    { lock: InteractionLock.BUILDING_BAR, reason: `建造栏区域偏水平斜向(${angle.toFixed(1)}°)，滚动视图` } :
                    { lock: InteractionLock.BUILDING_DRAG, reason: `建造栏区域偏垂直斜向(${angle.toFixed(1)}°)，拖拽建筑` };
            }
        }
        
        // 默认情况（理论上不应该到达这里）
        return { lock: InteractionLock.BUILDING_BAR, reason: `建造栏区域默认处理(${angle.toFixed(1)}°)，滚动视图` };
    }
    
    /**
     * 分配交互锁
     */
    private assignLock(lock: InteractionLock) {
        this.currentLock = lock;
        
        switch (lock) {
            case InteractionLock.BUILDING_DRAG:
                // 建造栏区域内且未超过阈值时，不允许触发建筑拖拽，改为滚动视图
                if (this.isInBuildingBarArea && this.currentTouchPos && this.currentTouchPos.y <= this.dragOutYThreshold) {
                    console.log(`[InteractionControl] 当前Y(${this.currentTouchPos.y.toFixed(1)})未超过阈值(${this.dragOutYThreshold})，不触发建筑拖拽，改为建造栏滚动`);
                    this.currentLock = InteractionLock.BUILDING_BAR;
                    break;
                }
                // 检查是否真的点击了建筑，只有在点击建筑时才启动建筑拖拽
                if (this.interactionManager && this.interactionManager.checkBuildingAtPosition) {
                    const hasBuildingAtPos = this.interactionManager.checkBuildingAtPosition(this.touchStartPos);
                    if (hasBuildingAtPos) {
                        this.interactionManager.startBuildingDrag(this.touchStartPos);
                        console.log('检测到建筑点击，启动建筑拖拽');
                    } else {
                        // 没有建筑，改为地图拖拽
                        console.log('在没有点击建筑时，不触发建筑拖拽，改为地图拖拽');
                        this.currentLock = InteractionLock.MAP_DRAG;
                        this.interactionManager.startMapDrag();
                        // 移除PlayerOperationState依赖，状态由InteractionManager管理
                    }
                } else {
                    console.log('InteractionManager不可用或缺少建筑检测方法');
                }
                break;
            case InteractionLock.BUILDING_BAR:
                // 建造栏滚动操作
                console.log('锁定为建造栏滚动操作');
                break;
            case InteractionLock.MAP_DRAG:
                // 通知InteractionManager开始地图拖拽
                if (this.interactionManager) {
                    this.interactionManager.startMapDrag();
                }
                // 移除PlayerOperationState依赖，状态由InteractionManager管理
                break;
        }
    }
    
    /**
     * 更新触摸阶段
     */
    private updateTouchPhase() {
        if (this.currentPhase === TouchPhase.INITIAL && this.phaseTimer >= this.initialPhaseTime) {
            this.currentPhase = TouchPhase.SHORT_PRESS;
            console.log('进入短按阶段');
        } else if (this.currentPhase === TouchPhase.SHORT_PRESS && this.phaseTimer >= this.shortPressTime) {
            this.currentPhase = TouchPhase.LONG_PRESS;
            this.handleLongPressStart();
            console.log('进入长按阶段');
        }
    }
    
    /**
     * 处理长按开始
     */
    private handleLongPressStart() {
        if (!this.hasMovedBeyondThreshold && this.currentLock === InteractionLock.NONE) {
            // 静止长按，触发长按选择
            // 移除PlayerOperationState依赖，长按状态由InteractionManager处理
            if (this.interactionManager && this.touchStartEvent) {
                this.interactionManager.handleLongPressSelection(this.touchStartEvent);
            }
        }
    }
    
    /**
     * 根据阶段处理触摸结束
     */
    private handleTouchEndByPhase(event: EventTouch) {
        switch (this.currentPhase) {
            case TouchPhase.INITIAL:
            case TouchPhase.SHORT_PRESS:
                if (!this.hasMovedBeyondThreshold) {
                    // 短按点击 - 传递事件对象
                    this.handleTapEvent(event);
                }
                break;
            case TouchPhase.LONG_PRESS:
                // 长按结束，根据锁状态处理
                this.handleLongPressEnd();
                break;
        }
    }
    
    /**
     * 处理点击（传递事件对象）
     */
    private handleTapEvent(event: EventTouch) {
        console.log('检测到点击操作');
        if (this.interactionManager) {
            this.interactionManager.handleTapEvent(event);
        }
    }
    
    /**
     * 处理点击（兼容性保留）
     */
    private handleTap() {
        console.log('检测到点击操作');
        if (this.interactionManager) {
            this.interactionManager.handleTap(this.touchStartPos);
        }
    }
    
    /**
     * 处理长按结束
     */
    private handleLongPressEnd() {
        // 移除PlayerOperationState依赖，状态重置由各组件自行处理
        console.log('长按结束，状态重置由InteractionManager处理');
    }
    
    /**
     * 重置触摸状态
     */
    private resetTouchState() {
        this.isTouching = false;
        this.hasMovedBeyondThreshold = false;
        this.currentPhase = TouchPhase.INITIAL;
        this.currentLock = InteractionLock.NONE;
        this.phaseTimer = 0;
    }
    
    /**
     * 更新触摸阶段
     */
    update(deltaTime: number) {
        if (this.isTouching) {
            this.phaseTimer += deltaTime;
            this.updateTouchPhase();
        }
    }
    
    /**
     * 设置交互管理器
     */
    setInteractionManager(manager: InteractionManager) {
        this.interactionManager = manager;
    }
    
    /**
     * 设置初始阶段时间
     */
    setInitialPhaseTime(time: number) {
        this.initialPhaseTime = Math.max(0.05, time);
    }
    
    /**
     * 设置短按阶段时间
     */
    setShortPressTime(time: number) {
        this.shortPressTime = Math.max(0.1, time);
    }
    
    /**
     * 设置滑动阈值
     */
    setSlideThreshold(threshold: number) {
        this.slideThreshold = Math.max(5, threshold);
    }
    
    /**
     * 设置横纵向滑动比例阈值
     */
    setHorizontalRatio(ratio: number) {
        this.horizontalRatio = Math.max(1.0, ratio);
    }
    
    /**
     * 获取当前触摸阶段
     */
    getCurrentPhase(): TouchPhase {
        return this.currentPhase;
    }
    
    /**
     * 获取当前交互锁状态
     */
    getCurrentLock(): InteractionLock {
        return this.currentLock;
    }
    
    /**
     * 获取当前是否正在触摸
     */
    isTouchActive(): boolean {
        return this.isTouching;
    }
    
    /**
     * 获取当前是否已移动超过阈值
     */
    hasMovedBeyondSlideThreshold(): boolean {
        return this.hasMovedBeyondThreshold;
    }
    
    /**
     * 获取建造栏的区域大小
     * @returns 返回建造栏的宽度和高度，如果节点不存在则返回null
     */
    getBuildingBarSize(): { width: number, height: number } | null {
        if (!this.buildingBarNode) {
            console.log('[InteractionControl] 建造栏节点未配置');
            return null;
        }
        
        const uiTransform = this.buildingBarNode.getComponent(UITransform);
        if (!uiTransform) {
            console.log('[InteractionControl] 建造栏节点缺少UITransform组件');
            return null;
        }
        
        const size = {
            width: uiTransform.width,
            height: uiTransform.height
        };
        
        console.log(`[InteractionControl] 建造栏区域大小: ${size.width} x ${size.height}`);
        return size;
    }
    
    /**
     * 检查点是否在建造栏区域内（公共方法，供InteractionManager调用）
     */
    public isPointInBuildingBar(screenPos: Vec2): boolean {
        return this.checkPointInBuildingBar(screenPos);
    }
    
    /**
     * 检查点是否在建造栏区域内（内部实现）
     */
    private checkPointInBuildingBar(screenPos: Vec2): boolean {
        if (!this.buildingBarNode) {
            return false;
        }
        
        const uiTransform = this.buildingBarNode.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }
        
        // 获取建造栏节点的世界位置
        const nodeWorldPos = this.buildingBarNode.worldPosition;
        
        // 直接使用UI坐标系统计算本地坐标
        // 屏幕坐标相对于节点中心的偏移
        const localX = screenPos.x - nodeWorldPos.x;
        const localY = screenPos.y - nodeWorldPos.y;
        
        // 获取节点的实际尺寸
        const width = uiTransform.width;
        const height = uiTransform.height;
        
        // 检查点是否在节点范围内（以节点中心为原点）
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const isInside = localX >= -halfWidth && localX <= halfWidth && 
                        localY >= -halfHeight && localY <= halfHeight;
        
        if (this.enableRegionDebugLog) {
            console.log(`[建造栏检测] 屏幕坐标: (${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)}), 节点世界位置: (${nodeWorldPos.x.toFixed(1)}, ${nodeWorldPos.y.toFixed(1)}), 本地坐标: (${localX.toFixed(1)}, ${localY.toFixed(1)}), 节点尺寸: ${width.toFixed(1)}x${height.toFixed(1)}, 范围: [${(-halfWidth).toFixed(1)}, ${(-halfHeight).toFixed(1)}] 到 [${halfWidth.toFixed(1)}, ${halfHeight.toFixed(1)}], 结果: ${isInside}`);
        }
        
        return isInside;
    }
    
    /**
     * 检查点是否在地图区域内
     */
    private isPointInMapArea(screenPos: Vec2): boolean {
        if (!this.mapCanvas) {
            return false;
        }
        
        const uiTransform = this.mapCanvas.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }
        
        // 使用装饰器挂载的地图Canvas组件
        if (!this.mapCanvasComponent) {
            if (this.enableRegionDebugLog) {
                console.log('[地图区域检测] 地图Canvas组件未配置');
            }
            return false;
        }
        
        const canvas = this.mapCanvasComponent;
        
        // 将屏幕坐标转换为世界坐标，再转换为地图Canvas节点的本地坐标
        const camera = canvas.cameraComponent;
        if (!camera) {
            if (this.enableRegionDebugLog) {
                console.log('[地图区域检测] 未找到Camera组件，无法进行坐标转换');
            }
            return false;
        }
        
        // 屏幕坐标转世界坐标
        const worldPos = new Vec3();
        camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0), worldPos);
        
        // 世界坐标转地图区域本地坐标
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        
        // 获取节点的实际尺寸
        const width = uiTransform.width;
        const height = uiTransform.height;
        
        // 检查点是否在节点范围内（以节点中心为原点）
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const isInside = localPos.x >= -halfWidth && localPos.x <= halfWidth && 
                        localPos.y >= -halfHeight && localPos.y <= halfHeight;
        
        // 将Vec3转换为Vec2用于日志显示
        const localPos2D = new Vec2(localPos.x, localPos.y);
        
        if (this.enableRegionDebugLog) {
            console.log(`[地图区域检测] 屏幕坐标: (${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)}), 世界坐标: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}), 本地坐标: (${localPos2D.x.toFixed(1)}, ${localPos2D.y.toFixed(1)}), 节点尺寸: ${width.toFixed(1)}x${height.toFixed(1)}, 范围: [${(-halfWidth).toFixed(1)}, ${(-halfHeight).toFixed(1)}] 到 [${halfWidth.toFixed(1)}, ${halfHeight.toFixed(1)}], 结果: ${isInside}`);
        }
        
        return isInside;
    }
    
    /**
     * 处理建造栏滚动移动
     */
    private handleBuildingBarMove(event: EventTouch) {
        // 移除PlayerOperationState依赖，通过InteractionManager处理建造栏滚动
        if (!this.interactionManager) {
            console.log('[InteractionControl] InteractionManager未配置');
            return;
        }
        
        // 只有在建造栏区域内才处理滚动
        if (!this.isInBuildingBarArea) {
            console.log('[InteractionControl] 触摸点不在建造栏区域内，跳过滚动处理');
            return;
        }
        
        // 获取UI坐标
        const touchPos = event.getUILocation();
        const deltaX = touchPos.x - this.lastTouchPos.x;
        let deltaY = touchPos.y - this.lastTouchPos.y;
        
        // 若当前Y未超过阈值，则清除Y轴偏移，仅执行水平滚动
        if (touchPos.y <= this.dragOutYThreshold) {
            deltaY = 0;
        } else {
            // Y超过阈值，若当前仍为建造栏滚动锁，则切换到建筑拖拽锁
            if (this.currentLock === InteractionLock.BUILDING_BAR) {
                console.log(`[InteractionControl] Y超过阈值(${this.dragOutYThreshold})，切换为建筑拖拽`);
                this.assignLock(InteractionLock.BUILDING_DRAG);
                // 切换锁后，当前移动不再作为滚动处理
                return;
            }
        }
        
        // 计算滚动速度
        const currentTime = Date.now();
        const timeDelta = currentTime - this.lastMoveTime;
        const speed = timeDelta > 0 ? Math.sqrt(deltaX * deltaX + deltaY * deltaY) / timeDelta * 1000 : 0;
        
        // 通过InteractionManager处理建造栏滚动
        this.interactionManager.handleBuildingBarMove(deltaX, deltaY, speed);
    }
    
    /**
     * 处理建造栏滚动结束
     */
    private handleBuildingBarEnd(event: EventTouch, touchDuration: number) {
        if (!this.interactionManager) {
            return;
        }
        
        console.log('[InteractionControl] 建造栏滚动交互结束');
        
        // 通过InteractionManager处理建造栏滚动结束
        this.interactionManager.handleBuildingBarEnd();
    }
    

    
    /**
     * 强制重置交互状态（用于外部中断）
     */
    forceReset() {
        this.resetTouchState();
        // 移除PlayerOperationState依赖，状态重置由InteractionManager处理
        if (this.interactionManager) {
            this.interactionManager.forceReset();
        }
        console.log('强制重置交互状态');
    }
    
    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        
        // 移除PlayerOperationState依赖，无需清理监听器
        
        console.log('[InteractionControl] 组件销毁完成');
    }
}