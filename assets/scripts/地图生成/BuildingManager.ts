import { BuildingAdjacencyDisplay } from './BuildingAdjacencyDisplay';
import { CharmCalculationSystem } from './CharmCalculationSystem';

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
    buildingNode: any;
}

/**
 * 建筑相邻检测结果接口
 */
export interface BuildingAdjacencyResult {
    /** 当前建筑覆盖的其他建筑列表 */
    coveredBuildings: Array<TileOccupancyInfo>;
    /** 覆盖当前建筑的其他建筑列表 */
    coveringBuildings: Array<TileOccupancyInfo>;
}

/**
 * 建筑管理器
 * 负责检测建筑之间的相邻关系和覆盖关系
 * 包含从BuildInfo.ts迁移的相邻关系管理功能
 */
export class BuildingManager {
    
    /**
     * 根据建筑尺寸计算检测范围
     * @param width 建筑宽度
     * @param height 建筑高度
     * @returns 检测圈层数
     */
    public static calculateDetectionRadius(width: number, height: number): number {
        const area = width * height;
        if (area > 4) {
            return 3; // 大型建筑
        } else if (area >= 2) {
            return 2; // 中型建筑
        } else {
            return 1; // 小型建筑
        }
    }
    
    /**
     * 为放置在地图上的建筑节点添加BuildingAdjacencyDisplay组件
     * 专门用于处理地图上的建筑，遵循信息传递顺序
     */
    public static addAdjacencyDisplayToMapBuilding(buildingNode: any): boolean {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效');
            return false;
        }
        
        // 确保节点有BuildingAdjacencyDisplay组件（只有放置在地图上的建筑才添加）
        let adjacencyDisplay = buildingNode.getComponent(BuildingAdjacencyDisplay);
        if (!adjacencyDisplay) {
            adjacencyDisplay = buildingNode.addComponent(BuildingAdjacencyDisplay);

            return true;
        }
        
