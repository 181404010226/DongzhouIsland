import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Vec3, Vec2, Prefab, instantiate, EventTouch, input, Input, Color, Camera } from 'cc';
import { ImprovedMapGenerator } from './ImprovedMapGenerator';
import { InteractionManager } from '../交互管理/InteractionManager';
const { ccclass, property } = _decorator;

/**
 * 建筑放置器
 * 用于在地图上拖拽放置建筑预制体
 */
@ccclass('BuildingPlacer')
export class BuildingPlacer extends Component {
    @property({ type: SpriteFrame, tooltip: '建筑预览图片' })
    previewImage: SpriteFrame = null;
    
    @property({ type: Prefab, tooltip: '建筑预制体' })
    buildingPrefab: Prefab = null;
    
    @property({ type: ImprovedMapGenerator, tooltip: '地图生成器' })
    mapGenerator: ImprovedMapGenerator = null;
    
    @property({ type: InteractionManager, tooltip: '交互管理器' })
    interactionManager: InteractionManager = null;
    
    @property({ type: Camera, tooltip: '主相机' })
    mainCamera: Camera = null;
    
    @property({ tooltip: '启用拖拽放置' })
    enableDragPlacement: boolean = true;
    
    // 私有变量
    private previewNode: Node = null; // 预览节点
    private isDragging: boolean = false; // 是否正在拖拽
    private placedBuildings: Set<string> = new Set(); // 已放置建筑的地块标记
    private dragStartPos: Vec3 = new Vec3(); // 拖拽开始位置
    
    start() {
        this.setupInputEvents();
        this.createPreviewNode();
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
        if (!this.buildingPrefab) {
            return;
        }
        
        // 直接实例化建筑预制体作为预览节点
        this.previewNode = instantiate(this.buildingPrefab);
        this.previewNode.name = 'BuildingPreview';
        
        // 初始时隐藏预览节点，不设置父节点
        this.previewNode.active = false;
        
        // 设置预览节点的透明度（递归设置所有Sprite组件）
        this.setNodeOpacity(this.previewNode, 150);
    }
    
    /**
     * 递归设置节点及其子节点的透明度
     */
    private setNodeOpacity(node: Node, opacity: number) {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const color = sprite.color.clone();
            sprite.color = new Color(color.r, color.g, color.b, opacity);
        }
        
