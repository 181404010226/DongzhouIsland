import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Vec3, Vec2, Prefab, instantiate, EventTouch, input, Input, Color, Camera } from 'cc';
import { ImprovedMapGenerator } from './ImprovedMapGenerator';
import { InteractionManager } from '../交互管理/InteractionManager';
import { BuildInfo } from './BuildInfo';
const { ccclass, property } = _decorator;

/**
 * 建筑放置器
 * 用于在地图上拖拽放置建筑预制体
 */
@ccclass('BuildingPlacer')
export class BuildingPlacer extends Component {
    @property({ type: [Node], tooltip: '包含BuildInfo组件的建筑节点数组' })
    buildingNodes: Node[] = [];
    
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
    private dragStartPos: Vec3 = new Vec3(); // 拖拽开始位置
    private currentBuildingIndex: number = -1; // 当前选中的建筑索引
    private activeBuildingNode: Node = null; // 当前激活的建筑节点
    
    // 地块占用管理系统
    private tileOccupancyMap: Map<string, {
        buildingId: string,
        buildingType: string,
        anchorRow: number,
        anchorCol: number,
        width: number,
        height: number
    }> = new Map(); // 使用"row_col"作为key
    
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
        if (this.currentBuildingIndex < 0 || this.currentBuildingIndex >= this.buildingNodes.length) {
            return;
        }
        
        const buildingNode = this.buildingNodes[this.currentBuildingIndex];
        const buildInfo = buildingNode.getComponent(BuildInfo);
        
        if (!buildInfo || !buildInfo.getBuildingPrefab()) {
            return;
        }
        
        // 直接实例化建筑预制体作为预览节点
        this.previewNode = instantiate(buildInfo.getBuildingPrefab());
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
               this.mapGenerator != null &&
               this.mainCamera != null;
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
        
        if (tileInfo && this.canPlaceBuildingAt(tileInfo.row, tileInfo.col)) {
            // 找到有效地块且可以放置建筑，显示预览并定位到地块中心
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
        if (!this.mapGenerator || this.currentBuildingIndex < 0) {
            console.warn('缺少必要组件或未选中建筑，无法放置建筑');
            return;
        }
        
        const buildInfo = this.activeBuildingNode.getComponent(BuildInfo);
        if (!buildInfo || !buildInfo.getBuildingPrefab()) {
            console.warn('当前建筑节点缺少BuildInfo组件或建筑预制体');
            return;
        }
        
        // 直接使用触摸位置获取地块
        // 参考TileSelectionManager的实现，直接检测触摸位置下的地块
        const tileInfo = this.getTileAtTouchPosition(touchPos);
        
        if (!tileInfo) {
            console.log('未找到有效地块，无法放置建筑');
            return;
        }
        
        // 检查是否可以放置建筑（包括多地块检查）
        if (!this.canPlaceBuildingAt(tileInfo.row, tileInfo.col)) {
            console.log(`无法在地块 (${tileInfo.row}, ${tileInfo.col}) 放置建筑，区域被占用或超出边界`);
            return;
        }
        
        // 放置建筑
        this.placeBuilding(tileInfo.tile, tileInfo.row, tileInfo.col, buildInfo);
    }
    
    /**
     * 在指定地块上放置建筑
     */
    private placeBuilding(tile: Node, row: number, col: number, buildInfo: BuildInfo) {
        if (!buildInfo.getBuildingPrefab()) {
            return;
        }
        
        // 生成唯一的建筑ID
        const buildingId = `Building_${row}_${col}_${buildInfo.getBuildingType()}_${Date.now()}`;
        
        // 实例化建筑预制体
        const buildingInstance = instantiate(buildInfo.getBuildingPrefab());
        buildingInstance.name = buildingId;
        
        // 将建筑放置在地块上
        buildingInstance.parent = tile;
        buildingInstance.setPosition(0, 0, 1); // 稍微抬高一点
        
        // 标记所有占用的地块
        this.markTilesAsOccupied(row, col, buildInfo, buildingId);
        
        console.log(`成功在地块 (${row}, ${col}) 放置建筑: ${buildInfo.getBuildingType()}`);
        
        // 触发建筑放置事件（可扩展）
        this.onBuildingPlaced(buildingInstance, row, col, buildInfo);
    }
    
    /**
     * 建筑放置完成回调
     */
    private onBuildingPlaced(building: Node, row: number, col: number, buildInfo: BuildInfo) {
        // 可以在这里添加建筑放置后的逻辑
        // 比如播放音效、更新UI、记录数据等
        console.log(`建筑放置完成: ${buildInfo.getBuildingType()} at (${row}, ${col})`);
    }
    
