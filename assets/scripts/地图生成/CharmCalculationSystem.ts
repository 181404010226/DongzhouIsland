import { _decorator, Component } from 'cc';
import { TopBarManager } from '../UI面板/TopBarManager';
const { ccclass, property } = _decorator;

/**
 * 建筑魅力值信息接口
 * 用于传递单个建筑的魅力值计算数据
 */
export interface BuildingCharmInfo {
    /** 建筑ID */
    buildingId: string;
    /** 建筑类型 */
    buildingType: string;
    /** 建筑基础魅力值 */
    baseCharmValue: number;
    /** 建筑覆盖的其他建筑数量 */
    coveredBuildingsCount: number;
    /** 建筑计算后的总魅力值（基础魅力值 + 覆盖加成） */
    totalCharmValue: number;
    /** 建筑位置信息 */
    position: { row: number, col: number };
}

/**
 * 魅力值计算结果接口
 * 包含整个地图的魅力值计算结果
 */
export interface CharmCalculationResult {
    /** 所有建筑的魅力值信息列表 */
    buildingCharmInfos: BuildingCharmInfo[];
    /** 地图总魅力值 */
    totalMapCharmValue: number;
    /** 参与计算的建筑总数 */
    totalBuildingCount: number;
    /** 计算时间戳 */
    calculationTimestamp: number;
}

/**
 * 魅力值计算系统
 * 负责根据建筑信息和相邻关系计算魅力值
 * 
 * 计算规则：
 * 1. 每个建筑有基础魅力值（默认5点）
 * 2. 建筑覆盖其他建筑时，每覆盖一个建筑增加1点魅力值
 * 3. 地图总魅力值 = 所有建筑的总魅力值之和
 * 
 * 数据流向：
 * BuildInfo → TileOccupancyManager → BuildingManager → CharmCalculationSystem → TopBarManager
 */
@ccclass('CharmCalculationSystem')
export class CharmCalculationSystem extends Component {
    
    // 魅力值计算配置
    private static readonly COVERAGE_BONUS_PER_BUILDING = 1; // 每覆盖一个建筑的魅力值加成
    
    // 存储每个建筑的魅力值
    private static buildingCharmValues: Map<string, number> = new Map();
    
    /**
     * 计算单个建筑的魅力值
     * @param baseCharmValue 建筑基础魅力值
     * @param buildingType 建筑类型
     * @param coveredBuildings 被覆盖的建筑数组
     * @param buildingId 建筑ID
     * @param position 建筑位置
     * @returns 建筑魅力值信息
     */
    public static calculateBuildingCharm(
        baseCharmValue: number,
        buildingType: string,
        coveredBuildings: any[],
        buildingId: string,
        position: { row: number, col: number }
    ): BuildingCharmInfo {
        // 使用传入的建筑基础魅力值
        
        // 计算覆盖加成：每覆盖一个建筑增加1点魅力值
        const coveredBuildingsCount = coveredBuildings ? coveredBuildings.length : 0;
        const coverageBonus = coveredBuildingsCount * this.COVERAGE_BONUS_PER_BUILDING;
        
        // 计算总魅力值
        const totalCharmValue = baseCharmValue + coverageBonus;
        
        // 存储建筑魅力值到静态Map中
        this.buildingCharmValues.set(buildingId, totalCharmValue);
        
        console.log(`[魅力值计算] 建筑 ${buildingType} 位置(${position.row}, ${position.col})：基础魅力值=${baseCharmValue}，覆盖建筑数=${coveredBuildingsCount}，覆盖加成=${coverageBonus}，总魅力值=${totalCharmValue}`);
        
        return {
            buildingId: buildingId,
            buildingType: buildingType,
            baseCharmValue: baseCharmValue,
            coveredBuildingsCount: coveredBuildingsCount,
            totalCharmValue: totalCharmValue,
            position: { row: position.row, col: position.col }
        };
    }
    
    /**
     * 计算整个地图的魅力值
     * @param buildingCharmInfos 所有建筑的魅力值信息列表
     * @returns 魅力值计算结果
     */
    public static calculateMapCharm(buildingCharmInfos: BuildingCharmInfo[]): CharmCalculationResult {
        // 计算地图总魅力值
        const totalMapCharmValue = buildingCharmInfos.reduce((sum, info) => {
            return sum + info.totalCharmValue;
        }, 0);
        
        const result: CharmCalculationResult = {
            buildingCharmInfos: buildingCharmInfos,
            totalMapCharmValue: totalMapCharmValue,
            totalBuildingCount: buildingCharmInfos.length,
            calculationTimestamp: Date.now()
        };
        
        console.log(`[地图魅力值计算] 总建筑数: ${result.totalBuildingCount}, 地图总魅力值: ${result.totalMapCharmValue}`);
        
        return result;
    }
    
