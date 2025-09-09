import { _decorator, Component, Node, Sprite, instantiate, Vec2, Vec3, UITransform, Camera, Color, CCString } from 'cc';
import { BuildInfo } from './BuildInfo';
import { ImprovedMapGenerator } from './ImprovedMapGenerator';
import { BuildingManager } from './BuildingManager';
import { BuildingDetailButtonManager} from '../UI面板/BuildingDetailButtonManager';
const { ccclass, property } = _decorator;


/**
 * 地块占用信息接口（从TileOccupancyManager复制，避免循环依赖）
 */
export interface TileOccupancyInfo {
    buildingId: string;
    buildingType: string;
    anchorRow: number;
    anchorCol: number;
    width: number;
    height: number;
    buildingNode: Node;
}

/**
 * 地块占用管理器
 * 用于管理地图上建筑的地块占用情况
 */
@ccclass('TileOccupancyManager')
export class TileOccupancyManager extends Component {
    @property({ type: ImprovedMapGenerator, tooltip: '地图生成器' })
    mapGenerator: ImprovedMapGenerator = null;
    
    @property({ type: BuildingDetailButtonManager, tooltip: '建筑详情按钮管理器' })
    buildingDetailButtonManager: BuildingDetailButtonManager | null = null;
    
    // 编辑器只读字段：已放置建筑节点索引
    @property({ type: [Node], readonly: true, tooltip: '当前已放置的建筑节点列表（编辑器查看）' })
    private readonly placedBuildingNodes: Node[] = [];
    
    // 编辑器只读字段：地块占用情况网格
    @property({ type: [CCString], readonly: true, tooltip: '地块占用情况网格（编辑器查看）' })
    private readonly tileOccupancyGrid: string[] = [];
    
    // 注意：建筑相邻关系信息现在显示在每个建筑自己的Inspector面板中
    

    // 地块占用映射表，使用"row_col"作为key
    private tileOccupancyMap: Map<string, TileOccupancyInfo> = new Map();
    
    /**
     * 检查是否可以在指定位置放置建筑（考虑建筑尺寸）
     */
    public canPlaceBuildingAt(row: number, col: number, width: number, height: number): boolean {
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
     * 核心放置函数：在指定行列位置放置建筑节点
     * 所有其他放置方法都应该调用此函数
     */
    private placeBuildingAtPosition(row: number, col: number, buildInfo: BuildInfo, buildingNode: Node): boolean {
        // 检查是否可以放置建筑
        if (!this.canPlaceBuildingAt(row, col, buildInfo.getBuildingWidth(), buildInfo.getBuildingHeight())) {
            return false;
        }
        
        // 获取地块节点
        const tileKey = `${row}_${col}`;
        const tile = this.getTileByKey(tileKey);
        if (!tile) {
            console.warn('找不到对应的地块节点');
            return false;
        }
        
        // 生成唯一的建筑ID
        const buildingId = `Building_${row}_${col}_${buildInfo.getBuildingType()}_${Date.now()}`;
        buildingNode.name = buildingId;
        
        // 确保节点有BuildInfo组件
        let instanceBuildInfo = buildingNode.getComponent(BuildInfo);
        if (!instanceBuildInfo) {
            instanceBuildInfo = buildingNode.addComponent(BuildInfo);
        }
        // 复制原始BuildInfo的数据
        instanceBuildInfo.copyFrom(buildInfo);
        
        // 设置建筑当前位置信息
        instanceBuildInfo.setCurrentPosition(row, col);
        
        // 将建筑放置在地块上
        buildingNode.parent = tile;
        buildingNode.setPosition(0, 0, 1); // 稍微抬高一点
        
        // 提前添加BuildingAdjacencyDisplay组件，确保在相邻信息更新时组件已存在
        // 遵循信息传递顺序：TileOccupancyManager → BuildingManager → BuildingAdjacencyDisplay
        BuildingManager.addAdjacencyDisplayToMapBuilding(buildingNode);
        
        // 标记所有占用的地块（这会触发相邻信息更新）
        this.markTilesAsOccupied(row, col, buildInfo, buildingId, buildingNode);
        
        // 建筑放置完成后不自动显示详情按钮
        // 详情按钮只有在点击建筑时才会显示
        
        return true;
    }
    
    /**
     * 标记地块为已占用
     */
    public markTilesAsOccupied(anchorRow: number, anchorCol: number, buildInfo: BuildInfo, buildingId: string, buildingNode: Node): void {
        const width = buildInfo.getBuildingWidth();
        const height = buildInfo.getBuildingHeight();
        
        const occupancyInfo: TileOccupancyInfo = {
            buildingId: buildingId,
            buildingType: buildInfo.getBuildingType(),
            anchorRow: anchorRow,
            anchorCol: anchorCol,
            width: width,
            height: height,
            buildingNode: buildingNode
        };
        
        // 标记所有占用的地块（从锚点左下角开始向左上方向）
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                const tileKey = `${r}_${c}`;
                this.tileOccupancyMap.set(tileKey, occupancyInfo);
            }
        }
        