    /**
     * 移除指定地块上的建筑
     */
    public removeBuilding(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        const occupancyInfo = this.tileOccupancyMap.get(tileKey);
        
        if (!occupancyInfo) {
            console.log(`地块 (${row}, ${col}) 没有建筑可移除`);
            return false;
        }
        
        // 获取建筑的锚点地块
        const anchorTile = this.mapGenerator.getTileAt(occupancyInfo.anchorRow, occupancyInfo.anchorCol);
        if (!anchorTile) {
            console.warn(`未找到锚点地块 (${occupancyInfo.anchorRow}, ${occupancyInfo.anchorCol})`);
            return false;
        }
        
        // 查找并移除建筑节点
        const building = anchorTile.getChildByName(occupancyInfo.buildingId);
        
        if (building) {
            building.destroy();
            
            // 清除所有相关的占用标记
            this.clearTileOccupancyByBuildingId(occupancyInfo.buildingId);
            
            console.log(`成功移除建筑: ${occupancyInfo.buildingType} (${occupancyInfo.width}x${occupancyInfo.height})`);
            return true;
        }
        
        // 如果找不到建筑节点，但有占用记录，清除占用记录
        this.clearTileOccupancyByBuildingId(occupancyInfo.buildingId);
        console.warn(`建筑节点不存在，但已清除占用记录`);
        return false;
    }
    
    /**
     * 检查是否可以在指定位置放置建筑（考虑建筑尺寸）
     */
    private canPlaceBuildingAt(row: number, col: number): boolean {
        if (this.currentBuildingIndex < 0 || !this.activeBuildingNode) {
            return false;
        }
        
        const buildInfo = this.activeBuildingNode.getComponent(BuildInfo);
        if (!buildInfo) {
            return false;
        }
        
        const width = buildInfo.getBuildingWidth();
        const height = buildInfo.getBuildingHeight();
        
        // 检查所有需要占用的地块（从锚点左下角开始向左上方向）
        for (let r = row - height + 1; r <= row; r++) {
            for (let c = col - width + 1; c <= col; c++) {
                // 检查是否超出边界（索引小于0表示超出边界）
                if (r < 0 || c < 0) {
                    return false;
                }
                
                // 检查地块是否已被占用
                const tileKey = `${r}_${c}`;
                if (this.tileOccupancyMap.has(tileKey)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * 标记地块为已占用
     */
    private markTilesAsOccupied(anchorRow: number, anchorCol: number, buildInfo: BuildInfo, buildingId: string) {
        const width = buildInfo.getBuildingWidth();
        const height = buildInfo.getBuildingHeight();
        
        const occupancyInfo = {
            buildingId: buildingId,
            buildingType: buildInfo.getBuildingType(),
            anchorRow: anchorRow,
            anchorCol: anchorCol,
            width: width,
            height: height
        };
        
        // 标记所有占用的地块（从锚点左下角开始向左上方向）
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                const tileKey = `${r}_${c}`;
                this.tileOccupancyMap.set(tileKey, occupancyInfo);
            }
        }
    }
    
    /**
     * 清除地块占用标记
     */
    private clearTileOccupancy(anchorRow: number, anchorCol: number, width: number, height: number) {
        // 清除从锚点左下角开始向左上方向的占用地块
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                const tileKey = `${r}_${c}`;
                this.tileOccupancyMap.delete(tileKey);
            }
        }
    }
    
    /**
     * 根据建筑ID清除占用标记
     */
    private clearTileOccupancyByBuildingId(buildingId: string) {
        const keysToDelete: string[] = [];
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (occupancyInfo.buildingId === buildingId) {
                keysToDelete.push(tileKey);
            }
        }
        
