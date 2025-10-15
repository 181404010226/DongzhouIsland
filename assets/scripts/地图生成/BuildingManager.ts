import { BuildingAdjacencyDisplay } from './BuildingAdjacencyDisplay';
import { CharmCalculationSystem } from './CharmCalculationSystem';
import { BuildingTrafficPriceSystem, BuildingType, BuildingTrafficPriceInfo } from './BuildingTrafficPriceSystem';
import { BuildingDetailButtonManager} from '../UI面板/BuildingDetailButtonManager';
import { NavigationSystem } from '../人物生成/NavigationSystem';
import { BuildInfo } from './BuildInfo';
import { Vec3, SpriteFrame, director } from 'cc';

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
     * 处理建筑放置时的导航点禁用
     * @param buildingRow 建筑行坐标
     * @param buildingCol 建筑列坐标
     */
    public static handleBuildingPlacement(buildingRow: number, buildingCol: number): void {
        const navigationSystem = NavigationSystem.getInstance();
        if (!navigationSystem) {
            console.warn('NavigationSystem实例未初始化，无法处理导航点禁用');
            return;
        }
        
        // 计算对应的导航点坐标 (2i, 2j)
        const navPointName = navigationSystem.getNavigationPointNameByBuildingPosition(buildingRow, buildingCol);
        
        console.log(`建筑放置在 (${buildingRow}, ${buildingCol})，禁用导航点: ${navPointName}`);
        
        // 禁用导航点
        navigationSystem.disableNavigationPoint(navPointName);
    }
    
    /**
     * 处理建筑移除时的导航点启用
     * @param buildingRow 建筑行坐标
     * @param buildingCol 建筑列坐标
     */
    public static handleBuildingRemoval(buildingRow: number, buildingCol: number): void {
        const navigationSystem = NavigationSystem.getInstance();
        if (!navigationSystem) {
            console.warn('NavigationSystem实例未初始化，无法处理导航点启用');
            return;
        }
        
        // 计算对应的导航点坐标 (2i, 2j)
        const navPointName = navigationSystem.getNavigationPointNameByBuildingPosition(buildingRow, buildingCol);
        
        console.log(`建筑从 (${buildingRow}, ${buildingCol}) 移除，启用导航点: ${navPointName}`);
        
        // 启用导航点
        navigationSystem.enableNavigationPoint(navPointName);
    }
    
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
    
    /**
     * 处理建筑点击事件的中介方法
     * 从TileOccupancyManager接收建筑点击信息，转发给BuildingDetailButtonManager
     * @param buildingDetailButtonManager 建筑详情按钮管理器实例（可为null，会自动查找）
     * @param buildingNode 被点击的建筑节点（null表示点击空白处）
     * @param clickPosition 点击位置（世界坐标）
     * @param buildingInfo 建筑信息（由调用方提供）
     */
    public static handleBuildingClick(
        buildingDetailButtonManager: BuildingDetailButtonManager | null,
        buildingNode: any | null,
        clickPosition: Vec3,
        buildingInfo?: any
    ): void {
        console.log('[BuildingManager] handleBuildingClick 被调用:', {
            hasButtonManager: !!buildingDetailButtonManager,
            hasBuildingNode: !!buildingNode,
            buildingNodeName: buildingNode ? buildingNode.name : 'null',
            hasBuildingInfo: !!buildingInfo,
            buildingInfo: buildingInfo,
            clickPosition: clickPosition
        });
        
        let buttonManager = buildingDetailButtonManager;
        
        // 如果没有提供BuildingDetailButtonManager实例，尝试从场景中查找
        if (!buttonManager) {
            const scene = buildingNode?.scene || (typeof director !== 'undefined' ? director.getScene() : null);
            if (scene) {
                buttonManager = scene.getComponentInChildren(BuildingDetailButtonManager);
            }
        }
        
        if (!buttonManager) {
            console.error('[BuildingManager] 无法找到BuildingDetailButtonManager实例，无法处理建筑点击事件');
            return;
        }
        
        try {
            // 验证buildingInfo的完整性
            if (buildingNode && buildingInfo) {
                console.log(`[BuildingManager] 转发建筑点击事件:`, {
                    buildingType: buildingInfo.buildingType,
                    hasPreviewImage: !!buildingInfo.previewImage,
                    hasDescription: !!buildingInfo.description,
                    buildingNodeName: buildingNode.name
                });
            }
            
            // 转发建筑点击事件给BuildingDetailButtonManager
            buttonManager.onBuildingClicked(buildingNode, clickPosition, buildingInfo);
            
            console.log(`[BuildingManager] 已转发建筑点击事件: ${buildingNode ? '建筑节点' : '空白处'}`);
            
        } catch (error) {
            console.error(`[BuildingManager] 处理建筑点击事件时发生错误:`, {
                error: error,
                buildingNode: buildingNode?.name || 'null',
                hasBuildingInfo: !!buildingInfo,
                buildingInfo: buildingInfo
            });
        }
    }
    
    /**
     * 转换相邻建筑信息为客流量单价系统所需的格式
     * @param adjacencyResult 相邻建筑检测结果
     * @returns 转换后的周边建筑列表
     */
    private static convertAdjacencyToNearbyBuildings(adjacencyResult: BuildingAdjacencyResult): Array<{ buildingType: BuildingType; buildingId: string }> {
        const nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }> = [];
        
        // 处理被当前建筑覆盖的建筑
        for (const building of adjacencyResult.coveredBuildings) {
            // 从建筑节点获取建筑名称
            const buildingName = this.getBuildingNameFromNode(building.buildingNode);
            if (buildingName) {
                const buildingType = BuildingTrafficPriceSystem.getBuildingTypeByName(buildingName);
                if (buildingType) {
                    nearbyBuildings.push({
                        buildingType: buildingType,
                        buildingId: building.buildingId
                    });
                }
            }
        }
        
        // 处理覆盖当前建筑的建筑
        for (const building of adjacencyResult.coveringBuildings) {
            // 从建筑节点获取建筑名称
            const buildingName = this.getBuildingNameFromNode(building.buildingNode);
            if (buildingName) {
                const buildingType = BuildingTrafficPriceSystem.getBuildingTypeByName(buildingName);
                if (buildingType) {
                    nearbyBuildings.push({
                        buildingType: buildingType,
                        buildingId: building.buildingId
                    });
                }
            }
        }
        
        return nearbyBuildings;
    }
    
    /**
     * 从建筑节点获取建筑名称
     * @param buildingNode 建筑节点
     * @returns 建筑名称，如果无法获取则返回null
     */
    private static getBuildingNameFromNode(buildingNode: any): string | null {
        if (!buildingNode || !buildingNode.isValid) {
            return null;
        }
        
        const buildInfo = buildingNode.getComponent('BuildInfo');
        if (buildInfo && typeof buildInfo.getBuildingName === 'function') {
            return buildInfo.getBuildingName();
        }
        
        return null;
    }
    
    /**
     * 接收并处理建筑客流量和单价数据
     * 从TileOccupancyManager接收数据，调用客流量单价计算系统
     * @param buildingNode 建筑节点
     * @param trafficPriceData 客流量单价相关数据
     */
    public static updateBuildingTrafficPriceData(
        buildingNode: any,
        trafficPriceData: {
            buildingId: string;
            buildingName: string;
            position: { row: number, col: number };
            adjacencyResult: BuildingAdjacencyResult;
        }
    ): void {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法更新客流量单价数据');
            return;
        }
        
        try {
            // 转换相邻建筑信息为客流量单价系统所需的格式
            const nearbyBuildings = this.convertAdjacencyToNearbyBuildings(trafficPriceData.adjacencyResult);
            
            // 调用客流量单价计算系统计算单个建筑的信息
            const trafficPriceInfo = BuildingTrafficPriceSystem.calculateBuildingTrafficPriceInfo(
                trafficPriceData.buildingId,
                trafficPriceData.buildingName,
                trafficPriceData.position,
                nearbyBuildings
            );
            
            if (trafficPriceInfo) {
                console.log(`[BuildingManager] 已更新建筑客流量单价数据: ${trafficPriceData.buildingName}`, {
                    客流量: `${trafficPriceInfo.baseTrafficFlow} → ${trafficPriceInfo.totalTrafficFlow}`,
                    单价: `${trafficPriceInfo.basePrice} → ${trafficPriceInfo.totalPrice}`,
                    每秒收入: trafficPriceInfo.incomePerSecond
                });
                
                // 更新建筑节点上的BuildingAdjacencyDisplay组件显示
                const adjacencyDisplay = buildingNode.getComponent(BuildingAdjacencyDisplay);
                if (adjacencyDisplay) {
                    adjacencyDisplay.updateTrafficPriceInfoById(trafficPriceData.buildingId);
                }
                
                // 让客流量单价计算系统负责计算总收入并更新UI显示
                BuildingTrafficPriceSystem.updateTotalIncomeDisplay();
            }
            
        } catch (error) {
            console.error(`[BuildingManager] 处理建筑客流量单价数据时发生错误:`, error);
        }
    }
    
    /**
     * 批量更新多个建筑的客流量和单价数据
     * @param buildingDataList 建筑数据列表
     */
    public static updateMultipleBuildingsTrafficPriceData(
        buildingDataList: Array<{
            buildingNode: any;
            buildingId: string;
            buildingName: string;
            position: { row: number, col: number };
            adjacencyResult: BuildingAdjacencyResult;
        }>
    ): void {
        const validBuildings: Array<{
            buildingId: string;
            buildingName: string;
            position: { row: number, col: number };
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }> = [];
        
        // 转换所有建筑数据
        for (const buildingData of buildingDataList) {
            if (buildingData.buildingNode && buildingData.buildingNode.isValid) {
                const nearbyBuildings = this.convertAdjacencyToNearbyBuildings(buildingData.adjacencyResult);
                validBuildings.push({
                    buildingId: buildingData.buildingId,
                    buildingName: buildingData.buildingName,
                    position: buildingData.position,
                    nearbyBuildings: nearbyBuildings
                });
            }
        }
        
        if (validBuildings.length > 0) {
            try {
                // 批量计算所有建筑的客流量和单价
                const results = BuildingTrafficPriceSystem.calculateMultipleBuildingsTrafficPrice(validBuildings);
                
                console.log(`[BuildingManager] 已批量更新 ${results.length} 个建筑的客流量单价数据`);
                
                // 更新总收入显示
                BuildingTrafficPriceSystem.updateTotalIncomeDisplay();
                
            } catch (error) {
                console.error(`[BuildingManager] 批量处理建筑客流量单价数据时发生错误:`, error);
            }
        }
    }
    
    /**
     * 清除指定建筑的客流量和单价记录
     * 作为TileOccupancyManager和BuildingTrafficPriceSystem之间的中介
     * @param buildingId 建筑ID
     */
    public static removeBuildingTrafficPriceData(buildingId: string): void {
        try {
            // 调用客流量单价计算系统清除记录
            BuildingTrafficPriceSystem.removeBuildingTrafficPriceInfo(buildingId);
            
            // 更新总收入显示
            BuildingTrafficPriceSystem.updateTotalIncomeDisplay();
            
            console.log(`[BuildingManager] 已清除建筑客流量单价记录: ${buildingId}`);
            
        } catch (error) {
            console.error(`[BuildingManager] 清除建筑客流量单价记录时发生错误:`, error);
        }
    }
    
    /**
     * 获取建筑的客流量和单价信息
     * @param buildingId 建筑ID
     * @returns 建筑客流量和单价信息
     */
    public static getBuildingTrafficPriceInfo(buildingId: string): BuildingTrafficPriceInfo | null {
        return BuildingTrafficPriceSystem.getBuildingTrafficPriceInfo(buildingId);
    }
    
    /**
     * 获取所有建筑的客流量和单价信息
     * @returns 所有建筑的客流量和单价信息数组
     */
    public static getAllBuildingTrafficPriceInfo(): BuildingTrafficPriceInfo[] {
        return BuildingTrafficPriceSystem.getAllBuildingTrafficPriceInfo();
    }
    
    /**
     * 计算并获取总收入
     * @returns 所有建筑的总收入（每秒）
     */
    public static getTotalIncome(): number {
        return BuildingTrafficPriceSystem.calculateTotalIncome();
    }
}