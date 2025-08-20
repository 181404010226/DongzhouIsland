import { _decorator, Component, Prefab } from 'cc';
import { BuildInfo } from './BuildInfo';

const { ccclass, property } = _decorator;

/**
 * 建筑预制体映射器
 * 用于管理建筑预制体与尺寸的映射关系
 */
@ccclass('BuildingPrefabMapper')
export class BuildingPrefabMapper extends Component {
    
    // 预制体映射表：key为"宽度-高度"，value为预制体
    private static prefabMap: Map<string, Prefab> = new Map();
    
    /**
     * 初始化预制体映射
     * @param prefabs 预制体数组
     */
    public static initializePrefabMap(prefabs: Prefab[]): void {
        this.prefabMap.clear();
        
        for (const prefab of prefabs) {
            if (!prefab || !prefab.data) {
                console.warn('无效的预制体:', prefab);
                continue;
            }
            
            const buildInfo = prefab.data.getComponent(BuildInfo);
            if (!buildInfo) {
                console.warn(`预制体 ${prefab.name} 缺少 BuildInfo 组件`);
                continue;
            }
            
            const width = buildInfo.getWidth();
            const height = buildInfo.getHeight();
            const key = `${width}-${height}`;
            
            if (this.prefabMap.has(key)) {
                console.warn(`尺寸 ${key} 的预制体映射已存在，将被覆盖`);
            }
            
            this.prefabMap.set(key, prefab);
            console.log(`映射预制体: ${prefab.name} -> ${key} (${width}x${height})`);
        }
        
        console.log(`预制体映射初始化完成，共 ${this.prefabMap.size} 个映射`);
    }
    
    /**
     * 根据尺寸获取预制体
     * @param width 宽度
     * @param height 高度
     * @returns 对应的预制体，如果不存在则返回null
     */
    public static getPrefabBySize(width: number, height: number): Prefab | null {
        const key = `${width}-${height}`;
        const prefab = this.prefabMap.get(key);
        
        if (!prefab) {
            console.warn(`未找到尺寸为 ${width}x${height} 的预制体`);
            return null;
        }
        
        return prefab;
    }
    
    /**
     * 获取所有可用的尺寸
     * @returns 尺寸数组
     */
    public static getAvailableSizes(): Array<{width: number, height: number}> {
        const sizes: Array<{width: number, height: number}> = [];
        
        for (const key of this.prefabMap.keys()) {
            const [width, height] = key.split('-').map(Number);
            sizes.push({ width, height });
        }
        
        return sizes;
    }
    
    /**
     * 检查指定尺寸的预制体是否存在
     * @param width 宽度
     * @param height 高度
     * @returns 是否存在
     */
    public static hasPrefabForSize(width: number, height: number): boolean {
        const key = `${width}-${height}`;
        return this.prefabMap.has(key);
    }
    
    /**
     * 获取映射表的统计信息
     * @returns 统计信息
     */
    public static getMapStatistics(): {
        totalPrefabs: number;
        sizeDistribution: Map<string, number>;
        missingCommonSizes: string[];
    } {
        const stats = {
            totalPrefabs: this.prefabMap.size,
            sizeDistribution: new Map<string, number>(),
            missingCommonSizes: [] as string[]
        };
        
        // 统计尺寸分布
        for (const key of this.prefabMap.keys()) {
            const [width, height] = key.split('-').map(Number);
            const category = this.categorizeBuildingSize(width, height);
            const count = stats.sizeDistribution.get(category) || 0;
            stats.sizeDistribution.set(category, count + 1);
        }
        
        // 检查常见尺寸是否缺失
        const commonSizes = ['1-1', '2-1', '2-2', '3-2', '3-3', '4-3', '4-4'];
        for (const size of commonSizes) {
            if (!this.prefabMap.has(size)) {
                stats.missingCommonSizes.push(size);
            }
        }
        
        return stats;
    }
    
    /**
     * 根据尺寸对建筑进行分类
     * @param width 宽度
     * @param height 高度
     * @returns 分类名称
     */
    private static categorizeBuildingSize(width: number, height: number): string {
        const area = width * height;
        
        if (area === 1) return '小型建筑(1格)';
        if (area <= 4) return '中型建筑(2-4格)';
        if (area <= 9) return '大型建筑(5-9格)';
        return '超大型建筑(10+格)';
    }
    
    /**
     * 打印映射表信息（调试用）
     */
    public static printMappingInfo(): void {
        console.log('=== 建筑预制体映射信息 ===');
        console.log(`总预制体数量: ${this.prefabMap.size}`);
        
        const stats = this.getMapStatistics();
        
        console.log('\n尺寸分布:');
        for (const [category, count] of stats.sizeDistribution) {
            console.log(`  ${category}: ${count}个`);
        }
        
        if (stats.missingCommonSizes.length > 0) {
            console.log('\n缺失的常见尺寸:');
            for (const size of stats.missingCommonSizes) {
                console.log(`  ${size}`);
            }
        }
        
        console.log('\n详细映射:');
        const sortedKeys = Array.from(this.prefabMap.keys()).sort((a, b) => {
            const [w1, h1] = a.split('-').map(Number);
            const [w2, h2] = b.split('-').map(Number);
            return (w1 * h1) - (w2 * h2); // 按面积排序
        });
        
        for (const key of sortedKeys) {
            const prefab = this.prefabMap.get(key);
            const [width, height] = key.split('-').map(Number);
            const area = width * height;
            console.log(`  ${key} (${area}格) -> ${prefab?.name || '未知'}`);
        }
        
        console.log('========================');
    }
    
    /**
     * 验证预制体映射的完整性
     * @param requiredSizes 需要的尺寸列表
     * @returns 验证结果
     */
    public static validateMapping(requiredSizes?: Array<{width: number, height: number}>): {
        isValid: boolean;
        missingPrefabs: string[];
        invalidPrefabs: string[];
    } {
        const result = {
            isValid: true,
            missingPrefabs: [] as string[],
            invalidPrefabs: [] as string[]
        };
        
        // 检查必需的尺寸
        if (requiredSizes) {
            for (const size of requiredSizes) {
                const key = `${size.width}-${size.height}`;
                if (!this.prefabMap.has(key)) {
                    result.missingPrefabs.push(key);
                    result.isValid = false;
                }
            }
        }
        
        // 验证现有预制体的有效性
        for (const [key, prefab] of this.prefabMap) {
            if (!prefab || !prefab.data) {
                result.invalidPrefabs.push(key);
                result.isValid = false;
                continue;
            }
            
            const buildInfo = prefab.data.getComponent(BuildInfo);
            if (!buildInfo) {
                result.invalidPrefabs.push(`${key} (缺少BuildInfo)`);
                result.isValid = false;
                continue;
            }
            
            const [expectedWidth, expectedHeight] = key.split('-').map(Number);
            const actualWidth = buildInfo.getWidth();
            const actualHeight = buildInfo.getHeight();
            
            if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
                result.invalidPrefabs.push(`${key} (尺寸不匹配: 期望${expectedWidth}x${expectedHeight}, 实际${actualWidth}x${actualHeight})`);
                result.isValid = false;
            }
        }
        
        return result;
    }
    
    /**
     * 清除映射表
     */
    public static clearMapping(): void {
        this.prefabMap.clear();
        console.log('预制体映射表已清除');
    }
    
    /**
     * 获取映射表大小
     * @returns 映射表中的预制体数量
     */
    public static getMapSize(): number {
        return this.prefabMap.size;
    }
}