        keysToDelete.forEach(key => {
            this.tileOccupancyMap.delete(key);
        });
    }
    
    /**
     * 检查指定地块是否已放置建筑
     * 使用新的占用管理系统
     */
    public isBuildingPlaced(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.has(tileKey);
    }
    
    /**
     * 获取所有已放置建筑的锚点坐标
     */
    public getPlacedBuildingPositions(): Array<{row: number, col: number, buildingType: string, width: number, height: number}> {
        const positions: Array<{row: number, col: number, buildingType: string, width: number, height: number}> = [];
        const processedBuildings = new Set<string>();
        
        // 遍历占用映射，只收集锚点位置
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (!processedBuildings.has(occupancyInfo.buildingId)) {
                positions.push({
                    row: occupancyInfo.anchorRow,
                    col: occupancyInfo.anchorCol,
                    buildingType: occupancyInfo.buildingType,
                    width: occupancyInfo.width,
                    height: occupancyInfo.height
                });
                processedBuildings.add(occupancyInfo.buildingId);
            }
        }
        
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
        
        // 确保清空占用映射
        this.tileOccupancyMap.clear();
        
        console.log('已清除所有建筑');
    }
    
    /**
     * 获取指定地块的建筑信息
     */
    public getBuildingInfoAt(row: number, col: number): {
        buildingId: string,
        buildingType: string,
        anchorRow: number,
        anchorCol: number,
        width: number,
        height: number
    } | null {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.get(tileKey) || null;
    }
    
    /**
     * 检查指定区域是否完全空闲
     */
    public isAreaFree(startRow: number, startCol: number, width: number, height: number): boolean {
        // 从锚点（左下角）开始，向左上方向检查区域
        for (let r = startRow - height + 1; r <= startRow; r++) {
            for (let c = startCol - width + 1; c <= startCol; c++) {
                // 检查是否超出边界（索引小于0表示超出边界）
                if (r < 0 || c < 0) {
                    return false;
                }
                
                // 检查地块是否已被占用
                if (this.isBuildingPlaced(r, c)) {
                    return false;
                }
            }
        }
        return true;
    }
    
    /**
     * 获取所有占用的地块坐标（包括非锚点）
     */
    public getAllOccupiedTiles(): Array<{row: number, col: number, buildingType: string}> {
        const tiles: Array<{row: number, col: number, buildingType: string}> = [];
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            const [row, col] = tileKey.split('_').map(Number);
            tiles.push({
                row: row,
                col: col,
                buildingType: occupancyInfo.buildingType
            });
        }
        
        return tiles;
    }
    
    /**
     * 获取占用统计信息
     */
    public getOccupancyStats(): {
        totalOccupiedTiles: number,
        totalBuildings: number,
        buildingTypeCount: Map<string, number>
    } {
        const buildingTypeCount = new Map<string, number>();
        const processedBuildings = new Set<string>();
        let totalBuildings = 0;
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (!processedBuildings.has(occupancyInfo.buildingId)) {
                totalBuildings++;
                const count = buildingTypeCount.get(occupancyInfo.buildingType) || 0;
                buildingTypeCount.set(occupancyInfo.buildingType, count + 1);
                processedBuildings.add(occupancyInfo.buildingId);
            }
        }
        
        return {
            totalOccupiedTiles: this.tileOccupancyMap.size,
            totalBuildings: totalBuildings,
            buildingTypeCount: buildingTypeCount
        };
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
            // 调整当前选中索引
            this.currentBuildingIndex--;
        }
        
        console.log(`移除建筑节点: ${node.name}`);
        return true;
    }
    
    /**
     * 获取建筑节点数组
     */
    public getBuildingNodes(): Node[] {
        return this.buildingNodes.slice(); // 返回副本
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
        const positions = this.getPlacedBuildingPositions();
        const buildingTypes: { [key: string]: number } = {};
        
        // 统计不同类型建筑的数量
        if (this.mapGenerator) {
            const allTiles = this.mapGenerator.getAllTiles();
            for (const tile of allTiles) {
                for (let i = 0; i < tile.children.length; i++) {
                    const child = tile.children[i];
                    if (child.name.startsWith('Building_')) {
                        // 从建筑名称中提取类型
                        const nameParts = child.name.split('_');
                        if (nameParts.length >= 4) {
                            const buildingType = nameParts.slice(3).join('_');
                            buildingTypes[buildingType] = (buildingTypes[buildingType] || 0) + 1;
                        }
                    }
                }
            }
        }
        
        return {
            totalPlaced: positions.length,
            positions: positions,
            buildingTypes: buildingTypes,
            availableBuildingNodes: this.buildingNodes.length,
            currentSelectedIndex: this.currentBuildingIndex
        };
    }
    
    /**
     * 获取可用的建筑类型列表
     */
    public getAvailableBuildingTypes(): Array<{index: number, name: string, type: string, enabled: boolean}> {
        const types: Array<{index: number, name: string, type: string, enabled: boolean}> = [];
        
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            const buildInfo = node.getComponent(BuildInfo);
            
            if (buildInfo) {
                types.push({
                    index: i,
                    name: node.name,
                    type: buildInfo.getBuildingType(),
                    enabled: buildInfo.isEnabled()
                });
            }
        }
        
        return types;
    }
    
    onDestroy() {
        // 移除事件监听
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        
        // 清理占用映射
        this.tileOccupancyMap.clear();
        
        // 清理预览节点
        if (this.previewNode) {
            this.previewNode.destroy();
            this.previewNode = null;
        }
    }
}