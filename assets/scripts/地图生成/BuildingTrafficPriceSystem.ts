import { _decorator, Component } from 'cc';
import { TopBarManager } from '../UI面板/TopBarManager';
const { ccclass, property } = _decorator;

/**
 * 建筑类型枚举
 */
export enum BuildingType {
    SNACK_SHOP = 'building_snack_shop',      // 小吃店
    FLOWER_SHOP = 'building_flower_shop',    // 花店
    TABLE = 'building_table',                // 桌子
    TREE = 'building_tree',                  // 树木
    FLOWER_CLUSTER = 'building_flower_cluster' // 花丛
}

/**
 * 建筑基础属性配置
 */
export interface BuildingBaseConfig {
    /** 建筑类型 */
    type: BuildingType;
    /** 基础客流量（人/秒） */
    baseTrafficFlow: number;
    /** 基础消费单价 */
    basePrice: number;
    /** 是否产生收入 */
    generateIncome: boolean;
    /** 是否影响周边建筑 */
    affectsNearby: boolean;
}

/**
 * 建筑客流量和单价信息
 */
export interface BuildingTrafficPriceInfo {
    /** 建筑ID */
    buildingId: string;
    /** 建筑类型 */
    buildingType: BuildingType;
    /** 建筑名称 */
    buildingName: string;
    /** 基础客流量 */
    baseTrafficFlow: number;
    /** 计算后的总客流量 */
    totalTrafficFlow: number;
    /** 基础单价 */
    basePrice: number;
    /** 计算后的总单价 */
    totalPrice: number;
    /** 每秒收入（客流量 × 单价） */
    incomePerSecond: number;
    /** 建筑位置 */
    position: { row: number, col: number };
    /** 影响此建筑的周边建筑列表 */
    affectingBuildings: Array<{
        buildingId: string;
        buildingType: BuildingType;
        effectType: 'traffic' | 'price';
        effectValue: number;
    }>;
}

/**
 * 建筑客流量和单价计算系统
 * 负责实时计算每个建筑的客流量、单价和收入
 * 
 * 计算规则：
 * 1. 小吃店：初始客流量 2人/秒，消费单价 10
 * 2. 花店：初始客流量 2人/秒，消费单价 20
 * 3. 桌子：摆设后可提升小吃店单价 +10
 * 4. 树木：提升周边建筑客流量 +1人/秒
 * 5. 花丛：提升周边建筑客流量 +1人/秒，同时提升花店单价 +10
 */
@ccclass('BuildingTrafficPriceSystem')
export class BuildingTrafficPriceSystem extends Component {
    
    // 建筑基础配置
    private static readonly BUILDING_CONFIGS: Map<BuildingType, BuildingBaseConfig> = new Map([
        [BuildingType.SNACK_SHOP, {
            type: BuildingType.SNACK_SHOP,
            baseTrafficFlow: 2,
            basePrice: 10,
            generateIncome: true,
            affectsNearby: false
        }],
        [BuildingType.FLOWER_SHOP, {
            type: BuildingType.FLOWER_SHOP,
            baseTrafficFlow: 2,
            basePrice: 20,
            generateIncome: true,
            affectsNearby: false
        }],
        [BuildingType.TABLE, {
            type: BuildingType.TABLE,
            baseTrafficFlow: 0,
            basePrice: 0,
            generateIncome: false,
            affectsNearby: true
        }],
        [BuildingType.TREE, {
            type: BuildingType.TREE,
            baseTrafficFlow: 0,
            basePrice: 0,
            generateIncome: false,
            affectsNearby: true
        }],
        [BuildingType.FLOWER_CLUSTER, {
            type: BuildingType.FLOWER_CLUSTER,
            baseTrafficFlow: 0,
            basePrice: 0,
            generateIncome: false,
            affectsNearby: true
        }]
    ]);
    
    // 存储每个建筑的客流量和单价信息
    private static buildingTrafficPriceMap: Map<string, BuildingTrafficPriceInfo> = new Map();

    /**
     * 获取所有建筑的每秒总收入
     */
    public static getTotalIncomePerSecond(): number {
        let total = 0;
        for (const info of this.buildingTrafficPriceMap.values()) {
            total += info.incomePerSecond || 0;
        }
        return total;
    }

