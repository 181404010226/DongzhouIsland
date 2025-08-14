import { _decorator, Component, Node, Sprite, instantiate, Vec2, Vec3, UITransform, Camera, Color } from 'cc';
import { BuildInfo } from './BuildInfo';
import { ImprovedMapGenerator } from './ImprovedMapGenerator';
const { ccclass, property } = _decorator;

/**
 * 地块占用信息接口
 */
export interface TileOccupancyInfo {
    buildingId: string;
    buildingType: string;
    anchorRow: number;
    anchorCol: number;
    width: number;
    height: number;
}

/**
 * 地块占用管理器
 * 用于管理地图上建筑的地块占用情况
 */
@ccclass('TileOccupancyManager')
export class TileOccupancyManager extends Component {
    @property({ type: ImprovedMapGenerator, tooltip: '地图生成器' })
    mapGenerator: ImprovedMapGenerator = null;
    
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
     * 标记地块为已占用
     */
    public markTilesAsOccupied(anchorRow: number, anchorCol: number, buildInfo: BuildInfo, buildingId: string): void {
        const width = buildInfo.getBuildingWidth();
        const height = buildInfo.getBuildingHeight();
        
        const occupancyInfo: TileOccupancyInfo = {
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
    public clearTileOccupancy(anchorRow: number, anchorCol: number, width: number, height: number): void {
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
    }
    
    /**
     * 检查指定地块是否已放置建筑
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
     * 清除所有占用标记
     */
    public clearAllOccupancy(): void {
        this.tileOccupancyMap.clear();
        console.log('已清除所有地块占用标记');
    }
    
    /**
     * 获取指定地块的建筑信息
     */
    public getBuildingInfoAt(row: number, col: number): TileOccupancyInfo | null {
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
     * 获取占用映射的副本（用于调试或序列化）
     */
    public getOccupancyMapCopy(): Map<string, TileOccupancyInfo> {
        return new Map(this.tileOccupancyMap);
    }
    
    /**
     * 从占用映射副本恢复数据（用于反序列化）
     */
    public restoreFromOccupancyMap(occupancyMap: Map<string, TileOccupancyInfo>): void {
        this.tileOccupancyMap = new Map(occupancyMap);
    }
    
    /**
     * 在指定地块上放置建筑
     */
    public placeBuilding(tile: Node, row: number, col: number, buildInfo: BuildInfo): boolean {
        if (!buildInfo.getBuildingPrefab()) {
            console.warn('建筑预制体不存在，无法放置建筑');
            return false;
        }
        
        // 检查是否可以放置建筑
        if (!this.canPlaceBuildingAt(row, col, buildInfo.getBuildingWidth(), buildInfo.getBuildingHeight())) {
            console.log(`无法在地块 (${row}, ${col}) 放置建筑，区域被占用或超出边界`);
            return false;
        }
        
        // 生成唯一的建筑ID
        const buildingId = `Building_${row}_${col}_${buildInfo.getBuildingType()}_${Date.now()}`;
        
        // 实例化建筑预制体
        const buildingInstance = instantiate(buildInfo.getBuildingPrefab());
        buildingInstance.name = buildingId;
        
        // 查找Sprite子节点并设置预览图片
        const spriteNode = buildingInstance.getChildByName('Sprite');
        if (spriteNode && buildInfo.getPreviewImage()) {
            const sprite = spriteNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = buildInfo.getPreviewImage();
            }
        }
        
        // 将建筑放置在地块上
        buildingInstance.parent = tile;
        buildingInstance.setPosition(0, 0, 1); // 稍微抬高一点
        
        // 标记所有占用的地块
        this.markTilesAsOccupied(row, col, buildInfo, buildingId);
        
        console.log(`成功在地块 (${row}, ${col}) 放置建筑: ${buildInfo.getBuildingType()}`);
        return true;
    }
    
    /**
     * 移除指定地块上的建筑
     */
    public removeBuilding(row: number, col: number): boolean {
        const occupancyInfo = this.getBuildingInfoAt(row, col);
        
        if (!occupancyInfo) {
            console.log(`地块 (${row}, ${col}) 没有建筑可移除`);
            return false;
        }
        
        if (!this.mapGenerator) {
            console.warn('MapGenerator未设置，无法移除建筑');
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
     * 清除所有已放置的建筑
     */
    public clearAllBuildings(): void {
        const positions = this.getPlacedBuildingPositions();
        
        positions.forEach(pos => {
            this.removeBuilding(pos.row, pos.col);
        });
        
        // 确保清空占用映射
        this.clearAllOccupancy();
        
        console.log('已清除所有建筑');
    }
    
    /**
     * 设置地图生成器
     */
    public setMapGenerator(mapGen: ImprovedMapGenerator): void {
        this.mapGenerator = mapGen;
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
     * 更新预览位置
     */
    public updatePreviewPosition(previewNode: Node, screenPos: Vec2, camera: Camera, buildInfo: BuildInfo) {
        if (!previewNode || !camera || !this.mapGenerator) {
            return;
        }
        
        // 获取地块信息
        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        
        if (tileInfo && this.canPlaceBuildingAt(tileInfo.row, tileInfo.col, buildInfo.getBuildingWidth(), buildInfo.getBuildingHeight())) {
            // 找到有效地块且可以放置建筑，显示预览并定位到地块中心
            previewNode.active = true;
            
            // 将预览节点放置在地块上
            const tileKey = `${tileInfo.row}_${tileInfo.col}`;
            const tile = this.getTileByKey(tileKey);
            if (tile) {
                // 将预览节点的父节点设置为地块，并居中显示
                previewNode.parent = tile;
                previewNode.setPosition(0, 0, 1); // 稍微抬高一点
            }
        } else {
            // 没有找到有效地块或地块已被占用，隐藏预览
            previewNode.active = false;
        }
    }
    
    /**
     * 尝试在屏幕位置放置建筑
     */
    public tryPlaceBuildingAtScreenPos(screenPos: Vec2, camera: Camera, buildInfo: BuildInfo): boolean {
        if (!camera || !this.mapGenerator) {
            console.warn('缺少必要组件，无法放置建筑');
            return false;
        }
        
        // 获取地块信息
        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        
        if (!tileInfo) {
            console.log('未找到有效地块，无法放置建筑');
            return false;
        }
        
        // 检查是否可以放置建筑（包括多地块检查）
        if (!this.canPlaceBuildingAt(tileInfo.row, tileInfo.col, buildInfo.getBuildingWidth(), buildInfo.getBuildingHeight())) {
            console.log(`无法在地块 (${tileInfo.row}, ${tileInfo.col}) 放置建筑，区域被占用或超出边界`);
            return false;
        }
        
        // 获取地块节点
        const tileKey = `${tileInfo.row}_${tileInfo.col}`;
        const tile = this.getTileByKey(tileKey);
        if (!tile) {
            console.warn('找不到对应的地块节点');
            return false;
        }
        
        // 放置建筑
        return this.placeBuilding(tile, tileInfo.row, tileInfo.col, buildInfo);
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
}