import { _decorator, Component, Node, UITransform, Sprite, Vec3, Vec2, EventTouch, input, Input, Color, Camera } from 'cc';
import { BuildInfo } from './BuildInfo';
import { TileOccupancyManager } from './TileOccupancyManager';
import { PlayerOperationState, PlayerOperationType } from '../交互管理/PlayerOperationState';
const { ccclass, property } = _decorator;

/**
 * 建筑放置器
 * 专注于处理玩家交互，建筑管理委托给TileOccupancyManager
 */
@ccclass('BuildingPlacer')
export class BuildingPlacer extends Component {
    @property({ type: [Node], tooltip: '包含BuildInfo组件的建筑节点数组' })
    buildingNodes: Node[] = [];
    

    
    @property({ type: Camera, tooltip: '主相机' })
    mainCamera: Camera = null;
    
    @property({ type: TileOccupancyManager, tooltip: '地块占用管理器' })
    tileOccupancyManager: TileOccupancyManager = null;
    
    @property({ tooltip: '启用拖拽放置' })
    enableDragPlacement: boolean = true;
    
    // 私有变量
    private previewNode: Node = null; // 预览节点
    private isDragging: boolean = false; // 是否正在拖拽
    private dragStartPos: Vec3 = new Vec3(); // 拖拽开始位置
    private currentBuildingIndex: number = -1; // 当前选中的建筑索引
    private activeBuildingNode: Node = null; // 当前激活的建筑节点
    
    start() {
        this.setupInputEvents();
    }
    