    /**
     * 同步总每秒收入到顶部面板显示
     */
    public static updateTopBarIncomePerSecond(): void {
        const totalIncome = this.getTotalIncomePerSecond();
        try {
            TopBarManager.setCoinsPerSecond(totalIncome);
            console.log(`[BuildingTrafficPriceSystem] 已同步每秒总收入到TopBar: +${totalIncome}/秒`);
        } catch (error) {
            console.error('[BuildingTrafficPriceSystem] 同步TopBar每秒收入失败:', error);
        }
    }

    /**
     * 从系统中移除某建筑的收入记录并刷新TopBar
     */
    public static removeBuildingTrafficPriceInfo(buildingId: string): void {
        if (this.buildingTrafficPriceMap.delete(buildingId)) {
            this.updateTopBarIncomePerSecond();
            console.log(`[BuildingTrafficPriceSystem] 已移除建筑收入记录并刷新TopBar: ${buildingId}`);
        }
    }
    
    /**
     * 根据建筑名称获取建筑类型
     * @param buildingName 建筑名称
     * @returns 建筑类型，如果无法识别则返回null
     */
    public static getBuildingTypeByName(buildingName: string): BuildingType | null {
        const lowerName = buildingName.toLowerCase();
        
        console.log(`[BuildingTrafficPriceSystem] 识别建筑类型: "${buildingName}" -> "${lowerName}"`);
        
        if (lowerName.includes('小吃') || lowerName.includes('snack')) {
            console.log(`[BuildingTrafficPriceSystem] 识别为小吃店: ${BuildingType.SNACK_SHOP}`);
            return BuildingType.SNACK_SHOP;
        } else if (lowerName.includes('花店') || lowerName.includes('flower_shop')) {
            console.log(`[BuildingTrafficPriceSystem] 识别为花店: ${BuildingType.FLOWER_SHOP}`);
            return BuildingType.FLOWER_SHOP;
        } else if (lowerName.includes('桌子') || lowerName.includes('table')) {
            console.log(`[BuildingTrafficPriceSystem] 识别为桌子: ${BuildingType.TABLE}`);
            return BuildingType.TABLE;
        } else if (lowerName.includes('树') || lowerName.includes('tree')) {
            console.log(`[BuildingTrafficPriceSystem] 识别为树木: ${BuildingType.TREE}`);
            return BuildingType.TREE;
        } else if (lowerName.includes('花丛') || lowerName.includes('flower_cluster')) {
            console.log(`[BuildingTrafficPriceSystem] 识别为花丛: ${BuildingType.FLOWER_CLUSTER}`);
            return BuildingType.FLOWER_CLUSTER;
        }
        
        console.warn(`[BuildingTrafficPriceSystem] 无法识别建筑类型: "${buildingName}"`);
        return null;
    }
    
    /**
     * 获取建筑基础配置
     * @param buildingType 建筑类型
     * @returns 建筑基础配置
     */
    public static getBuildingBaseConfig(buildingType: BuildingType): BuildingBaseConfig | null {
        return this.BUILDING_CONFIGS.get(buildingType) || null;
    }
    
