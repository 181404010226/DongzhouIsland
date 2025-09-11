import { _decorator, Component, Node, Vec2, Vec3, EventTouch, EventMouse, Camera, view } from 'cc';
import { TileSelectionManager } from '../地图生成/TileSelectionManager';
import { PlayerOperationState, PlayerOperationType } from './PlayerOperationState';
import { BuildingPlacer } from '../地图生成/BuildingPlacer';
import { TileOccupancyManager } from '../地图生成/TileOccupancyManager';
import { BuildInfo } from '../地图生成/BuildInfo';
import { BuildingDetailButtonManager } from '../UI面板/BuildingDetailButtonManager';

const { ccclass, property } = _decorator;

/**
 * 交互区域定义接口
 */
interface InteractionZone {
    name: string;
    bounds: { x: number, y: number, width: number, height: number }; // 相对坐标(0-1)
    priority: number; // 优先级，数值越高优先级越高
    defaultInteraction: string; // 默认交互类型
    allowedInteractions: string[]; // 允许的交互类型
}

/**
 * 交互管理器
 * 负责实现具体的交互功能逻辑，包括：
 * 1. 相机拖拽移动
 * 2. 建筑拖拽和重放置
 * 3. 地块选择和框选
 * 4. 点击交互处理
 * 5. 边界自动移图
 */
@ccclass('InteractionManager')
export class InteractionManager extends Component {
    @property({ tooltip: '相机节点' })
    cameraNode: Node = null;
    
    @property({ type: TileSelectionManager, tooltip: '地块选择管理器' })
    tileSelectionManager: TileSelectionManager = null;
    
    @property({ type: BuildingPlacer, tooltip: '建筑放置器' })
    buildingPlacer: BuildingPlacer = null;
    
    @property({ type: TileOccupancyManager, tooltip: '地块占用管理器' })
    tileOccupancyManager: TileOccupancyManager = null;
    
    // 动态建筑栏管理器现在通过PlayerOperationState管理
    
    // InteractionControl引用，用于区域检测
    private interactionControl: any = null;
    
    @property({ type: BuildingDetailButtonManager, tooltip: '建筑详情按钮管理器' })
    buildingDetailButtonManager: BuildingDetailButtonManager = null;
    
    @property({ tooltip: '相机移动速度' })
    cameraMoveSpeed: number = 1.0;
    
    @property({ tooltip: '边界自动移图区域比例（0-1）' })
    edgeScrollZone: number = 0.1;
    
    @property({ tooltip: '边界自动移图速度' })
    edgeScrollSpeed: number = 200;
    
    @property({ tooltip: '点击检测阈值（像素）' })
    clickThreshold: number = 10;
    
    // 私有变量
    private camera: Camera = null;
    private isMapDragging: boolean = false;
    private isBuildingDragging: boolean = false;
    private edgeScrollTimer: number = 0;
    private lastTouchPos: Vec2 = new Vec2();
    
    // 交互区域划分
    private interactionZones: Map<string, InteractionZone> = new Map();
    
    /**
     * 交互区域初始化
     */
    private initializeInteractionZones() {
        // 建筑面板区域（屏幕底部）
        this.interactionZones.set('buildPanel', {
            name: 'buildPanel',
            bounds: { x: 0, y: 0, width: 1, height: 0.15 }, // 相对坐标
            priority: 10,
            defaultInteraction: 'building',
            allowedInteractions: ['building', 'ui']
        });
        
        // 主游戏区域（屏幕中央大部分）
        this.interactionZones.set('gameArea', {
            name: 'gameArea',
            bounds: { x: 0, y: 0.15, width: 1, height: 0.75 },
            priority: 5,
            defaultInteraction: 'map',
            allowedInteractions: ['map', 'building', 'tile']
        });
        
        // UI控制区域（屏幕顶部）
        this.interactionZones.set('uiArea', {
            name: 'uiArea',
            bounds: { x: 0, y: 0.9, width: 1, height: 0.1 },
            priority: 8,
            defaultInteraction: 'ui',
            allowedInteractions: ['ui']
        });
    }
    private touchStartPos: Vec2 = new Vec2(); // 触摸开始位置
    private totalMoveDistance: number = 0; // 总移动距离
    