    /**
     * 设置输入事件
     */
    private setupInputEvents() {
        if (!this.enableDragPlacement) {
            return;
        }
        
        // 监听触摸事件
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    
    /**
     * 创建预览节点
     */
    private createPreviewNode() {
        if (this.currentBuildingIndex < 0 || this.currentBuildingIndex >= this.buildingNodes.length) {
            return;
        }
        
        const buildingNode = this.buildingNodes[this.currentBuildingIndex];
        const buildInfo = buildingNode.getComponent(BuildInfo);
        
        if (!buildInfo || !buildInfo.getBuildingPrefab()) {
            return;
        }
        
        // 委托给TileOccupancyManager创建预览节点
        if (this.tileOccupancyManager) {
            this.previewNode = this.tileOccupancyManager.createPreviewNode(buildInfo);
            if (this.previewNode) {
                this.previewNode.active = false;
            }
        }
    }
    
    /**
     * 触摸开始事件
     */
    private onTouchStart(event: EventTouch) {
        if (!this.canStartDrag()) {
            return;
        }
        
        // 检查是否允许建筑放置操作
        if (!PlayerOperationState.isBuildingPlacementAllowed()) {
            return;
        }
        
        // 检查触摸点是否在任何建筑节点范围内
        const touchPos = event.getUILocation();
        const touchedNodeIndex = this.getTouchedBuildingNodeIndex(new Vec3(touchPos.x, touchPos.y, 0));
        
        if (touchedNodeIndex >= 0) {
            this.setCurrentBuilding(touchedNodeIndex);
            this.startDrag(new Vec3(touchPos.x, touchPos.y, 0));
        }
    }
    
    /**
     * 触摸移动事件
     */
    private onTouchMove(event: EventTouch) {
        if (!this.isDragging || !this.previewNode) {
            return;
        }
        
        const touchPos = event.getLocation();
        this.updatePreviewPosition(new Vec3(touchPos.x, touchPos.y, 0));
    }
    
    /**
     * 触摸结束事件
     */
    private onTouchEnd(event: EventTouch) {
        if (!this.isDragging) {
            return;
        }
        
        const touchPos = event.getLocation();
        this.endDrag(new Vec3(touchPos.x, touchPos.y, 0));
    }
    
    /**
     * 检查是否可以开始拖拽
     */
    private canStartDrag(): boolean {
        return this.enableDragPlacement && 
               this.buildingNodes.length > 0 && 
               this.tileOccupancyManager != null &&
               this.mainCamera != null &&
               PlayerOperationState.isBuildingPlacementAllowed();
    }
    
    /**
     * 获取触摸点对应的建筑节点索引
     */
    private getTouchedBuildingNodeIndex(touchPos: Vec3): number {
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            const buildInfo = node.getComponent(BuildInfo);
            
            if (!buildInfo || !buildInfo.isEnabled()) {
                continue;
            }
            
            const nodeTransform = node.getComponent(UITransform);
            if (nodeTransform && this.isPointInNode(touchPos, nodeTransform, node)) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * 设置当前选中的建筑
     */
    public setCurrentBuilding(index: number) {
        if (index < 0 || index >= this.buildingNodes.length) {
            this.currentBuildingIndex = -1;
            this.activeBuildingNode = null;
            return;
        }
        
        this.currentBuildingIndex = index;
        this.activeBuildingNode = this.buildingNodes[index];
        
        // 销毁旧的预览节点并创建新的
        if (this.previewNode) {
            this.previewNode.destroy();
            this.previewNode = null;
        }
        
        this.createPreviewNode();
        
        console.log(`选中建筑: ${this.activeBuildingNode.name}`);
    }
    
    /**
     * 检查点是否在节点范围内
     */
    private isPointInNode(point: Vec3, nodeTransform: UITransform, node: Node): boolean {
        const nodePos = node.getWorldPosition();
        const size = nodeTransform.contentSize;
        
        return point.x >= nodePos.x - size.width / 2 &&
               point.x <= nodePos.x + size.width / 2 &&
               point.y >= nodePos.y - size.height / 2 &&
               point.y <= nodePos.y + size.height / 2;
    }
    
    /**
     * 开始拖拽
     */
    private startDrag(touchPos: Vec3) {
        this.isDragging = true;
        this.dragStartPos = touchPos.clone();
        
        // 设置操作状态为建筑放置
        PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT, {
            buildingType: this.activeBuildingNode?.getComponent(BuildInfo)?.getBuildingType()
        });
        
        // 开始拖拽时更新预览位置
        if (this.previewNode) {
            this.updatePreviewPosition(touchPos);
        }
        
        console.log('开始拖拽建筑');
    }
    
    /**
     * 更新预览位置
     */
    private updatePreviewPosition(touchPos: Vec3) {
        if (!this.previewNode || !this.mainCamera || !this.tileOccupancyManager) {
            return;
        }
        
        // 委托给TileOccupancyManager处理预览位置更新
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        const buildInfo = this.activeBuildingNode?.getComponent(BuildInfo);
        
        if (buildInfo) {
            this.tileOccupancyManager.updatePreviewPosition(this.previewNode, screenPos, this.mainCamera, buildInfo);
        }
    }
    
    /**
     * 结束拖拽
     */
    private endDrag(touchPos: Vec3) {
        this.isDragging = false;
        
        // 重置操作状态为空闲
        PlayerOperationState.resetToIdle();
        
        // 隐藏预览节点
        if (this.previewNode) {
            this.previewNode.active = false;
            this.previewNode.parent = null;
        }
        
        // 尝试在地图上放置建筑
        this.tryPlaceBuilding(touchPos);
        
        console.log('结束拖拽建筑');
    }
    
    /**
     * 尝试在地图上放置建筑
     */
    private tryPlaceBuilding(touchPos: Vec3) {
        if (!this.tileOccupancyManager || this.currentBuildingIndex < 0) {
            console.warn('缺少必要组件或未选中建筑，无法放置建筑');
            return;
        }
        
        const buildInfo = this.activeBuildingNode?.getComponent(BuildInfo);
        if (!buildInfo || !buildInfo.getBuildingPrefab()) {
            console.warn('当前建筑节点缺少BuildInfo组件或建筑预制体');
            return;
        }
        
        // 委托给TileOccupancyManager处理建筑放置
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        const success = this.tileOccupancyManager.tryPlaceBuildingAtScreenPos(screenPos, this.mainCamera, buildInfo);
        
        if (success) {
            this.onBuildingPlaced(buildInfo);
        }
    }
    
    /**
     * 建筑放置完成回调
     */
    private onBuildingPlaced(buildInfo: BuildInfo) {
        console.log(`建筑放置完成: ${buildInfo.getBuildingType()}`);
    }
    
    /**
     * 移除指定地块上的建筑
     */
    public removeBuilding(row: number, col: number): boolean {
        if (!this.tileOccupancyManager) {
            console.warn('TileOccupancyManager未设置，无法移除建筑');
            return false;
        }
        
        return this.tileOccupancyManager.removeBuilding(row, col);
    }
    
    /**
     * 清除所有已放置的建筑
     */
    public clearAllBuildings() {
        if (!this.tileOccupancyManager) {
            console.warn('TileOccupancyManager未设置，无法清除建筑');
            return;
        }
        
        this.tileOccupancyManager.clearAllBuildings();
    }
    
    /**
     * 添加建筑节点
     */
    public addBuildingNode(node: Node): boolean {
        if (!node || !node.getComponent(BuildInfo)) {
            console.warn('节点必须包含BuildInfo组件');
            return false;
        }
        
        if (this.buildingNodes.indexOf(node) >= 0) {
            console.warn('节点已存在于数组中');
            return false;
        }
        
        this.buildingNodes.push(node);
        console.log(`添加建筑节点: ${node.name}`);
        return true;
    }
    
    /**
     * 移除建筑节点
     */
    public removeBuildingNode(node: Node): boolean {
        const index = this.buildingNodes.indexOf(node);
        if (index < 0) {
            console.warn('节点不存在于数组中');
            return false;
        }
        
        this.buildingNodes.splice(index, 1);
        
        // 如果移除的是当前选中的节点，重置选择
        if (this.currentBuildingIndex === index) {
            this.currentBuildingIndex = -1;
            this.activeBuildingNode = null;
            
            if (this.previewNode) {
                this.previewNode.destroy();
                this.previewNode = null;
            }
        } else if (this.currentBuildingIndex > index) {
            this.currentBuildingIndex--;
        }
        
        console.log(`移除建筑节点: ${node.name}`);
        return true;
    }
    
    /**
     * 获取建筑节点数组
     */
    public getBuildingNodes(): Node[] {
        return this.buildingNodes.slice();
    }
    
    /**
     * 获取当前选中的建筑索引
     */
    public getCurrentBuildingIndex(): number {
        return this.currentBuildingIndex;
    }
    
    /**
     * 获取当前激活的建筑节点
     */
    public getActiveBuildingNode(): Node | null {
        return this.activeBuildingNode;
    }
    

    
    /**
     * 设置主相机
     */
    public setMainCamera(camera: Camera) {
        this.mainCamera = camera;
    }
    
    /**
     * 设置地块占用管理器
     */
    public setTileOccupancyManager(manager: TileOccupancyManager) {
        this.tileOccupancyManager = manager;
    }
    
    /**
     * 设置拖拽放置功能开关
     */
    public setDragPlacementEnabled(enabled: boolean) {
        this.enableDragPlacement = enabled;
        
        if (!enabled && this.isDragging) {
            // 如果正在拖拽时禁用功能，结束当前拖拽
            this.isDragging = false;
            if (this.previewNode) {
                this.previewNode.active = false;
                this.previewNode.parent = null;
            }
            // 重置操作状态
            PlayerOperationState.resetToIdle();
        }
    }
    
    onDestroy() {
        // 清理输入事件监听
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        
        // 清理预览节点
        if (this.previewNode) {
            this.previewNode.destroy();
            this.previewNode = null;
        }
    }
}