    /**
     * 对附近建筑列表按 buildingId 去重，避免重复buff
     */
    private static dedupeNearbyBuildings(
        nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>
    ): Array<{ buildingType: BuildingType; buildingId: string }> {
        const seenIds = new Set<string>();
        const unique: Array<{ buildingType: BuildingType; buildingId: string }> = [];
        for (const b of nearbyBuildings) {
            if (!b) continue;
            const id = b.buildingId;
            if (!id) continue;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                unique.push(b);
            }
        }
        return unique;
    }
    
    /**
     * 检查花丛是否满足特殊升级条件（周围有3个及以上其他花丛）
     * @param nearbyBuildings 周边建筑列表
     * @returns 是否满足升级条件
     */
    public static checkFlowerClusterUpgrade(nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>): boolean {
        const flowerClusterCount = nearbyBuildings.filter(building => 
            building.buildingType === BuildingType.FLOWER_CLUSTER
        ).length;
        
        const isUpgraded = flowerClusterCount >= 3;
        console.log(`[BuildingTrafficPriceSystem] 花丛升级检查: 周围花丛数量=${flowerClusterCount}, 是否升级=${isUpgraded}`);
        
        return isUpgraded;
    }
    
    /**
     * 检查特定花丛是否满足升级条件
     * @param flowerClusterId 花丛ID
     * @param allBuildingsData 所有建筑的数据（包含位置和周边建筑信息）
     * @returns 是否满足升级条件
     */
    public static checkSpecificFlowerClusterUpgrade(
        flowerClusterId: string,
        allBuildingsData: Array<{
            buildingId: string;
            buildingType: BuildingType;
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }>
    ): boolean {
        const flowerClusterData = allBuildingsData.find(data => data.buildingId === flowerClusterId);
        if (!flowerClusterData || flowerClusterData.buildingType !== BuildingType.FLOWER_CLUSTER) {
            return false;
        }
        
        return this.checkFlowerClusterUpgrade(flowerClusterData.nearbyBuildings);
    }
    
    /**
     * 计算单个建筑的客流量
     * @param buildingType 建筑类型
     * @param nearbyBuildings 周边建筑列表
     * @param allBuildingsData 所有建筑数据（用于精确的花丛升级检测）
     * @returns 计算后的客流量信息
     */
    public static calculateBuildingTrafficFlow(
        buildingType: BuildingType,
        nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>,
        allBuildingsData?: Array<{
            buildingId: string;
            buildingType: BuildingType;
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }>
    ): { baseTrafficFlow: number; totalTrafficFlow: number; affectingBuildings: Array<any> } {
        const config = this.getBuildingBaseConfig(buildingType);
        if (!config) {
            return { baseTrafficFlow: 0, totalTrafficFlow: 0, affectingBuildings: [] };
        }
        
        console.log(`[BuildingTrafficPriceSystem] 计算客流量 - 建筑类型: ${buildingType}, 基础客流量: ${config.baseTrafficFlow}, 产生收入: ${config.generateIncome}`);
        
        let totalTrafficFlow = config.baseTrafficFlow;
        const affectingBuildings: Array<any> = [];
        
        // 只有产生收入的建筑才会受到客流量加成
        if (config.generateIncome) {
            const uniqueNearbyBuildings = this.dedupeNearbyBuildings(nearbyBuildings);
            console.log(`[BuildingTrafficPriceSystem] 检查客流量buff - 附近建筑数量: ${nearbyBuildings.length} (唯一: ${uniqueNearbyBuildings.length})`);
            for (const nearbyBuilding of uniqueNearbyBuildings) {
                console.log(`[BuildingTrafficPriceSystem] 检查附近建筑: ${nearbyBuilding.buildingType} (ID: ${nearbyBuilding.buildingId})`);
                let trafficBonus = 0;
                
                // 树木提升周边建筑客流量 +1人/秒
                if (nearbyBuilding.buildingType === BuildingType.TREE) {
                    trafficBonus = 1;
                    console.log(`[BuildingTrafficPriceSystem] 树木buff生效 +1客流量`);
                }
                // 花丛提升周边建筑客流量 +1人/秒
                else if (nearbyBuilding.buildingType === BuildingType.FLOWER_CLUSTER) {
                    trafficBonus = 1;
                    
                    // 检查该花丛是否满足特殊升级条件（周围有3个及以上其他花丛）
                    let isUpgraded = false;
                    if (allBuildingsData) {
                        isUpgraded = this.checkSpecificFlowerClusterUpgrade(nearbyBuilding.buildingId, allBuildingsData);
                    } else {
                        // 回退到近似检测（去重后的列表）
                        isUpgraded = this.checkFlowerClusterUpgrade(uniqueNearbyBuildings);
                    }
                    
                    if (isUpgraded) {
                        trafficBonus *= 2; // 效果翻倍
                        console.log(`[BuildingTrafficPriceSystem] 盛开的花丛buff生效 +${trafficBonus}客流量 (翻倍)`);
                    } else {
                        console.log(`[BuildingTrafficPriceSystem] 花丛buff生效 +${trafficBonus}客流量`);
                    }
                }
                
                if (trafficBonus > 0) {
                    totalTrafficFlow += trafficBonus;
                    affectingBuildings.push({
                        buildingId: nearbyBuilding.buildingId,
                        buildingType: nearbyBuilding.buildingType,
                        effectType: 'traffic',
                        effectValue: trafficBonus
                    });
                }
            }
        } else {
            console.log(`[BuildingTrafficPriceSystem] 建筑不产生收入，跳过客流量buff计算`);
        }
        
        console.log(`[BuildingTrafficPriceSystem] 客流量计算结果: ${config.baseTrafficFlow} → ${totalTrafficFlow}, 影响建筑数: ${affectingBuildings.length}`);
        return {
            baseTrafficFlow: config.baseTrafficFlow,
            totalTrafficFlow: totalTrafficFlow,
            affectingBuildings: affectingBuildings
        };
    }
    
    /**
     * 计算单个建筑的单价
     * @param buildingType 建筑类型
     * @param nearbyBuildings 周边建筑列表
     * @param allBuildingsData 所有建筑数据（用于精确的花丛升级检测）
     * @returns 计算后的单价信息
     */
    public static calculateBuildingPrice(
        buildingType: BuildingType,
        nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>,
        allBuildingsData?: Array<{
            buildingId: string;
            buildingType: BuildingType;
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }>
    ): { basePrice: number; totalPrice: number; affectingBuildings: Array<any> } {
        const config = this.getBuildingBaseConfig(buildingType);
        if (!config) {
            return { basePrice: 0, totalPrice: 0, affectingBuildings: [] };
        }
        
        console.log(`[BuildingTrafficPriceSystem] 计算单价 - 建筑类型: ${buildingType}, 基础单价: ${config.basePrice}, 产生收入: ${config.generateIncome}`);
        
        let totalPrice = config.basePrice;
        const affectingBuildings: Array<any> = [];
        
        // 只有产生收入的建筑才会有单价计算
        if (config.generateIncome) {
            const uniqueNearbyBuildings = this.dedupeNearbyBuildings(nearbyBuildings);
            console.log(`[BuildingTrafficPriceSystem] 检查单价buff - 附近建筑数量: ${nearbyBuildings.length} (唯一: ${uniqueNearbyBuildings.length})`);
            for (const nearbyBuilding of uniqueNearbyBuildings) {
                console.log(`[BuildingTrafficPriceSystem] 检查附近建筑: ${nearbyBuilding.buildingType} (ID: ${nearbyBuilding.buildingId})`);
                let priceBonus = 0;
                
                // 桌子提升小吃店单价 +10
                if (buildingType === BuildingType.SNACK_SHOP && nearbyBuilding.buildingType === BuildingType.TABLE) {
                    priceBonus = 10;
                    console.log(`[BuildingTrafficPriceSystem] 桌子buff生效 +10单价 (小吃店)`);
                }
                // 花丛提升花店单价 +10
                else if (buildingType === BuildingType.FLOWER_SHOP && nearbyBuilding.buildingType === BuildingType.FLOWER_CLUSTER) {
                    priceBonus = 10;
                    
                    // 检查该花丛是否满足特殊升级条件（周围有3个及以上其他花丛）
                    let isUpgraded = false;
                    if (allBuildingsData) {
                        isUpgraded = this.checkSpecificFlowerClusterUpgrade(nearbyBuilding.buildingId, allBuildingsData);
                    } else {
                        // 回退到近似检测（去重后的列表）
                        isUpgraded = this.checkFlowerClusterUpgrade(uniqueNearbyBuildings);
                    }
                    
                    if (isUpgraded) {
                        priceBonus *= 2; // 效果翻倍
                        console.log(`[BuildingTrafficPriceSystem] 盛开的花丛buff生效 +${priceBonus}单价 (花店, 翻倍)`);
                    } else {
                        console.log(`[BuildingTrafficPriceSystem] 花丛buff生效 +${priceBonus}单价 (花店)`);
                    }
                }
                
                if (priceBonus > 0) {
                    totalPrice += priceBonus;
                    affectingBuildings.push({
                        buildingId: nearbyBuilding.buildingId,
                        buildingType: nearbyBuilding.buildingType,
                        effectType: 'price',
                        effectValue: priceBonus
                    });
                }
            }
        } else {
            console.log(`[BuildingTrafficPriceSystem] 建筑不产生收入，跳过单价buff计算`);
        }
        
        console.log(`[BuildingTrafficPriceSystem] 单价计算结果: ${config.basePrice} → ${totalPrice}, 影响建筑数: ${affectingBuildings.length}`);
        return {
            basePrice: config.basePrice,
            totalPrice: totalPrice,
            affectingBuildings: affectingBuildings
        };
    }
    
    /**
     * 计算单个建筑的完整客流量和单价信息
     * @param buildingId 建筑ID
     * @param buildingName 建筑名称
     * @param position 建筑位置
     * @param nearbyBuildings 周边建筑列表
     * @param allBuildingsData 所有建筑数据（用于精确的花丛升级检测）
     * @returns 建筑客流量和单价信息
     */
    public static calculateBuildingTrafficPriceInfo(
        buildingId: string,
        buildingName: string,
        position: { row: number, col: number },
        nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>,
        allBuildingsData?: Array<{
            buildingId: string;
            buildingType: BuildingType;
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }>
    ): BuildingTrafficPriceInfo | null {
        console.log(`[BuildingTrafficPriceSystem] 开始计算建筑信息:`, {
            buildingId,
            buildingName,
            position,
            nearbyBuildingsCount: nearbyBuildings.length,
            nearbyBuildings: nearbyBuildings.map(b => ({ type: b.buildingType, id: b.buildingId }))
        });
        
        const buildingType = this.getBuildingTypeByName(buildingName);
        if (!buildingType) {
            console.warn(`[客流量单价系统] 无法识别建筑类型: ${buildingName}`);
            return null;
        }
        
        const config = this.getBuildingBaseConfig(buildingType);
        if (!config) {
            console.warn(`[客流量单价系统] 无法获取建筑配置: ${buildingType}`);
            return null;
        }
        
        console.log(`[BuildingTrafficPriceSystem] 建筑基础配置:`, {
            buildingType,
            baseTrafficFlow: config.baseTrafficFlow,
            basePrice: config.basePrice,
            generateIncome: config.generateIncome,
            affectsNearby: config.affectsNearby
        });
        
        // 计算客流量
        const trafficResult = this.calculateBuildingTrafficFlow(buildingType, nearbyBuildings, allBuildingsData);
        
        // 计算单价
        const priceResult = this.calculateBuildingPrice(buildingType, nearbyBuildings, allBuildingsData);
        
        // 合并影响建筑列表
        const allAffectingBuildings = [...trafficResult.affectingBuildings, ...priceResult.affectingBuildings];
        
        // 计算每秒收入
        const incomePerSecond = config.generateIncome ? trafficResult.totalTrafficFlow * priceResult.totalPrice : 0;
        
        const buildingInfo: BuildingTrafficPriceInfo = {
            buildingId: buildingId,
            buildingType: buildingType,
            buildingName: buildingName,
            baseTrafficFlow: trafficResult.baseTrafficFlow,
            totalTrafficFlow: trafficResult.totalTrafficFlow,
            basePrice: priceResult.basePrice,
            totalPrice: priceResult.totalPrice,
            incomePerSecond: incomePerSecond,
            position: position,
            affectingBuildings: allAffectingBuildings
        };
        
        // 存储到静态Map中
        this.buildingTrafficPriceMap.set(buildingId, buildingInfo);
        
        // 同步总每秒收入到TopBar
        this.updateTopBarIncomePerSecond();
        
        console.log(`[客流量单价系统] 计算建筑信息: ${buildingName}`, {
            客流量: `${trafficResult.baseTrafficFlow} → ${trafficResult.totalTrafficFlow}`,
            单价: `${priceResult.basePrice} → ${priceResult.totalPrice}`,
            每秒收入: incomePerSecond,
            影响建筑数: allAffectingBuildings.length
        });
        
        return buildingInfo;
    }
    
    /**
     * 批量计算多个建筑的客流量和单价信息
     * @param buildingDataList 建筑数据列表
     * @returns 所有建筑的客流量和单价信息
     */
    public static calculateMultipleBuildingsTrafficPrice(
        buildingDataList: Array<{
            buildingId: string;
            buildingName: string;
            position: { row: number, col: number };
            nearbyBuildings: Array<{ buildingType: BuildingType; buildingId: string }>;
        }>
    ): BuildingTrafficPriceInfo[] {
        const results: BuildingTrafficPriceInfo[] = [];
        
        // 准备所有建筑数据用于花丛升级检测
        const allBuildingsData = buildingDataList.map(data => ({
            buildingId: data.buildingId,
            buildingType: this.getBuildingTypeByName(data.buildingName) || BuildingType.SNACK_SHOP,
            nearbyBuildings: data.nearbyBuildings
        }));
        
        for (const buildingData of buildingDataList) {
            const result = this.calculateBuildingTrafficPriceInfo(
                buildingData.buildingId,
                buildingData.buildingName,
                buildingData.position,
                buildingData.nearbyBuildings,
                allBuildingsData
            );
            
            if (result) {
                results.push(result);
            }
        }
        // 统一刷新TopBar每秒收入显示
        this.updateTopBarIncomePerSecond();

        return results;
    }
    
    /**
     * 获取建筑的客流量和单价信息
     * @param buildingId 建筑ID
     * @returns 建筑客流量和单价信息
     */
    public static getBuildingTrafficPriceInfo(buildingId: string): BuildingTrafficPriceInfo | null {
        return this.buildingTrafficPriceMap.get(buildingId) || null;
    }
    
    /**
     * 获取所有建筑的客流量和单价信息
     * @returns 所有建筑的客流量和单价信息数组
     */
    public static getAllBuildingTrafficPriceInfo(): BuildingTrafficPriceInfo[] {
        return Array.from(this.buildingTrafficPriceMap.values());
    }
    
    /**
     * 计算总收入
     * @returns 所有建筑的总收入（每秒）
     */
    public static calculateTotalIncome(): number {
        let totalIncome = 0;
        for (const info of this.buildingTrafficPriceMap.values()) {
            totalIncome += info.incomePerSecond;
        }
        return totalIncome;
    }
    

    
    /**
     * 清除所有建筑的客流量和单价记录
     */
    public static clearAllBuildingTrafficPriceInfo(): void {
        this.buildingTrafficPriceMap.clear();
        console.log(`[客流量单价系统] 已清除所有建筑记录`);
    }
    
    /**
     * 计算总客流量
     * @returns 所有建筑的总客流量（人/秒）
     */
    public static calculateTotalTrafficFlow(): number {
        let totalTrafficFlow = 0;
        for (const info of this.buildingTrafficPriceMap.values()) {
            // 只统计产生收入的建筑的客流量
            if (info.incomePerSecond > 0) {
                totalTrafficFlow += info.totalTrafficFlow;
            }
        }
        return totalTrafficFlow;
    }

    /**
     * 更新总收入显示
     * 计算当前所有建筑的总客流量并通过TopBarManager更新UI显示
     */
    public static updateTotalIncomeDisplay(): void {
        try {
            const totalTrafficFlow = this.calculateTotalTrafficFlow();
            const totalIncome = this.calculateTotalIncome();
            const buildingCount = this.buildingTrafficPriceMap.size;
            
            console.log(`[客流量单价系统] 更新显示: 总客流量 ${totalTrafficFlow}/秒, 总收入 ${totalIncome}/秒, 建筑数: ${buildingCount}`);
            
            // 调用TopBarManager更新客流量显示（传递客流量而不是收入）
            TopBarManager.setTrafficFlow(totalTrafficFlow);
            
        } catch (error) {
            console.error(`[客流量单价系统] 更新总收入显示时发生错误:`, error);
        }
    }
    
    /**
     * 格式化建筑客流量和单价信息为可读字符串
     * @param info 建筑客流量和单价信息
     * @returns 格式化的字符串
     */
    public static formatBuildingTrafficPriceInfo(info: BuildingTrafficPriceInfo): string {
        let output = `建筑: ${info.buildingName} (${info.position.row}, ${info.position.col})\n`;
        output += `类型: ${info.buildingType}\n`;
        output += `客流量: ${info.baseTrafficFlow} → ${info.totalTrafficFlow} 人/秒\n`;
        output += `单价: ${info.basePrice} → ${info.totalPrice}\n`;
        output += `每秒收入: ${info.incomePerSecond}\n`;
        
        if (info.affectingBuildings.length > 0) {
            output += `影响建筑:\n`;
            for (const affecting of info.affectingBuildings) {
                output += `  - ${affecting.buildingType}: ${affecting.effectType} +${affecting.effectValue}\n`;
            }
        }
        
        return output;
    }
}