    start() {
        this.initializeCamera();
        this.initializeInteractionZones();
        this.setupOperationStateListener();
        
        // 获取InteractionControl组件引用
        this.interactionControl = this.getComponent('InteractionControl');
        if (!this.interactionControl) {
            console.log('[InteractionManager] 未找到InteractionControl组件');
        }
        
        console.log('InteractionManager 初始化完成');
    }
    
    /**
     * 初始化相机
     */
    private initializeCamera() {
        if (this.cameraNode) {
            this.camera = this.cameraNode.getComponent(Camera);
        } else {
            // 自动查找相机
            const cameraComponent = this.node.scene.getComponentInChildren(Camera);
            if (cameraComponent) {
                this.camera = cameraComponent;
                this.cameraNode = this.camera.node;
            }
        }
        
        if (!this.camera) {
            console.error('未找到相机，交互功能可能无法正常工作');
        } else {
            console.log('相机初始化成功:', this.camera.node.name);
        }
    }
    

    
    /**
     * 设置操作状态监听器
     */
    private setupOperationStateListener() {
        PlayerOperationState.addListener('InteractionManager', (operation: PlayerOperationType) => {
            console.log(`InteractionManager 收到操作状态变更: ${operation}`);
        });
    }
    
    /**
     * 处理触摸开始事件（兼容性保留）
     */
    handleTouchStart(event: EventTouch) {
        // 获取UI坐标
        const touchPos = event.getUILocation();
        this.lastTouchPos.set(touchPos);
        
        console.log(`[InteractionManager] 触摸开始: (${touchPos.x.toFixed(1)}, ${touchPos.y.toFixed(1)})`);
        
        // 如果地块选择管理器存在且已启用，暂时禁用它
        if (this.tileSelectionManager) {
            this.tileSelectionManager.setEnabled(false);
        }
    }
    
    /**
     * 处理触摸移动事件（兼容性保留）
     */
    handleTouchMove(event: EventTouch, lastMousePos: Vec2) {
        // 获取UI坐标
        const touchPos = event.getUILocation();
        this.lastTouchPos.set(lastMousePos);
        
        // 处理地图拖拽
        if (this.isMapDragging && this.camera && PlayerOperationState.isCameraDragAllowed()) {
            this.updateMapDrag(touchPos, lastMousePos);
        } else if (this.isBuildingDragging) {
            this.updateBuildingDrag(event);
        }
    }
    
    /**
     * 处理触摸结束事件（兼容性保留）
     */
    handleTouchEnd(event: EventTouch, longPressTriggered: boolean) {
        // 停止地图拖拽
        if (this.isMapDragging) {
            this.stopMapDrag();
        }
        
        // 停止建筑拖拽
        if (this.isBuildingDragging) {
            this.stopBuildingDrag(event);
        }
        
        // 如果长按已触发且地块选择管理器存在，传递触摸结束事件
        if (longPressTriggered && this.tileSelectionManager) {
            // 这里可以直接调用地块选择管理器的触摸结束方法
            // 但由于TileSelectionManager的方法是私有的，我们通过启用它来让它处理后续事件
        }
    }
    

    
    /**
     * 开始地图拖拽
     */
    startMapDrag() {
        if (!PlayerOperationState.isCameraDragAllowed()) {
            console.log('当前操作状态不允许地图拖拽');
            return;
        }
        this.isMapDragging = true;
        console.log('开始地图拖拽');
    }
    