        return false; // 组件已存在
    }
    
    /**
     * 接收并转发建筑相邻关系信息
     * 从TileOccupancyManager接收信息，然后转发给BuildingAdjacencyDisplay
     */
    public static updateBuildingAdjacencyInfo(
        buildingNode: any,
        adjacencyResult: BuildingAdjacencyResult,
        coveredList: string[],
        coveringList: string[],
        buildingType: string,
        position: {row: number, col: number},
        occupiedTiles: number,
        influenceRange: number
    ): void {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法更新相邻关系信息');
            return;
        }
        
        // 获取BuildingAdjacencyDisplay组件
        const adjacencyDisplay = buildingNode.getComponent(BuildingAdjacencyDisplay);
        
        if (adjacencyDisplay) {
            // 使用详细的相邻关系结果更新组件
            adjacencyDisplay.updateDetailedAdjacencyInfo(
                adjacencyResult,
                buildingType,
                position,
                occupiedTiles,
                influenceRange
            );
            

        } else {
            console.warn(`[BuildingManager] 建筑节点 ${buildingNode.name} 缺少 BuildingAdjacencyDisplay 组件`);
        }
    }
    
    /**
     * 获取建筑的检测区域（可配置圈层范围）
     * @param anchorRow 建筑锚点行
     * @param anchorCol 建筑锚点列
     * @param width 建筑宽度
     * @param height 建筑高度
     * @param mapRows 地图总行数
     * @param mapCols 地图总列数
     * @param detectionRadius 检测圈层数（默认为2）
     * @returns 检测区域坐标数组
     */
    public static getBuildingDetectionArea(
        anchorRow: number, 
        anchorCol: number, 
        width: number, 
        height: number,
        mapRows: number,
        mapCols: number,
        detectionRadius: number = 2
    ): Array<{row: number, col: number}> {
        const detectionArea: Array<{row: number, col: number}> = [];
        
        // 计算建筑占用的地块范围
        const minRow = anchorRow - height + 1;
        const maxRow = anchorRow;
        const minCol = anchorCol - width + 1;
        const maxCol = anchorCol;
        
        // 生成指定圈层的检测区域
        for (let ring = 1; ring <= detectionRadius; ring++) {
            // 计算当前圈层的边界
            const ringMinRow = minRow - ring;
            const ringMaxRow = maxRow + ring;
            const ringMinCol = minCol - ring;
            const ringMaxCol = maxCol + ring;
            
            // 遍历当前圈层的所有地块
            for (let row = ringMinRow; row <= ringMaxRow; row++) {
                for (let col = ringMinCol; col <= ringMaxCol; col++) {
                    // 检查是否在地图范围内
                    if (row < 0 || row >= mapRows || col < 0 || col >= mapCols) {
                        continue;
                    }
                    
                    // 排除建筑自身占用的地块
                    if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
                        continue;
                    }
                    
                    // 排除内圈已经添加的地块
                    if (ring > 1) {
                        const innerRingMinRow = minRow - (ring - 1);
                        const innerRingMaxRow = maxRow + (ring - 1);
                        const innerRingMinCol = minCol - (ring - 1);
                        const innerRingMaxCol = maxCol + (ring - 1);
                        
                        if (row >= innerRingMinRow && row <= innerRingMaxRow && 
                            col >= innerRingMinCol && col <= innerRingMaxCol) {
                            continue;
                        }
                    }
                    
                    detectionArea.push({row, col});
                }
            }
        }
        
        return detectionArea;
    }
    
    /**
     * 获取指定建筑的相邻建筑信息
     * @param anchorRow 建筑锚点行
     * @param anchorCol 建筑锚点列
     * @param width 建筑宽度
     * @param height 建筑高度
     * @param mapRows 地图总行数
     * @param mapCols 地图总列数
     * @param tileOccupancyMap 地块占用映射表
     * @param allPlacedBuildings 所有已放置建筑的信息
     * @param detectionRadius 检测圈层数（默认为2）
     * @returns 相邻建筑检测结果
     */
    public static getAdjacentBuildings(
        anchorRow: number, 
        anchorCol: number, 
        width: number, 
        height: number,
        mapRows: number,
        mapCols: number,
        tileOccupancyMap: Map<string, TileOccupancyInfo>,
        allPlacedBuildings: Array<{row: number, col: number, buildingInfo: TileOccupancyInfo}>,
        detectionRadius: number = 2
    ): BuildingAdjacencyResult {
        const coveredBuildings: Array<TileOccupancyInfo> = [];
        const coveringBuildings: Array<TileOccupancyInfo> = [];
        
        // 获取当前建筑的检测区域
        const detectionArea = this.getBuildingDetectionArea(anchorRow, anchorCol, width, height, mapRows, mapCols, detectionRadius);
        
        // 检查检测区域内是否有其他建筑的地块
        const coveredBuildingIds = new Set<string>();
        for (const tile of detectionArea) {
            const tileKey = `${tile.row}_${tile.col}`;
            const occupancyInfo = tileOccupancyMap.get(tileKey);
            
            if (occupancyInfo && !coveredBuildingIds.has(occupancyInfo.buildingId)) {
                coveredBuildings.push(occupancyInfo);
                coveredBuildingIds.add(occupancyInfo.buildingId);
            }
        }
        
        // 检查其他建筑的检测区域是否覆盖当前建筑
        const currentBuildingTiles = this.getBuildingOccupiedTiles(anchorRow, anchorCol, width, height);
        const coveringBuildingIds = new Set<string>();
        
        for (const building of allPlacedBuildings) {
            // 跳过当前建筑自己
            if (building.row === anchorRow && building.col === anchorCol) {
                continue;
            }
            
            // 根据其他建筑的尺寸计算正确的检测圈层数
            const otherDetectionRadius = this.calculateDetectionRadius(
                building.buildingInfo.width,
                building.buildingInfo.height
            );
            
            const otherDetectionArea = this.getBuildingDetectionArea(
                building.row, 
                building.col, 
                building.buildingInfo.width, 
                building.buildingInfo.height,
                mapRows,
                mapCols,
                otherDetectionRadius
            );
            
            // 检查其他建筑的检测区域是否与当前建筑的占用地块重合
            for (const currentTile of currentBuildingTiles) {
                for (const otherTile of otherDetectionArea) {
                    if (currentTile.row === otherTile.row && currentTile.col === otherTile.col) {
                        if (!coveringBuildingIds.has(building.buildingInfo.buildingId)) {
                            coveringBuildings.push(building.buildingInfo);
                            coveringBuildingIds.add(building.buildingInfo.buildingId);
                        }
                        break;
                    }
                }
                if (coveringBuildingIds.has(building.buildingInfo.buildingId)) {
                    break;
                }
            }
        }
        
        return {
            coveredBuildings,
            coveringBuildings
        };
    }
    
    /**
     * 获取建筑占用的所有地块坐标
     * @param anchorRow 建筑锚点行
     * @param anchorCol 建筑锚点列
     * @param width 建筑宽度
     * @param height 建筑高度
     * @returns 建筑占用的地块坐标数组
     */
    public static getBuildingOccupiedTiles(
        anchorRow: number, 
        anchorCol: number, 
        width: number, 
        height: number
    ): Array<{row: number, col: number}> {
        const occupiedTiles: Array<{row: number, col: number}> = [];
        
        // 从锚点左下角开始向左上方向遍历
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                occupiedTiles.push({row: r, col: c});
            }
        }
        
        return occupiedTiles;
    }
    
    /**
     * 根据建筑信息获取相邻建筑信息
     * @param currentRow 建筑当前行位置
     * @param currentCol 建筑当前列位置
     * @param width 建筑宽度
     * @param height 建筑高度
     * @param mapRows 地图总行数
     * @param mapCols 地图总列数
     * @param tileOccupancyMap 地块占用映射表
     * @param allPlacedBuildings 所有已放置建筑的信息
     * @param detectionRadius 检测圈层数
     * @returns 相邻建筑检测结果，如果位置信息无效则返回null
     */
    public static getAdjacentBuildingsByInfo(
        currentRow: number,
        currentCol: number,
        width: number,
        height: number,
        mapRows: number,
        mapCols: number,
        tileOccupancyMap: Map<string, TileOccupancyInfo>,
        allPlacedBuildings: Array<{row: number, col: number, buildingInfo: TileOccupancyInfo}>,
        detectionRadius: number
    ): BuildingAdjacencyResult | null {
        if (currentRow === -1 || currentCol === -1) {
            console.warn('建筑位置信息无效');
            return null;
        }
        
        return this.getAdjacentBuildings(
            currentRow, 
            currentCol, 
            width, 
            height,
            mapRows,
            mapCols,
            tileOccupancyMap,
            allPlacedBuildings,
            detectionRadius
        );
    }
    
    /**
     * 根据地块位置获取相邻建筑信息
     * @param row 地块行索引
     * @param col 地块列索引
     * @param mapRows 地图总行数
     * @param mapCols 地图总列数
     * @param tileOccupancyMap 地块占用映射表
     * @param allPlacedBuildings 所有已放置建筑的信息
     * @returns 相邻建筑检测结果，如果位置无建筑则返回null
     */
    public static getAdjacentBuildingsByPosition(
        row: number, 
        col: number,
        mapRows: number,
        mapCols: number,
        tileOccupancyMap: Map<string, TileOccupancyInfo>,
        allPlacedBuildings: Array<{row: number, col: number, buildingInfo: TileOccupancyInfo}>,
        detectionRadius: number
    ): BuildingAdjacencyResult | null {
        const tileKey = `${row}_${col}`;
        const occupancyInfo = tileOccupancyMap.get(tileKey);
        
        if (!occupancyInfo) {
            return null;
        }
        
        // 使用传入的检测圈层数
        
        return this.getAdjacentBuildings(
            occupancyInfo.anchorRow, 
            occupancyInfo.anchorCol, 
            occupancyInfo.width, 
            occupancyInfo.height,
            mapRows,
            mapCols,
            tileOccupancyMap,
            allPlacedBuildings,
            detectionRadius
        );
    }
    
    /**
     * 接收并处理建筑魅力值数据
     * 从TileOccupancyManager接收数据，调用魅力值计算系统
     * @param buildingNode 建筑节点
     * @param charmData 魅力值相关数据
     */
    public static updateBuildingCharmData(
        buildingNode: any,
        charmData: {
            baseCharmValue: number;
            buildingType: string;
            coveredBuildings: Array<TileOccupancyInfo>;
            buildingId: string;
            position: { row: number, col: number };
        }
    ): void {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法更新魅力值数据');
            return;
        }
        
        try {
            // 调用魅力值计算系统计算单个建筑的魅力值
            const charmResult = CharmCalculationSystem.calculateBuildingCharm(
                charmData.baseCharmValue,
                charmData.buildingType,
                charmData.coveredBuildings,
                charmData.buildingId,
                charmData.position
            );
            

            
            // 让魅力值计算系统负责计算总魅力值并更新UI显示
            CharmCalculationSystem.updateMapTotalCharmDisplay();
            
        } catch (error) {
            console.error(`[BuildingManager] 处理建筑魅力值数据时发生错误:`, error);
        }
    }
    
    /**
     * 清除指定建筑的魅力值记录
     * 作为TileOccupancyManager和CharmCalculationSystem之间的中介
     * @param buildingId 建筑ID
     */
    public static removeBuildingCharmValue(buildingId: string): void {
        try {
            // 调用魅力值计算系统清除记录
            CharmCalculationSystem.removeBuildingCharmValue(buildingId);
            
            // 更新地图总魅力值显示
            CharmCalculationSystem.updateMapTotalCharmDisplay();
            

            
        } catch (error) {
            console.error(`[BuildingManager] 清除建筑魅力值记录时发生错误:`, error);
        }
    }
}