    /**
     * 批量计算多个建筑的魅力值
     * @param buildingDataList 建筑数据列表，包含建筑信息和覆盖建筑
     * @returns 魅力值计算结果
     */
    public static calculateMultipleBuildingsCharm(
        buildingDataList: Array<{
            baseCharmValue: number,
            buildingType: string,
            coveredBuildings: any[],
            buildingId: string,
            position: { row: number, col: number }
        }>
    ): CharmCalculationResult {
        // 计算每个建筑的魅力值
        const buildingCharmInfos: BuildingCharmInfo[] = buildingDataList.map(data => {
            return this.calculateBuildingCharm(
                data.baseCharmValue,
                data.buildingType,
                data.coveredBuildings,
                data.buildingId,
                data.position
            );
        });
        
        // 计算地图总魅力值
        return this.calculateMapCharm(buildingCharmInfos);
    }
    
    /**
     * 获取魅力值计算配置
     * @returns 配置信息
     */
    public static getCalculationConfig(): { coverageBonusPerBuilding: number } {
        return {
            coverageBonusPerBuilding: this.COVERAGE_BONUS_PER_BUILDING
        };
    }
    
    /**
     * 验证魅力值计算结果的有效性
     * @param result 计算结果
     * @returns 是否有效
     */
    public static validateCalculationResult(result: CharmCalculationResult): boolean {
        if (!result || !Array.isArray(result.buildingCharmInfos)) {
            console.error('[魅力值计算] 计算结果无效：结果为空或建筑信息列表不是数组');
            return false;
        }
        
        if (result.totalMapCharmValue < 0) {
            console.error('[魅力值计算] 计算结果无效：总魅力值不能为负数');
            return false;
        }
        
        if (result.totalBuildingCount !== result.buildingCharmInfos.length) {
            console.error('[魅力值计算] 计算结果无效：建筑数量不匹配');
            return false;
        }
        
        // 验证每个建筑的魅力值信息
        for (const info of result.buildingCharmInfos) {
            if (info.baseCharmValue < 0 || info.coveredBuildingsCount < 0 || info.totalCharmValue < 0) {
                console.error(`[魅力值计算] 建筑 ${info.buildingType} 的魅力值信息无效`);
                return false;
            }
            
            // 验证总魅力值计算是否正确
            const expectedTotal = info.baseCharmValue + (info.coveredBuildingsCount * this.COVERAGE_BONUS_PER_BUILDING);
            if (info.totalCharmValue !== expectedTotal) {
                console.error(`[魅力值计算] 建筑 ${info.buildingType} 的总魅力值计算错误：期望 ${expectedTotal}，实际 ${info.totalCharmValue}`);
                return false;
            }
        }
        
        console.log('[魅力值计算] 计算结果验证通过');
        return true;
    }
    
    /**
     * 格式化魅力值计算结果为可读字符串
     * @param result 计算结果
     * @returns 格式化的字符串
     */
    public static formatCalculationResult(result: CharmCalculationResult): string {
        if (!this.validateCalculationResult(result)) {
            return '魅力值计算结果无效';
        }
        
        let output = `地图魅力值计算结果:\n`;
        output += `总建筑数: ${result.totalBuildingCount}\n`;
        output += `地图总魅力值: ${result.totalMapCharmValue}\n`;
        output += `计算时间: ${new Date(result.calculationTimestamp).toLocaleString()}\n\n`;
        
        output += `建筑详情:\n`;
        result.buildingCharmInfos.forEach((info, index) => {
            output += `${index + 1}. ${info.buildingType} (${info.position.row}, ${info.position.col}):\n`;
            output += `   基础魅力值: ${info.baseCharmValue}\n`;
            output += `   覆盖建筑数: ${info.coveredBuildingsCount}\n`;
            output += `   总魅力值: ${info.totalCharmValue}\n\n`;
        });
        
        return output;
    }
    
    /**
     * 清除指定建筑的魅力值记录
     * @param buildingId 建筑ID
     */
    public static removeBuildingCharmValue(buildingId: string): void {
        if (this.buildingCharmValues.has(buildingId)) {
            this.buildingCharmValues.delete(buildingId);
            console.log(`[魅力值计算系统] 已清除建筑 ${buildingId} 的魅力值记录`);
        }
    }
    
    /**
     * 清除所有建筑的魅力值记录
     */
    public static clearAllBuildingCharmValues(): void {
        this.buildingCharmValues.clear();
        console.log(`[魅力值计算系统] 已清除所有建筑的魅力值记录`);
    }
    
    /**
     * 更新地图总魅力值显示
     * 计算当前地图的总魅力值并通过TopBarManager更新UI显示
     * 这个方法由BuildingManager调用，遵循数据传递路径
     */
    public static updateMapTotalCharmDisplay(): void {
        try {
            // 计算当前存储的所有建筑魅力值总和
            let totalCharmValue = 0;
            for (const charmValue of this.buildingCharmValues.values()) {
                totalCharmValue += charmValue;
            }
            
            const buildingCount = this.buildingCharmValues.size;
            
            // 调用TopBarManager更新UI显示
            TopBarManager.handleCalculationResult(totalCharmValue, buildingCount);
            
            console.log(`[魅力值计算系统] 已更新地图总魅力值显示: 总魅力值=${totalCharmValue}, 建筑数=${buildingCount}`);
            
        } catch (error) {
            console.error(`[魅力值计算系统] 更新地图总魅力值显示时发生错误:`, error);
        }
    }
}