    /**
     * 停止地图拖拽
     */
    private stopMapDrag() {
        this.isMapDragging = false;
        // 如果当前是相机拖拽状态，重置为空闲
        if (PlayerOperationState.isOperation(PlayerOperationType.CAMERA_DRAG)) {
            PlayerOperationState.resetToIdle();
        }
        console.log('停止地图拖拽');
    }
    
    /**
     * 更新地图拖拽
     */
    private updateMapDrag(currentPos: Vec2, lastPos: Vec2) {
        const deltaX = currentPos.x - lastPos.x;
        const deltaY = currentPos.y - lastPos.y;
        
        // 移动相机（注意方向相反，因为是拖动视图）
        const cameraPos = this.cameraNode.position;
        const newPos = new Vec3(
            cameraPos.x - deltaX * this.cameraMoveSpeed,
            cameraPos.y - deltaY * this.cameraMoveSpeed,
            cameraPos.z
        );
        this.cameraNode.setPosition(newPos);
    }
    
    /**
     * 开始建筑拖拽
     */
    startBuildingDrag(startPos: Vec2) {
        console.log('开始建筑拖拽，起始位置:', startPos.x, startPos.y);
        this.isBuildingDragging = true;
        this.lastTouchPos = startPos.clone();
        
        // 设置建筑放置状态
        PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT);
        