        // 更新编辑器只读字段
        this.updateReadonlyFields();
    }
    
    
    /**
     * 更新编辑器只读字段
     */
    private updateReadonlyFields(): void {
        // 更新已放置建筑节点列表
        const buildingNodes = new Set<Node>();
        const occupancyGrid: string[] = [];
        
        // 收集所有唯一的建筑节点
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (occupancyInfo.buildingNode && occupancyInfo.buildingNode.isValid) {
                buildingNodes.add(occupancyInfo.buildingNode);
            }
            occupancyGrid.push(`${tileKey}: ${occupancyInfo.buildingType}`);
        }
        
        // 更新readonly数组（需要清空后重新填充）
        this.placedBuildingNodes.length = 0;
        this.placedBuildingNodes.push(...Array.from(buildingNodes));
        
        this.tileOccupancyGrid.length = 0;
        this.tileOccupancyGrid.push(...occupancyGrid.sort());
        
        // 更新建筑覆盖关系信息
        this.updateBuildingAdjacencyInfo();
    }
    
    /**
     * 更新建筑相邻关系信息
     */
    private updateBuildingAdjacencyInfo(): void {
        // 获取所有已放置的建筑
        const placedBuildings = this.getAllPlacedBuildings();
        

        
        // 获取地图尺寸
        const mapRows = this.mapGenerator.rows;
        const mapCols = this.mapGenerator.columns;
        
        for (const building of placedBuildings) {

            
            // 根据建筑尺寸计算检测圈层数
            const detectionRadius = BuildInfo.calculateDetectionRadius(
                building.buildingInfo.width,
                building.buildingInfo.height
            );
            
            const adjacencyResult = BuildingManager.getAdjacentBuildingsByInfo(
                building.row,
                building.col,
                building.buildingInfo.width,
                building.buildingInfo.height,
                mapRows,
                mapCols,
                this.tileOccupancyMap,
                placedBuildings,
                detectionRadius
            );
            
            // 格式化覆盖信息
            const coveredList: string[] = [];
            if (adjacencyResult.coveredBuildings.length > 0) {
                for (const info of adjacencyResult.coveredBuildings) {
                    coveredList.push(`建筑${info.buildingType}（${info.anchorRow},${info.anchorCol}）`);
                }
            } else {
                coveredList.push('无');
            }
            
            // 格式化被覆盖信息
            const coveringList: string[] = [];
            if (adjacencyResult.coveringBuildings.length > 0) {
                for (const info of adjacencyResult.coveringBuildings) {
                    coveringList.push(`建筑${info.buildingType}（${info.anchorRow},${info.anchorCol}）`);
                }
            } else {
                coveringList.push('无');
            }
            
            // 通过BuildingManager传递相邻关系信息和魅力值数据
            const currentBuildingNode = building.buildingInfo.buildingNode;
            if (currentBuildingNode && currentBuildingNode.isValid) {
                const buildInfo = currentBuildingNode.getComponent(BuildInfo);
                if (buildInfo) {
                    const baseCharmValue = buildInfo.getBaseCharmValue();
                    const buildingType = buildInfo.getBuildingType();
                    
                    // 传递相邻关系信息给BuildingManager
                    BuildingManager.updateBuildingAdjacencyInfo(
                        currentBuildingNode,
                        adjacencyResult,
                        coveredList,
                        coveringList,
                        building.buildingInfo.buildingType,
                        { row: building.row, col: building.col },
                        building.buildingInfo.width * building.buildingInfo.height,
                        adjacencyResult.coveredBuildings.length + adjacencyResult.coveringBuildings.length
                    );
                    
                    // 传递魅力值相关数据给BuildingManager，让BuildingManager调用魅力值计算系统
                    BuildingManager.updateBuildingCharmData(
                        currentBuildingNode,
                        {
                            baseCharmValue: baseCharmValue,
                            buildingType: buildingType,
                            coveredBuildings: adjacencyResult.coveredBuildings,
                            buildingId: building.buildingInfo.buildingId,
                            position: { row: building.row, col: building.col }
                        }
                    );
                }
            }
        }
    }
    
    /**
     * 根据建筑ID清除占用标记
     */
    public clearTileOccupancyByBuildingId(buildingId: string): void {
        const keysToDelete: string[] = [];
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (occupancyInfo.buildingId === buildingId) {
                keysToDelete.push(tileKey);
            }
        }
        
        keysToDelete.forEach(key => {
            this.tileOccupancyMap.delete(key);
        });
        
        // 更新编辑器只读字段
        this.updateReadonlyFields();
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
     * 清除所有占用标记
     */
    public clearAllOccupancy(): void {
        this.tileOccupancyMap.clear();
        // 更新编辑器只读字段
        this.updateReadonlyFields();
    }
    
    /**
     * 获取指定地块的建筑信息
     */
    public getBuildingInfoAt(row: number, col: number): TileOccupancyInfo | null {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.get(tileKey) || null;
    }
    
    
    /**
     * 移除指定地块上的建筑
     * @param row 行索引
     * @param col 列索引
     * @param destroyNode 是否销毁节点，默认为true
     * @returns 建筑节点或null
     */
    public removeBuilding(row: number, col: number, destroyNode: boolean = true): Node | null {
        const occupancyInfo = this.getBuildingInfoAt(row, col);
        
        if (!occupancyInfo) {
            return null;
        }
        
        // 直接使用存储的建筑节点引用
        if (occupancyInfo.buildingNode && occupancyInfo.buildingNode.isValid) {
            const buildingNode = occupancyInfo.buildingNode;
            
            // 清理建筑详情按钮
            if (this.buildingDetailButtonManager) {
                this.buildingDetailButtonManager.onBuildingClicked(null, new Vec3());
             }
            
            
            // 重置BuildInfo中的位置信息
            const buildInfo = buildingNode.getComponent(BuildInfo);
            if (buildInfo) {
                buildInfo.setCurrentPosition(-1, -1);
            }         
            
            // 通过BuildingManager清除魅力值计算系统中的记录
            BuildingManager.removeBuildingCharmValue(occupancyInfo.buildingId);
            
            // 清除所有相关的占用标记
            this.clearTileOccupancyByBuildingId(occupancyInfo.buildingId);
            
            if (destroyNode) {
                buildingNode.destroy();
                return null;
            } else {
                // 从父节点移除但不销毁
                buildingNode.removeFromParent();
                return buildingNode;
            }
        }
        
        // 如果建筑节点无效，清除占用记录
        this.clearTileOccupancyByBuildingId(occupancyInfo.buildingId);
        console.warn(`建筑节点无效，已清除占用记录`);
        return null;
    }
    
    /**
     * 清除所有已放置的建筑
     */
    public clearAllBuildings(): void {
        const positions = this.getPlacedBuildingPositions();
        
        positions.forEach(pos => {
            this.removeBuilding(pos.row, pos.col);
        });
        
        // 确保清空占用映射
        this.clearAllOccupancy();
        

    }
    
    
    /**
     * 创建预览节点
     */
    public createPreviewNode(buildInfo: BuildInfo): Node | null {
        if (!buildInfo || !buildInfo.getBuildingPrefab()) {
            return null;
        }
        
        // 直接实例化建筑预制体作为预览节点
        const previewNode = instantiate(buildInfo.getBuildingPrefab());
        previewNode.name = 'BuildingPreview';
        
        // 查找Sprite子节点并设置预览图片
        const spriteNode = previewNode.getChildByName('Sprite');
        if (spriteNode && buildInfo.getPreviewImage()) {
            const sprite = spriteNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = buildInfo.getPreviewImage();
            }
        }
        
        // 设置预览节点的透明度（递归设置所有Sprite组件）
        this.setNodeOpacity(previewNode, 150);
        
        return previewNode;
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
     * 尝试在屏幕位置放置建筑
     */
    public tryPlaceBuildingAtScreenPos(screenPos: Vec2, camera: Camera, buildInfo: BuildInfo, existingNode?: Node): boolean {
        if (!camera || !this.mapGenerator) {
            console.warn('缺少必要组件，无法放置建筑');
            return false;
        }
        
        // 获取地块信息
        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        
        if (!tileInfo) {
            return false;
        }
        
        // 放置建筑（使用现有节点或创建新节点）
        if (existingNode) {
            return this.placeBuildingAtPosition(tileInfo.row, tileInfo.col, buildInfo, existingNode);
        } else {
            // 需要创建新节点
            if (!buildInfo.getBuildingPrefab()) {
                console.warn('建筑预制体不存在，无法放置建筑');
                return false;
            }
            
            const buildingInstance = instantiate(buildInfo.getBuildingPrefab());
            
            // 查找Sprite子节点并设置预览图片
            const spriteNode = buildingInstance.getChildByName('Sprite');
            if (spriteNode && buildInfo.getPreviewImage()) {
                const sprite = spriteNode.getComponent(Sprite);
                if (sprite) {
                    sprite.spriteFrame = buildInfo.getPreviewImage();
                }
            }
            
            return this.placeBuildingAtPosition(tileInfo.row, tileInfo.col, buildInfo, buildingInstance);
        }
    }
    
    /**
     * 获取屏幕位置对应的地块索引
     */
    private getTileAtScreenPos(screenPos: Vec2, camera: Camera): { row: number, col: number } | null {
        if (!camera || !this.mapGenerator) {
            return null;
        }
        
        const worldPos = this.screenToWorldPos(screenPos, camera);
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
     */
    private screenToWorldPos(screenPos: Vec2, camera: Camera): Vec3 {
        if (!camera) {
            console.error('Camera not found for coordinate conversion');
            return new Vec3(0, 0, 0);
        }
        
        // 直接使用摄像机的screenToWorld方法转换屏幕坐标
        const worldPos = camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
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
     * 直接通过地块位置重新注册建筑占用信息
     */
    public reregisterBuildingAtPosition(row: number, col: number, buildInfo: BuildInfo, buildingNode: Node): boolean {
        // 调用统一的放置函数
        return this.placeBuildingAtPosition(row, col, buildInfo, buildingNode);
    }
    
    /**
     * 获取指定地块的建筑节点
     * @param row 行索引
     * @param col 列索引
     * @returns 建筑节点，如果没有建筑则返回null
     */
    public getBuildingNodeAt(row: number, col: number): Node | null {
        const tileKey = `${row}_${col}`;
        const occupancyInfo = this.tileOccupancyMap.get(tileKey);
        return occupancyInfo ? occupancyInfo.buildingNode : null;
    }
    
    /**
     * 获取屏幕位置对应的地块信息（公共方法）
     * @param screenPos 屏幕坐标
     * @param camera 相机组件
     * @returns 地块信息，如果无效则返回null
     */
    public getTileInfoAtScreenPos(screenPos: Vec2, camera: Camera): { row: number, col: number } | null {
        return this.getTileAtScreenPos(screenPos, camera);
    }
    
    /**
     * 获取所有已放置建筑的信息
     * @returns 建筑信息数组
     */
    public getAllPlacedBuildings(): Array<{row: number, col: number, buildingInfo: TileOccupancyInfo}> {
        const buildings: Array<{row: number, col: number, buildingInfo: TileOccupancyInfo}> = [];
        
        this.tileOccupancyMap.forEach((occupancyInfo, tileKey) => {
            // 只返回锚点地块的信息，避免重复
            if (occupancyInfo.anchorRow.toString() + '_' + occupancyInfo.anchorCol.toString() === tileKey) {
                buildings.push({
                    row: occupancyInfo.anchorRow,
                    col: occupancyInfo.anchorCol,
                    buildingInfo: occupancyInfo
                });
            }
        });
        
        return buildings;
    }
    
    /**
     * 检查指定地块是否被占用
     * @param row 行索引
     * @param col 列索引
     * @returns 是否被占用
     */
    public isTileOccupied(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.has(tileKey);
    }
    

    

}