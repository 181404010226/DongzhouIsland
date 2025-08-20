import { _decorator, Component } from 'cc';
import { BuildingsInterface } from '../InterfaceManager/BuildingsInterface';
const { ccclass, property } = _decorator;

/**
 * 建筑配置测试脚本
 * 用于调试BuildingsInterface的加载问题
 */
@ccclass('BuildingConfigTest')
export class BuildingConfigTest extends Component {
    
    start() {
        this.testBuildingConfigLoad();
    }
    
    /**
     * 测试建筑配置加载
     */
    private async testBuildingConfigLoad() {
        console.log('=== 开始测试建筑配置加载 ===');
        
        try {
            // 测试loadBuildingConfig方法
            console.log('1. 测试 loadBuildingConfig...');
            const config = await BuildingsInterface.loadBuildingConfig();
            
            if (config) {
                console.log('✅ loadBuildingConfig 成功');
                console.log('配置数据:', config);
                console.log('建筑数量:', config.buildings ? config.buildings.length : 0);
                console.log('版本:', config.version);
                console.log('导出时间:', config.exportTime);
                
                // 测试loadAllBuildings方法
                console.log('\n2. 测试 loadAllBuildings...');
                const buildInfos = await BuildingsInterface.loadAllBuildings();
                
                if (buildInfos && buildInfos.length > 0) {
                    console.log('✅ loadAllBuildings 成功');
                    console.log('BuildInfo数量:', buildInfos.length);
                    
                    // 打印每个BuildInfo的详细信息
                    buildInfos.forEach((buildInfo, index) => {
                        console.log(`BuildInfo[${index}]:`, {
                            name: buildInfo.getBuildingName(),
                            type: buildInfo.getType(),
                            size: `${buildInfo.getWidth()}x${buildInfo.getHeight()}`,
                            unlockPopularity: buildInfo.getUnlockPopularity(),
                            image: buildInfo.getImage()
                        });
                    });
                } else {
                    console.error('❌ loadAllBuildings 返回空数据');
                }
                
            } else {
                console.error('❌ loadBuildingConfig 返回 null');
            }
            
        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error);
        }
        
        console.log('=== 建筑配置加载测试结束 ===');
    }
    
    /**
     * 手动触发测试（可在编辑器中调用）
     */
    public manualTest() {
        this.testBuildingConfigLoad();
    }
}