        // 递归设置子节点透明度
        for (let i = 0; i < node.children.length; i++) {
            this.setNodeOpacity(node.children[i], opacity);
        }
    }
    
    /**
     * 触摸开始事件
     */
    private onTouchStart(event: EventTouch) {
        if (!this.canStartDrag()) {
            return;
        }
        
        // 检查触摸点是否在当前节点范围内
        const touchPos = event.getUILocation();
        const nodeTransform = this.node.getComponent(UITransform);
        
        if (nodeTransform && this.isPointInNode(new Vec3(touchPos.x, touchPos.y, 0), nodeTransform)) {
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
               this.buildingPrefab != null && 
               this.mapGenerator != null &&
               this.mainCamera != null;
    }
    
    /**
     * 检查点是否在节点范围内
     */
    private isPointInNode(point: Vec3, nodeTransform: UITransform): boolean {
        const nodePos = this.node.getWorldPosition();
        const size = nodeTransform.contentSize;
        
        return point.x >= nodePos.x - size.width / 2 &&
               point.x <= nodePos.x + size.width / 2 &&
               point.y >= nodePos.y - size.height / 2 &&
               point.y <= nodePos.y + size.height / 2;
    }
    
    /**
     * 获取屏幕位置对应的地块索引
     * 完全参考TileSelectionManager的实现
     */
    private getTileAtScreenPos(screenPos: Vec2): { row: number, col: number } | null {
        if (!this.mainCamera || !this.mapGenerator) {
            return null;
        }
        
        const worldPos = this.screenToWorldPos(screenPos);
        const allTiles = this.mapGenerator.getAllTiles();
        
        // 遍历所有地块，使用UITransform的检测方法
        for (const tile of allTiles) {
            const tileTransform = tile.getComponent(UITransform);
            if (!tileTransform) continue;
            
            // 将世界坐标转换为地块的本地坐标进行检测
            const localPos = tile.getComponent(UITransform).convertToNodeSpaceAR(worldPos);
            
            // 检查是否在UITransform的矩形范围内（本地坐标系）
            const halfWidth = tileTransform.width * 0.5;
            const halfHeight = tileTransform.height * 0.5;
            
            if (Math.abs(localPos.x) <= halfWidth && Math.abs(localPos.y) <= halfHeight) {
                // 解析地块名称获取索引
                const tileName = tile.name;
                const match = tileName.match(/Tile_(\d+)_(\d+)/);
                if (match) {
                    const i = parseInt(match[1]);
                    const j = parseInt(match[2]);
                    return { row: i, col: j };
                }
            }
        }
        
        return null;
    }
    
    /**
     * 屏幕坐标转世界坐标
     * 参考TileSelectionManager的实现
     */
    private screenToWorldPos(screenPos: Vec2): Vec3 {
        if (!this.mainCamera) {
            console.error('Camera not found for coordinate conversion');
            return new Vec3(0, 0, 0);
        }
        
        // 直接使用摄像机的screenToWorld方法转换屏幕坐标
        const worldPos = this.mainCamera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
        return worldPos;
    }
    
    /**
     * 根据地块键值获取地块节点
     */
    private getTileByKey(tileKey: string): Node | null {
        if (!this.mapGenerator) {
            return null;
        }
        
        const allTiles = this.mapGenerator.getAllTiles();
        for (const tile of allTiles) {
            const tileName = tile.name;
            const match = tileName.match(/Tile_(\d+)_(\d+)/);
            if (match) {
                const row = parseInt(match[1]);
                const col = parseInt(match[2]);
                const key = `${row}_${col}`;
                if (key === tileKey) {
                    return tile;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 获取触摸位置对应的地块（保留原方法名以兼容其他调用）
     */
    private getTileAtTouchPosition(touchPos: Vec3): { tile: Node, row: number, col: number } | null {
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        const tileInfo = this.getTileAtScreenPos(screenPos);
        
        if (tileInfo) {
            const tileKey = `${tileInfo.row}_${tileInfo.col}`;
            const tile = this.getTileByKey(tileKey);
            if (tile) {
                return { tile, row: tileInfo.row, col: tileInfo.col };
            }
        }
        
        return null;
    }
    
    /**
     * 开始拖拽
     */
    private startDrag(touchPos: Vec3) {
        this.isDragging = true;
        this.dragStartPos = touchPos.clone();
        
        // 禁用交互管理器的相机拖动功能
        if (this.interactionManager) {
            this.interactionManager.setCameraDragEnabled(false);
        }
        
        // 开始拖拽时更新预览位置
        if (this.previewNode) {
            this.updatePreviewPosition(touchPos);
        }
        
        console.log('开始拖拽建筑');
    }
    
    /**
     * 更新预览位置
     * 参考TileSelectionManager的地块选择方式
     */
    private updatePreviewPosition(touchPos: Vec3) {
        if (!this.previewNode || !this.mainCamera) {
            return;
        }
        
        // 将屏幕坐标转换为Vec2格式
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        
        // 使用与TileSelectionManager相同的方式获取地块
        const tileInfo = this.getTileAtScreenPos(screenPos);
        
        if (tileInfo && !this.isBuildingPlaced(tileInfo.row, tileInfo.col)) {
            // 找到有效地块且未放置建筑，显示预览并定位到地块中心
            this.previewNode.active = true;
            
            // 将预览节点放置在地块上
            const tileKey = `${tileInfo.row}_${tileInfo.col}`;
            const tile = this.getTileByKey(tileKey);
            if (tile) {
                // 将预览节点的父节点设置为地块，并居中显示
                this.previewNode.parent = tile;
                this.previewNode.setPosition(0, 0, 1); // 稍微抬高一点
            }
        } else {
            // 没有找到有效地块或地块已被占用，隐藏预览
            this.previewNode.active = false;
        }
    }
    
    /**
     * 结束拖拽
     */
    private endDrag(touchPos: Vec3) {
        this.isDragging = false;
        
        // 重新启用交互管理器的相机拖动功能
        if (this.interactionManager) {
            this.interactionManager.setCameraDragEnabled(true);
        }
        
        // 隐藏预览节点并移除父节点关系
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
        if (!this.mapGenerator || !this.buildingPrefab) {
            console.warn('缺少必要组件，无法放置建筑');
            return;
        }
        
        // 直接使用触摸位置获取地块
        // 参考TileSelectionManager的实现，直接检测触摸位置下的地块
        const tileInfo = this.getTileAtTouchPosition(touchPos);
        
        if (!tileInfo) {
            console.log('未找到有效地块，无法放置建筑');
            return;
        }
        
        // 检查该地块是否已经放置了建筑
        const tileKey = `${tileInfo.row}_${tileInfo.col}`;
        if (this.placedBuildings.has(tileKey)) {
            console.log(`地块 (${tileInfo.row}, ${tileInfo.col}) 已经放置了建筑`);
            return;
        }
        
        // 放置建筑
        this.placeBuilding(tileInfo.tile, tileInfo.row, tileInfo.col);
    }
    
    /**
     * 在指定地块上放置建筑
     */
    private placeBuilding(tile: Node, row: number, col: number) {
        if (!this.buildingPrefab) {
            return;
        }
        
        // 实例化建筑预制体
        const buildingInstance = instantiate(this.buildingPrefab);
        buildingInstance.name = `Building_${row}_${col}`;
        
        // 将建筑放置在地块上
        buildingInstance.parent = tile;
        buildingInstance.setPosition(0, 0, 1); // 稍微抬高一点
        
        // 标记该地块已放置建筑
        const tileKey = `${row}_${col}`;
        this.placedBuildings.add(tileKey);
        
        console.log(`成功在地块 (${row}, ${col}) 放置建筑`);
        
        // 触发建筑放置事件（可扩展）
        this.onBuildingPlaced(buildingInstance, row, col);
    }
    
    /**
     * 建筑放置完成回调
     */
    private onBuildingPlaced(building: Node, row: number, col: number) {
        // 可以在这里添加建筑放置后的逻辑
        // 比如播放音效、更新UI、记录数据等
    }
    
    /**
     * 移除指定地块上的建筑
     */
    public removeBuilding(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        
        if (!this.placedBuildings.has(tileKey)) {
            console.log(`地块 (${row}, ${col}) 没有建筑可移除`);
            return false;
        }
        
        // 获取地块节点
        const tile = this.mapGenerator.getTileAt(row, col);
        if (!tile) {
            console.warn(`未找到地块 (${row}, ${col})`);
            return false;
        }
        
        // 查找并移除建筑节点
        const buildingName = `Building_${row}_${col}`;
        const building = tile.getChildByName(buildingName);
        
        if (building) {
            building.destroy();
            this.placedBuildings.delete(tileKey);
            console.log(`成功移除地块 (${row}, ${col}) 上的建筑`);
            return true;
        }
        
        return false;
    }
    
    /**
     * 检查指定地块是否已放置建筑
     */
    public isBuildingPlaced(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        return this.placedBuildings.has(tileKey);
    }
    
    /**
     * 获取所有已放置建筑的地块坐标
     */
    public getPlacedBuildingPositions(): Array<{row: number, col: number}> {
        const positions: Array<{row: number, col: number}> = [];
        
        this.placedBuildings.forEach(tileKey => {
            const [row, col] = tileKey.split('_').map(Number);
            positions.push({ row, col });
        });
        
        return positions;
    }
    
    /**
     * 清除所有已放置的建筑
     */
    public clearAllBuildings() {
        const positions = this.getPlacedBuildingPositions();
        
        positions.forEach(pos => {
            this.removeBuilding(pos.row, pos.col);
        });
        
        console.log('已清除所有建筑');
    }
    
    /**
     * 设置预览图片
     */
    public setPreviewImage(spriteFrame: SpriteFrame) {
        this.previewImage = spriteFrame;
        // 注意：现在预览节点使用buildingPrefab，previewImage仅用于UI显示
    }
    
    /**
     * 设置建筑预制体
     */
    public setBuildingPrefab(prefab: Prefab) {
        this.buildingPrefab = prefab;
        
        // 销毁旧的预览节点
        if (this.previewNode) {
            this.previewNode.destroy();
            this.previewNode = null;
        }
        
        // 重新创建预览节点
        this.createPreviewNode();
    }
    
    /**
     * 设置地图生成器
     */
    public setMapGenerator(mapGen: ImprovedMapGenerator) {
        this.mapGenerator = mapGen;
    }
    
    /**
     * 设置交互管理器
     */
    public setInteractionManager(interactionMgr: InteractionManager) {
        this.interactionManager = interactionMgr;
    }
    
    /**
     * 设置主相机
     */
    public setMainCamera(camera: Camera) {
        this.mainCamera = camera;
    }
    
    /**
     * 启用/禁用拖拽放置功能
     */
    public setDragPlacementEnabled(enabled: boolean) {
        this.enableDragPlacement = enabled;
        
        if (enabled) {
            this.setupInputEvents();
        } else {
            // 移除事件监听
            input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }
    
    /**
     * 获取建筑放置统计信息
     */
    public getBuildingStats() {
        return {
            totalPlaced: this.placedBuildings.size,
            positions: this.getPlacedBuildingPositions()
        };
    }
    
    onDestroy() {
        // 清理事件监听
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }
}