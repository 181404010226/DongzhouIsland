import { _decorator, Component, CCString, Color, Node, Label, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { BuildingTrafficPriceSystem, BuildingTrafficPriceInfo } from './BuildingTrafficPriceSystem';
const { ccclass, property } = _decorator;

/**
 * 地块占用信息接口（本地定义，避免循环依赖）
 */
interface TileOccupancyInfo {
    buildingId: string;
    buildingType: string;
    anchorRow: number;
    anchorCol: number;
    width: number;
    height: number;
    buildingNode: any;
}

/**
 * 建筑相邻检测结果接口（本地定义，避免循环依赖）
 */
interface BuildingAdjacencyResult {
    /** 当前建筑覆盖的其他建筑列表 */
    coveredBuildings: Array<TileOccupancyInfo>;
    /** 覆盖当前建筑的其他建筑列表 */
    coveringBuildings: Array<TileOccupancyInfo>;
}

/**
 * 建筑相邻关系显示组件
 * 专门用于在编辑器中显示建筑的覆盖关系信息
 * 此组件应该添加到每个放置在地图上的建筑节点上
 */
@ccclass('BuildingAdjacencyDisplay')
export class BuildingAdjacencyDisplay extends Component {
    
    // 覆盖关系信息（编辑器显示）
    @property({ 
        type: [CCString], 
        readonly: true, 
        tooltip: '此建筑覆盖的其他建筑列表（编辑器查看）',
        displayName: '覆盖的建筑'
    })
    private readonly coveredBuildings: string[] = [];
    
    @property({ 
        type: [CCString], 
        readonly: true, 
        tooltip: '覆盖此建筑的其他建筑列表（编辑器查看）',
        displayName: '被覆盖的建筑'
    })
    private readonly coveringBuildings: string[] = [];
    
    @property({ 
        readonly: true, 
        tooltip: '建筑类型名称（用于标识）',
        displayName: '建筑类型'
    })
    private readonly buildingTypeName: string = '';
    
    @property({ 
        readonly: true, 
        tooltip: '建筑在地图上的位置信息',
        displayName: '地图位置'
    })
    private readonly positionInfo: string = '';
    
    @property({ 
        readonly: true, 
        tooltip: '建筑占用的地块数量',
        displayName: '占用地块数'
    })
    private readonly occupiedTilesCount: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '建筑影响范围内的地块数量',
        displayName: '影响范围地块数'
    })
    private readonly influenceRangeCount: number = 0;
    
    // 客流量和单价信息（编辑器显示）
    @property({ 
        readonly: true, 
        tooltip: '建筑基础客流量（人/秒）',
        displayName: '基础客流量'
    })
    private readonly baseTrafficFlow: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '建筑总客流量（人/秒）',
        displayName: '总客流量'
    })
    private readonly totalTrafficFlow: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '建筑基础单价',
        displayName: '基础单价'
    })
    private readonly basePrice: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '建筑总单价',
        displayName: '总单价'
    })
    private readonly totalPrice: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '建筑每秒收入',
        displayName: '每秒收入'
    })
    private readonly incomePerSecond: number = 0;
    
    @property({ 
        readonly: true, 
        tooltip: '客流量和单价详细信息',
        displayName: '收入详情'
    })
    private readonly trafficPriceDetails: string = '';
    


    // 私有属性
    private relationshipIndicators: Node[] = [];
    private detailedAdjacencyInfo: BuildingAdjacencyResult | null = null;
    
    /**
     * 更新覆盖关系信息
     * @param coveredList 此建筑覆盖的建筑列表
     * @param coveringList 覆盖此建筑的建筑列表
     * @param buildingType 建筑类型名称
     * @param position 建筑位置信息
     */
    public updateAdjacencyInfo(
        coveredList: string[], 
        coveringList: string[], 
        buildingType?: string,
        position?: {row: number, col: number}
    ): void {
        // 清空现有数据
        this.coveredBuildings.length = 0;
        this.coveringBuildings.length = 0;
        
        // 添加新数据
        this.coveredBuildings.push(...coveredList);
        this.coveringBuildings.push(...coveringList);
        
        // 更新建筑类型信息
        if (buildingType !== undefined) {
            (this as any).buildingTypeName = buildingType;
        }
        
        // 更新位置信息
        if (position !== undefined) {
            (this as any).positionInfo = `行:${position.row}, 列:${position.col}`;
        }
        
        // 更新统计信息
        this.updateStatistics();
    }
    
    /**
     * 使用详细的相邻关系结果更新信息
     * @param adjacencyResult 详细的相邻关系检测结果
     * @param buildingType 建筑类型名称
     * @param position 建筑位置信息
     * @param occupiedTiles 建筑占用的地块数量
     * @param influenceRange 建筑影响范围地块数量
     */
    public updateDetailedAdjacencyInfo(
        adjacencyResult: BuildingAdjacencyResult,
        buildingType?: string,
        position?: {row: number, col: number},
        occupiedTiles?: number,
        influenceRange?: number
    ): void {
        this.detailedAdjacencyInfo = adjacencyResult;
        
        // 转换为字符串列表格式
        const coveredList = adjacencyResult.coveredBuildings.map(building => 
            `${building.buildingType}(${building.anchorRow},${building.anchorCol})`
        );
        const coveringList = adjacencyResult.coveringBuildings.map(building => 
            `${building.buildingType}(${building.anchorRow},${building.anchorCol})`
        );
        
        // 更新基本信息
        this.updateAdjacencyInfo(coveredList, coveringList, buildingType, position);
        
        // 更新额外统计信息
        if (occupiedTiles !== undefined) {
            (this as any).occupiedTilesCount = occupiedTiles;
        }
        
        if (influenceRange !== undefined) {
            (this as any).influenceRangeCount = influenceRange;
        }
        
        // 更新详细统计信息
        this.updateDetailedStatistics();
    }
    
    /**
     * 清空相邻关系信息
     */
    public clearAdjacencyInfo(): void {
        this.coveredBuildings.length = 0;
        this.coveringBuildings.length = 0;
        (this as any).buildingTypeName = '';
        (this as any).positionInfo = '';
        (this as any).occupiedTilesCount = 0;
        (this as any).influenceRangeCount = 0;
        (this as any).relationshipStats = '';
        
        this.detailedAdjacencyInfo = null;
        
        // 同时清空客流量和单价信息
        this.clearTrafficPriceInfo();
    }
    
    /**
     * 更新基本统计信息
     */
    private updateStatistics(): void {
        const coveredCount = this.coveredBuildings.length;
        const coveringCount = this.coveringBuildings.length;
        const totalRelations = coveredCount + coveringCount;
        
        let stats = `总关系数: ${totalRelations}`;
        if (coveredCount > 0) {
            stats += ` | 覆盖: ${coveredCount}`;
        }
        if (coveringCount > 0) {
            stats += ` | 被覆盖: ${coveringCount}`;
        }
        
        (this as any).relationshipStats = stats;
    }
    
    /**
     * 更新详细统计信息
     */
    private updateDetailedStatistics(): void {
        if (!this.detailedAdjacencyInfo) {
            this.updateStatistics();
            return;
        }
        
        const coveredCount = this.detailedAdjacencyInfo.coveredBuildings.length;
        const coveringCount = this.detailedAdjacencyInfo.coveringBuildings.length;
        const totalRelations = coveredCount + coveringCount;
        
        let stats = `总关系数: ${totalRelations} | 占用地块: ${this.occupiedTilesCount}`;
        if (this.influenceRangeCount > 0) {
            stats += ` | 影响范围: ${this.influenceRangeCount}`;
        }
        if (coveredCount > 0) {
            stats += ` | 覆盖: ${coveredCount}`;
        }
        if (coveringCount > 0) {
            stats += ` | 被覆盖: ${coveringCount}`;
        }
        
        (this as any).relationshipStats = stats;
    }
      
    /**
     * 获取覆盖的建筑列表
     */
    public getCoveredBuildings(): string[] {
        return [...this.coveredBuildings];
    }
    
    /**
     * 获取被覆盖的建筑列表
     */
    public getCoveringBuildings(): string[] {
        return [...this.coveringBuildings];
    }
    
    /**
     * 检查是否有覆盖关系
     */
    public hasAdjacencyRelations(): boolean {
        return this.coveredBuildings.length > 0 || this.coveringBuildings.length > 0;
    }
    
    /**
     * 获取覆盖关系摘要信息
     */
    public getAdjacencySummary(): string {
        const coveredCount = this.coveredBuildings.length;
        const coveringCount = this.coveringBuildings.length;
        
        if (coveredCount === 0 && coveringCount === 0) {
            return '无覆盖关系';
        }
        
        let summary = '';
        if (coveredCount > 0) {
            summary += `覆盖${coveredCount}个建筑`;
        }
        if (coveringCount > 0) {
            if (summary) summary += ', ';
            summary += `被${coveringCount}个建筑覆盖`;
        }
        
        return summary;
    }
    
    /**
     * 获取详细的相邻关系信息
     */
    public getDetailedAdjacencyInfo(): BuildingAdjacencyResult | null {
        return this.detailedAdjacencyInfo;
    }
    
    /**
     * 设置建筑类型名称
     */
    public setBuildingTypeName(typeName: string): void {
        (this as any).buildingTypeName = typeName;
    }
    
    /**
     * 设置位置信息
     */
    public setPositionInfo(positionInfo: string): void {
        (this as any).positionInfo = positionInfo;
    }
    
    /**
     * 更新建筑的客流量和单价信息
     * @param trafficPriceInfo 客流量和单价信息
     */
    public updateTrafficPriceInfo(trafficPriceInfo: BuildingTrafficPriceInfo): void {
        if (!trafficPriceInfo) {
            this.clearTrafficPriceInfo();
            return;
        }
        
        // 更新基础数据
        (this as any).baseTrafficFlow = trafficPriceInfo.baseTrafficFlow;
        (this as any).totalTrafficFlow = trafficPriceInfo.totalTrafficFlow;
        (this as any).basePrice = trafficPriceInfo.basePrice;
        (this as any).totalPrice = trafficPriceInfo.totalPrice;
        (this as any).incomePerSecond = trafficPriceInfo.incomePerSecond;
        
        // 生成详细信息字符串
        this.updateTrafficPriceDetails(trafficPriceInfo);
        
        console.log(`[BuildingAdjacencyDisplay] 已更新建筑客流量单价显示: ${trafficPriceInfo.buildingId}`, {
            客流量: `${trafficPriceInfo.baseTrafficFlow} → ${trafficPriceInfo.totalTrafficFlow}`,
            单价: `${trafficPriceInfo.basePrice} → ${trafficPriceInfo.totalPrice}`,
            每秒收入: trafficPriceInfo.incomePerSecond
        });
    }
    
    /**
     * 根据建筑ID从系统中获取并更新客流量单价信息
     * @param buildingId 建筑ID
     */
    public updateTrafficPriceInfoById(buildingId: string): void {
        const trafficPriceInfo = BuildingTrafficPriceSystem.getBuildingTrafficPriceInfo(buildingId);
        this.updateTrafficPriceInfo(trafficPriceInfo);
    }
    
    /**
     * 清空客流量和单价信息
     */
    public clearTrafficPriceInfo(): void {
        (this as any).baseTrafficFlow = 0;
        (this as any).totalTrafficFlow = 0;
        (this as any).basePrice = 0;
        (this as any).totalPrice = 0;
        (this as any).incomePerSecond = 0;
        (this as any).trafficPriceDetails = '';
    }
    
    /**
     * 更新客流量和单价详细信息字符串
     * @param trafficPriceInfo 客流量和单价信息
     */
    private updateTrafficPriceDetails(trafficPriceInfo: BuildingTrafficPriceInfo): void {
        let details = `建筑: ${trafficPriceInfo.buildingName}`;
        
        // 客流量信息
        if (trafficPriceInfo.totalTrafficFlow !== trafficPriceInfo.baseTrafficFlow) {
            details += ` | 客流: ${trafficPriceInfo.baseTrafficFlow}+${trafficPriceInfo.totalTrafficFlow - trafficPriceInfo.baseTrafficFlow}=${trafficPriceInfo.totalTrafficFlow}人/秒`;
        } else {
            details += ` | 客流: ${trafficPriceInfo.totalTrafficFlow}人/秒`;
        }
        
        // 单价信息
        if (trafficPriceInfo.totalPrice !== trafficPriceInfo.basePrice) {
            details += ` | 单价: ${trafficPriceInfo.basePrice}+${trafficPriceInfo.totalPrice - trafficPriceInfo.basePrice}=${trafficPriceInfo.totalPrice}`;
        } else {
            details += ` | 单价: ${trafficPriceInfo.totalPrice}`;
        }
        
        // 收入信息
        details += ` | 收入: ${trafficPriceInfo.incomePerSecond}/秒`;
        
        // 位置信息
        details += ` | 位置: (${trafficPriceInfo.position.row},${trafficPriceInfo.position.col})`;
        
        (this as any).trafficPriceDetails = details;
    }
    
    /**
     * 获取建筑的客流量信息
     */
    public getTrafficFlowInfo(): { base: number; total: number } {
        return {
            base: this.baseTrafficFlow,
            total: this.totalTrafficFlow
        };
    }
    
    /**
     * 获取建筑的单价信息
     */
    public getPriceInfo(): { base: number; total: number } {
        return {
            base: this.basePrice,
            total: this.totalPrice
        };
    }
    
    /**
     * 获取建筑的收入信息
     */
    public getIncomeInfo(): number {
        return this.incomePerSecond;
    }
    
    /**
     * 检查建筑是否有客流量和单价数据
     */
    public hasTrafficPriceData(): boolean {
        return this.totalTrafficFlow > 0 || this.totalPrice > 0;
    }
    
    /**
     * 获取客流量和单价摘要信息
     */
    public getTrafficPriceSummary(): string {
        if (!this.hasTrafficPriceData()) {
            return '无收入数据';
        }
        
        return `客流: ${this.totalTrafficFlow}人/秒, 单价: ${this.totalPrice}, 收入: ${this.incomePerSecond}/秒`;
    }
      
}