import { _decorator, Component, JsonAsset } from 'cc';
import { BuildInfo } from '../地图生成/BuildInfo';
const { ccclass, property } = _decorator;

/**
 * 建筑配置数据接口
 */
interface BuildingConfigData {
    name: string;
    type: string;
    unlockPopularity: number;
    width: number;
    height: number;
    image: string;
    decorationValue?: number;
    decorationRange?: number;
    charmValue?: number;
    chainBuildings?: Array<{building: string, bonus: number}>;
}

/**
 * 配置文件结构接口
 */
interface BuildingConfig {
    buildings: BuildingConfigData[];
    exportTime: string;
    version: string;
}

/**
 * 建筑配置接口
 * 负责读取building-config.json并映射到BuildInfo对象
 */
@ccclass('BuildingsInterface')
export class BuildingsInterface extends Component {
    
    @property({ type: JsonAsset, tooltip: '建筑配置JSON文件' })
    buildingConfigAsset: JsonAsset = null;
    
    // 静态实例引用，用于访问装饰器属性
    private static instance: BuildingsInterface = null;
    
    onLoad() {
        BuildingsInterface.instance = this;
        console.log('BuildingsInterface 组件已加载');
    }
    
    onDestroy() {
        if (BuildingsInterface.instance === this) {
            BuildingsInterface.instance = null;
        }
    }
    
    /**
     * 加载建筑配置文件
     * @returns Promise<BuildingConfig | null>
     */
    public static async loadBuildingConfig(): Promise<BuildingConfig | null> {
        if (!BuildingsInterface.instance) {
            console.error('BuildingsInterface 组件未挂载到节点上');
            return null;
        }
        
        if (!BuildingsInterface.instance.buildingConfigAsset) {
            console.error('未设置建筑配置JSON文件');
            return null;
        }
        
        try {
            console.log('从装饰器属性加载建筑配置文件');
            const configData = BuildingsInterface.instance.buildingConfigAsset.json as BuildingConfig;
            console.log('JSON解析成功，配置数据:', configData);
            console.log('buildings数组长度:', configData.buildings ? configData.buildings.length : 'undefined');
            return configData;
        } catch (parseErr) {
            console.error('解析建筑配置文件失败:', parseErr);
            return null;
        }
    }
    
    /**
     * 将JSON配置数据映射到BuildInfo对象
     * @param configData JSON配置数据
     * @param buildInfo 目标BuildInfo对象
     */
    public static mapConfigToBuildInfo(configData: BuildingConfigData, buildInfo: BuildInfo): void {
        // 字段映射：JSON -> BuildInfo
        buildInfo.setBuildingName(configData.name);  // name -> buildingName
        buildInfo.setType(configData.type);          // type -> type
        buildInfo.setUnlockPopularity(configData.unlockPopularity); // unlockPopularity -> unlockPopularity
        buildInfo.setBuildingSize(configData.width, configData.height); // width,height -> width,height
        buildInfo.setImage(configData.image);        // image -> image
        
        // 可选字段映射
        if (configData.decorationValue !== undefined) {
            buildInfo.setDecorationValue(configData.decorationValue);
        }
        
        if (configData.decorationRange !== undefined) {
            buildInfo.setDecorationRange(configData.decorationRange);
        }
        
        if (configData.charmValue !== undefined) {
            buildInfo.setCharmValue(configData.charmValue);
        }
        
        if (configData.chainBuildings !== undefined) {
            buildInfo.setChainBuildings(configData.chainBuildings);
        }
    }
    
    /**
     * 从配置文件创建BuildInfo对象
     * @param configData JSON配置数据
     * @returns BuildInfo对象
     */
    public static createBuildInfoFromConfig(configData: BuildingConfigData): BuildInfo {
        const buildInfo = new BuildInfo();
        this.mapConfigToBuildInfo(configData, buildInfo);
        return buildInfo;
    }
    
    /**
     * 加载所有建筑配置并转换为BuildInfo数组
     * @returns Promise<BuildInfo[] | null>
     */
    public static async loadAllBuildings(): Promise<BuildInfo[] | null> {
        const config = await this.loadBuildingConfig();
        if (!config) {
            console.error('loadAllBuildings: config为null');
            return null;
        }
        
        if (!config.buildings) {
            console.error('loadAllBuildings: config.buildings为null或undefined');
            console.log('config内容:', config);
            return null;
        }
        
        console.log(`loadAllBuildings: 找到${config.buildings.length}个建筑配置`);
        
        const buildInfos: BuildInfo[] = [];
        
        for (let i = 0; i < config.buildings.length; i++) {
            const buildingData = config.buildings[i];
            console.log(`处理建筑配置[${i}]:`, buildingData.name);
            
            try {
                const buildInfo = this.createBuildInfoFromConfig(buildingData);
                buildInfos.push(buildInfo);
                console.log(`成功创建BuildInfo: ${buildingData.name}`);
            } catch (error) {
                console.error(`创建BuildInfo失败 [${buildingData.name}]:`, error);
            }
        }
        
        console.log(`loadAllBuildings: 成功创建${buildInfos.length}个BuildInfo对象`);
        return buildInfos;
    }
    
    /**
     * 根据建筑名称查找配置
     * @param buildingName 建筑名称
     * @returns Promise<BuildInfo | null>
     */
    public static async findBuildingByName(buildingName: string): Promise<BuildInfo | null> {
        const config = await this.loadBuildingConfig();
        if (!config || !config.buildings) {
            return null;
        }
        
        const buildingData = config.buildings.find(building => building.name === buildingName);
        if (!buildingData) {
            return null;
        }
        
        return this.createBuildInfoFromConfig(buildingData);
    }
    
    /**
     * 根据建筑类型查找配置
     * @param buildingType 建筑类型
     * @returns Promise<BuildInfo[]>
     */
    public static async findBuildingsByType(buildingType: string): Promise<BuildInfo[]> {
        const config = await this.loadBuildingConfig();
        if (!config || !config.buildings) {
            return [];
        }
        
        const buildInfos: BuildInfo[] = [];
        const filteredBuildings = config.buildings.filter(building => building.type === buildingType);
        
        for (const buildingData of filteredBuildings) {
            const buildInfo = this.createBuildInfoFromConfig(buildingData);
            buildInfos.push(buildInfo);
        }
        
        return buildInfos;
    }
}