        // 这里可以添加建筑拖拽的初始化逻辑
        // 例如：检测起始位置是否有建筑，创建拖拽预览等
    }
    
    /**
     * 更新建筑拖拽
     */
    updateBuildingDrag(event: EventTouch) {
        if (!this.isBuildingDragging) return;
        
        // 获取UI坐标
        const touchPos = event.getUILocation();
        // 更新触摸位置
        this.lastTouchPos = touchPos.clone();
        
        // 检查边界自动移图
        this.checkEdgeScroll(touchPos);
        
        // 委托给BuildingPlacer处理建筑拖拽移动
        if (this.buildingPlacer) {
            this.buildingPlacer.handleBuildingDragMove(event);
        }
        
        console.log('更新建筑拖拽位置', touchPos);
    }
    
    /**
     * 停止建筑拖拽
     */
    private stopBuildingDrag(event: EventTouch) {
        if (!this.isBuildingDragging) return;
        
        // 委托给BuildingPlacer处理建筑拖拽结束
        if (this.buildingPlacer) {
            this.buildingPlacer.handleBuildingDragEnd(event);
        }
        
        this.isBuildingDragging = false;
        this.edgeScrollTimer = 0;
        
        // 注意：不在这里重置操作状态，让BuildingPlacer来管理状态
        // BuildingPlacer会在适当的时候调用PlayerOperationState.resetToIdle()
        
        console.log('停止建筑拖拽');
    }
    
    /**
     * 处理点击交互
     */
    handleTap(tapPos: Vec2) {
        console.log(`[InteractionManager] 处理点击事件，位置: (${tapPos.x}, ${tapPos.y})`);
        
        // 检查当前操作状态
        const currentState = PlayerOperationState.getCurrentOperation();
        const canPlaceBuilding = PlayerOperationState.isBuildingPlacementAllowed();
        const canSelectTile = PlayerOperationState.isTileSelectionAllowed();
        
        console.log(`[InteractionManager] 当前状态: ${currentState}, 可放置建筑: ${canPlaceBuilding}, 可选择地块: ${canSelectTile}`);
        
        // 根据操作状态处理点击
        if (canPlaceBuilding) {
            // 建筑放置模式
            if (this.buildingPlacer) {
                const tileInfo = this.getTileAtScreenPos(tapPos);
                if (tileInfo) {
                    console.log(`[InteractionManager] 尝试在地块 (${tileInfo.row}, ${tileInfo.col}) 放置建筑`);
                    // 这里应该调用建筑放置逻辑
                    // this.buildingPlacer.placeBuildingAt(tileInfo.row, tileInfo.col);
                }
            }
        } else if (canSelectTile) {
            // 地块选择模式
            if (this.tileSelectionManager) {
                const tileInfo = this.getTileAtScreenPos(tapPos);
                if (tileInfo) {
                    console.log(`[InteractionManager] 选择地块 (${tileInfo.row}, ${tileInfo.col})`);
                    // this.tileSelectionManager.selectTile(tileInfo.row, tileInfo.col);
                }
            }
        } else {
            // 普通交互模式，首先检查是否在建筑栏区域内
            console.log('[InteractionManager] 普通交互模式，检查点击区域');
            
            // 检查是否在建筑栏区域内（通过InteractionControl检测）
            let isInBuildingBarArea = false;
            
            if (this.interactionControl && typeof this.interactionControl.isPointInBuildingBar === 'function') {
                isInBuildingBarArea = this.interactionControl.isPointInBuildingBar(tapPos);
            }
            
            if (isInBuildingBarArea) {
                // 在建筑栏区域内，只处理建筑栏相关逻辑
                console.log('[InteractionManager] 点击在建筑栏区域内，处理建筑栏触摸');
                const dynamicBuildingBarManager = PlayerOperationState.getDynamicBuildingBarManager();
                if (dynamicBuildingBarManager) {
                    const handled = dynamicBuildingBarManager.handleBuildingBarTouch(tapPos);
                    console.log(`[InteractionManager] 建筑栏处理结果: ${handled}`);
                }
                // 建筑栏区域内的点击不应该传递给地图处理
                return;
            }
            
            // 不在建筑栏区域内，处理地图区域的点击
            console.log('[InteractionManager] 点击不在建筑栏区域内，检查地图区域');
            const tileInfo = this.getTileAtScreenPos(tapPos);
            if (tileInfo && this.tileOccupancyManager) {
                const buildingInfo = this.tileOccupancyManager.getBuildingInfoAt(tileInfo.row, tileInfo.col);
                if (buildingInfo) {
                    console.log(`[InteractionManager] 点击了建筑: ${buildingInfo.buildingType} 在位置 (${tileInfo.row}, ${tileInfo.col})`);
                    // 处理建筑点击逻辑
                } else {
                    console.log(`[InteractionManager] 点击了空地块 (${tileInfo.row}, ${tileInfo.col})`);
                }
            }
        }
    }
    
    /**
     * 处理长按选择
     */
    handleLongPressSelection(event: EventTouch) {
        // 检测长按位置是地块还是建筑
        const uiPos = event.getUILocation();
        const tileInfo = this.getTileAtScreenPos(uiPos);
        
        if (tileInfo) {
            // 检查该地块是否有建筑
            const buildingInfo = this.tileOccupancyManager?.getBuildingInfoAt(tileInfo.row, tileInfo.col);
            
            if (buildingInfo) {
                // 长按位置有建筑，进入建筑移除重放置模式
                this.triggerBuildingRemoveAndReplace(tileInfo, buildingInfo);
            } else {
                // 长按位置是空地块，进入框选模式
                this.triggerTileSelection(event);
            }
        } else {
            console.log('长按位置无效，无法执行操作');
        }
    }
    
    /**
     * 触发地块框选模式
     */
    private triggerTileSelection(event: EventTouch) {
        if (!PlayerOperationState.isTileSelectionAllowed()) {
            console.log('当前操作状态不允许地块选择');
            return;
        }
        
        // 设置操作状态为地块选择
        PlayerOperationState.setCurrentOperation(PlayerOperationType.TILE_SELECTION);
        
        // 启用地块选择管理器
        if (this.tileSelectionManager) {
            this.tileSelectionManager.setEnabled(true);
            
            // 使用正确的方法启动地块选择
            this.tileSelectionManager.startTileSelection(event);
            
            console.log('启动地块选择');
        }
        
        console.log('长按触发，进入框选模式');
    }
    
    /**
     * 触发建筑移除重放置模式
     */
    private triggerBuildingRemoveAndReplace(tileInfo: {row: number, col: number}, buildingInfo: any) {
        if (!PlayerOperationState.isBuildingPlacementAllowed()) {
            console.log('当前操作状态不允许建筑操作');
            return;
        }
        
        console.log(`长按触发，移除建筑: ${buildingInfo.buildingType} 位置(${tileInfo.row}, ${tileInfo.col})`);
        
        // 移除建筑但不销毁节点
        if (this.tileOccupancyManager) {
            const buildingNode = this.tileOccupancyManager.removeBuilding(tileInfo.row, tileInfo.col, false);
            if (buildingNode) {
                console.log('建筑取出成功，准备重新放置');
                
                // 启动建筑重新放置，传递原建筑节点（位置信息从BuildInfo中读取）
                this.startBuildingReplacement(buildingInfo.buildingType, buildingNode);
            } else {
                console.log('建筑取出失败');
            }
        }
    }
    
    /**
     * 开始建筑重新放置
     */
    private startBuildingReplacement(buildingType: string, buildingNode?: Node) {
        if (!this.buildingPlacer) {
            console.warn('BuildingPlacer未设置，无法启动建筑重放置');
            return;
        }
        
        if (!buildingNode) {
            console.warn('缺少建筑节点，无法启动重新放置');
            return;
        }
        
        // 获取建筑节点的BuildInfo组件
        const buildInfo = buildingNode.getComponent(BuildInfo);
        if (!buildInfo) {
            console.warn('建筑节点缺少BuildInfo组件，无法重新放置');
            return;
        }
        
        // 从BuildInfo中读取上一次位置信息，用于重新放置
        const previousPosition = buildInfo.getPreviousPosition();
        let positionToUse;
        if (!previousPosition) {
            console.warn('BuildInfo中没有存储上一次位置信息，使用当前位置');
            const currentPosition = buildInfo.getCurrentPosition();
            if (!currentPosition) {
                console.warn('BuildInfo中没有存储位置信息，无法重新放置');
                return;
            }
            positionToUse = currentPosition;
        } else {
            positionToUse = previousPosition;
        }
        
        console.log(`从BuildInfo读取到锚点位置: (${positionToUse.row}, ${positionToUse.col})`);
        
        // 传递BuildInfo给BuildingPlacer，并提供重新放置的节点和失败回调
        this.buildingPlacer.setBuildingInfo(buildInfo, () => {
            console.log(`建筑重新放置完成: ${buildingType}`);
        }, buildingNode, {
            originalTileInfo: positionToUse, // 使用从BuildInfo读取的位置
            buildInfo: buildInfo
        });
        
        // 设置操作状态为建筑放置
        PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT, {
            buildingType: buildingType
        });
        
        console.log(`开始重新放置建筑: ${buildingType}`);
    }
    
    /**
     * 获取屏幕位置对应的地块信息
     */
    private getTileAtScreenPos(screenPos: Vec2): { row: number, col: number } | null {
        if (!this.camera || !this.tileOccupancyManager) {
            return null;
        }
        
        // 使用TileOccupancyManager的私有方法（通过反射访问）
        try {
            return (this.tileOccupancyManager as any).getTileAtScreenPos(screenPos, this.camera);
        } catch (error) {
            console.warn('无法获取地块信息:', error);
            return null;
        }
    }
    
    /**
     * 处理建筑点击事件
     */
    private handleBuildingClick(screenPos: Vec2) {
        if (!this.tileOccupancyManager || !this.camera) {
            return;
        }
        
        // 获取点击位置的地块坐标
        const tilePos = this.tileOccupancyManager.getTileInfoAtScreenPos(screenPos, this.camera);
        if (!tilePos) {
            console.log('未找到对应的地块');
            return;
        }
        
        // 获取该地块的建筑信息
        const buildingInfo = this.tileOccupancyManager.getBuildingInfoAt(tilePos.row, tilePos.col);
        
        // 将屏幕坐标转换为世界坐标
        const worldPos = this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
        
        if (buildingInfo && buildingInfo.buildingNode) {
            console.log('[InteractionManager] 点击了建筑:', buildingInfo.buildingNode.name);
            
            // 调用TileOccupancyManager的handleBuildingClick方法
            this.tileOccupancyManager.handleBuildingClick(buildingInfo.buildingNode, worldPos);
        } else {
            console.log('[InteractionManager] 点击的地块没有建筑');
            
            // 点击空白处，调用TileOccupancyManager的handleBuildingClick方法
            this.tileOccupancyManager.handleBuildingClick(null, worldPos);
        }
    }

    
    /**
     * 设置地块选择管理器
     */
    setTileSelectionManager(manager: TileSelectionManager) {
        this.tileSelectionManager = manager;
    }
    
    /**
     * 设置建筑放置器
     */
    setBuildingPlacer(placer: BuildingPlacer) {
        this.buildingPlacer = placer;
    }
    
    /**
     * 设置地块占用管理器
     */
    setTileOccupancyManager(manager: TileOccupancyManager) {
        this.tileOccupancyManager = manager;
    }
    
    /**
     * 设置相机移动速度
     */
    setCameraMoveSpeed(speed: number) {
        this.cameraMoveSpeed = Math.max(0.1, speed);
    }
    
    /**
     * 检查边界自动移图
     */
    private checkEdgeScroll(touchPos: Vec2) {
        if (!this.camera) return;
        
        // 获取屏幕尺寸
        const screenSize = view.getVisibleSize();
        
        const edgeZoneWidth = screenSize.width * this.edgeScrollZone;
        const edgeZoneHeight = screenSize.height * this.edgeScrollZone;
        
        let scrollDirection = new Vec2(0, 0);
        
        // 检查左右边界
        if (touchPos.x < edgeZoneWidth) {
            scrollDirection.x = -1; // 向左滚动
        } else if (touchPos.x > screenSize.width - edgeZoneWidth) {
            scrollDirection.x = 1; // 向右滚动
        }
        
        // 检查上下边界
        if (touchPos.y < edgeZoneHeight) {
            scrollDirection.y = -1; // 向下滚动
        } else if (touchPos.y > screenSize.height - edgeZoneHeight) {
            scrollDirection.y = 1; // 向上滚动
        }
        
        // 如果有滚动方向，启动边界滚动
        if (scrollDirection.x !== 0 || scrollDirection.y !== 0) {
            this.startEdgeScroll(scrollDirection, touchPos);
        } else {
            this.stopEdgeScroll();
        }
    }
    
    /**
     * 开始边界自动移图
     */
    private startEdgeScroll(direction: Vec2, touchPos: Vec2) {
        // 计算距离边界的距离，距离越近速度越快
        const screenSize = view.getVisibleSize();
        
        let speedMultiplier = 1.0;
        
        if (direction.x !== 0) {
            const distanceFromEdge = direction.x > 0 ? 
                (screenSize.width - touchPos.x) : touchPos.x;
            const edgeZone = screenSize.width * this.edgeScrollZone;
            speedMultiplier = Math.max(0.2, 1.0 - (distanceFromEdge / edgeZone));
        }
        
        if (direction.y !== 0) {
            const distanceFromEdge = direction.y > 0 ? 
                (screenSize.height - touchPos.y) : touchPos.y;
            const edgeZone = screenSize.height * this.edgeScrollZone;
            speedMultiplier = Math.max(speedMultiplier, Math.max(0.2, 1.0 - (distanceFromEdge / edgeZone)));
        }
        
        // 移动相机
        const currentPos = this.cameraNode.position;
        const moveDistance = this.edgeScrollSpeed * speedMultiplier * 0.016; // 假设60fps
        
        const newPos = new Vec3(
            currentPos.x + direction.x * moveDistance,
            currentPos.y + direction.y * moveDistance,
            currentPos.z
        );
        
        this.cameraNode.setPosition(newPos);
    }
    
    /**
     * 停止边界自动移图
     */
    private stopEdgeScroll() {
        this.edgeScrollTimer = 0;
    }
    
    /**
     * 更新方法（处理边界滚动等持续性操作）
     */
    update(deltaTime: number) {
        // 这里可以添加需要持续更新的逻辑
        // 例如：平滑的边界滚动、动画效果等
    }
    
    /**
     * 获取当前是否正在拖拽地图
     */
    getIsMapDragging(): boolean {
        return this.isMapDragging;
    }
    
    /**
     * 获取当前是否正在拖拽建筑
     */
    isBuildingDraggingActive(): boolean {
        return this.isBuildingDragging;
    }
    
    /**
     * 检查指定位置是否有建筑
     * @param screenPos 屏幕坐标位置
     * @returns 是否有建筑可以拖拽
     */
    checkBuildingAtPosition(screenPos: Vec2): boolean {
        console.log('检测方法触发，检查指定位置是否有建筑:', screenPos);
        // 1. 检查建筑栏区域是否有建筑，如果有则直接处理触摸
        const dynamicBuildingBarManager = PlayerOperationState.getDynamicBuildingBarManager();
        if (dynamicBuildingBarManager) {
            const handled = dynamicBuildingBarManager.handleBuildingBarTouch(screenPos);
            if (handled) {
                console.log('检测到建筑栏中的建筑点击，已处理触摸事件');
                return true;
            }
        }
        
        // 2. 检查地图上是否有建筑
        const tileInfo = this.getTileAtScreenPos(screenPos);
        if (tileInfo && this.tileOccupancyManager) {
            const buildingInfo = this.tileOccupancyManager.getBuildingInfoAt(tileInfo.row, tileInfo.col);
            if (buildingInfo) {
                console.log('检测到地图上的建筑点击:', buildingInfo.buildingType);
                return true;
            }
        }
        
        // 3. 检查当前是否有建筑正在放置状态
        if (this.buildingPlacer && this.buildingPlacer.getCurrentBuildInfo()) {
            console.log('检测到建筑放置器中有待放置的建筑');
            return true;
        }
        
        console.log('指定位置没有检测到建筑');
        return false;
    }
    
    /**
     * 获取屏幕位置对应的交互区域
     */
    private getInteractionZoneAt(screenPos: Vec2): InteractionZone | null {
        if (!this.camera) return null;
        
        // 获取屏幕尺寸
        const screenSize = view.getVisibleSize();
        
        // 转换为相对坐标
        const relativeX = screenPos.x / screenSize.width;
        const relativeY = screenPos.y / screenSize.height;
        
        // 查找匹配的区域，按优先级排序
        const zones = Array.from(this.interactionZones.values())
            .filter(zone => {
                const bounds = zone.bounds;
                return relativeX >= bounds.x && relativeX <= bounds.x + bounds.width &&
                       relativeY >= bounds.y && relativeY <= bounds.y + bounds.height;
            })
            .sort((a, b) => b.priority - a.priority);
        
        return zones.length > 0 ? zones[0] : null;
    }
    
    /**
     * 检查指定位置是否允许特定交互类型
     */
    private isInteractionAllowedAt(screenPos: Vec2, interactionType: string): boolean {
        const zone = this.getInteractionZoneAt(screenPos);
        if (!zone) return true; // 如果没有定义区域，默认允许
        
        return zone.allowedInteractions.indexOf(interactionType) !== -1;
    }
    
    /**
     * 获取指定位置的默认交互类型
     */
    private getDefaultInteractionAt(screenPos: Vec2): string {
        const zone = this.getInteractionZoneAt(screenPos);
        return zone ? zone.defaultInteraction : 'map';
    }
    

    
    onDestroy() {
        // 移除操作状态监听器
        PlayerOperationState.removeListener('InteractionManager');
    }
}