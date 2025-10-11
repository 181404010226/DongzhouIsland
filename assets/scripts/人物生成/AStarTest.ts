import { _decorator, Component, Node, CCString } from 'cc';
import { NavigationSystem } from './NavigationSystem';
import { TouristGenerator } from './TouristGenerator';
const { ccclass, property } = _decorator;

/**
 * A*算法和游客系统测试组件
 */
@ccclass('AStarTest')
export class AStarTest extends Component {
    
    @property({ displayName: "起点名称" })
    startPointName: string = "";
    
    @property({ displayName: "终点名称" })
    endPointName: string = "";
    
    @property({ type: [CCString], readonly: true, tooltip: '测试结果信息' })
    private readonly testResults: string[] = [];
    
    @property(TouristGenerator)
    touristGenerator: TouristGenerator = null;
    
    start() {
        // 延迟执行测试，确保导航系统已初始化
        this.scheduleOnce(() => {
            this.runTests();
        }, 1.0);
    }
    
    /**
     * 运行所有测试
     */
    private runTests(): void {
        this.testResults.length = 0;
        this.testResults.push("=== A*算法和游客系统测试开始 ===");
        
        const navigationSystem = NavigationSystem.getInstance();
        if (!navigationSystem) {
            this.testResults.push("❌ 导航系统未初始化");
            return;
        }
        
        // 测试1: 基本A*路径查找
        this.testAStarPathfinding(navigationSystem);
        
        // 测试2: 游客生成和移动
        this.testTouristGeneration();
        
        // 测试3: 节点数组模式
        this.testNodeArrayMode();
        
        this.testResults.push("=== 测试完成 ===");
        console.log("A*测试结果:", this.testResults);
    }
    
    /**
     * 测试A*路径查找功能
     */
    private testAStarPathfinding(navigationSystem: NavigationSystem): void {
        this.testResults.push("\n--- 测试A*路径查找 ---");
        
        // 获取所有导航点
        const allPoints = navigationSystem.getAllNavigationPointNames();
        this.testResults.push(`可用导航点: ${allPoints.join(', ')}`);
        
        if (allPoints.length < 2) {
            this.testResults.push("❌ 导航点数量不足，无法测试路径查找");
            return;
        }
        
        // 使用指定的起点和终点，或随机选择
        let startPoint = this.startPointName;
        let endPoint = this.endPointName;
        
        if (!startPoint || !navigationSystem.hasNavigationPoint(startPoint)) {
            startPoint = allPoints[0];
        }
        
        if (!endPoint || !navigationSystem.hasNavigationPoint(endPoint)) {
            endPoint = allPoints[Math.min(1, allPoints.length - 1)];
        }
        
        this.testResults.push(`测试路径: ${startPoint} -> ${endPoint}`);
        
        // 执行A*路径查找
        const pathResult = navigationSystem.findPathAStar(startPoint, endPoint);
        
        if (pathResult.success) {
            this.testResults.push(`✅ 路径查找成功`);
            this.testResults.push(`路径: ${pathResult.path.join(' -> ')}`);
            this.testResults.push(`总代价: ${pathResult.totalCost.toFixed(2)}`);
        } else {
            this.testResults.push(`❌ 路径查找失败`);
        }
        
        // 测试简化接口
        const simplePath = navigationSystem.getPath(startPoint, endPoint);
        if (simplePath.length > 0) {
            this.testResults.push(`✅ 简化接口测试成功: ${simplePath.join(' -> ')}`);
        } else {
            this.testResults.push(`❌ 简化接口测试失败`);
        }
    }
    
    /**
     * 测试游客生成功能
     */
    private testTouristGeneration(): void {
        this.testResults.push("\n--- 测试游客生成 ---");
        
        if (!this.touristGenerator) {
            this.testResults.push("❌ 游客生成器未设置");
            return;
        }
        
        const initialCount = this.touristGenerator.getCurrentTouristCount();
        this.testResults.push(`初始游客数量: ${initialCount}`);
        
        // 生成一个测试游客
        const tourist = this.touristGenerator.generateRandomTourist();
        
        if (tourist) {
            this.testResults.push(`✅ 游客生成成功: ${tourist.name}`);
            
            const newCount = this.touristGenerator.getCurrentTouristCount();
            this.testResults.push(`当前游客数量: ${newCount}`);
            
            // 检查游客是否有TouristController组件
            const controller = tourist.getComponent('TouristController');
            if (controller) {
                this.testResults.push(`✅ 游客控制器组件已添加`);
            } else {
                this.testResults.push(`❌ 游客控制器组件缺失`);
            }
        } else {
            this.testResults.push(`❌ 游客生成失败`);
        }
    }
    
    /**
     * 测试节点数组模式
     */
    private testNodeArrayMode(): void {
        this.testResults.push("\n--- 测试节点数组模式 ---");
        
        if (!this.touristGenerator) {
            this.testResults.push("❌ 游客生成器未设置");
            return;
        }
        
        // 检查节点数组配置
        const validNodeNames = this.touristGenerator.getValidNodeNames();
        this.testResults.push(`有效节点数量: ${validNodeNames.length}`);
        this.testResults.push(`有效节点: ${validNodeNames.join(', ')}`);
        
        if (validNodeNames.length >= 2) {
            this.testResults.push(`✅ 节点数组配置正确，支持随机生成`);
        } else {
            this.testResults.push(`⚠️ 节点数组配置不足，需要至少2个节点`);
        }
    }
    
    /**
     * 手动触发测试（编辑器按钮）
     */
    @property({ displayName: "运行测试" })
    get runTestButton() {
        return false;
    }
    
    set runTestButton(value: boolean) {
        if (value) {
            this.runTests();
        }
    }
    
    /**
     * 清除测试结果
     */
    @property({ displayName: "清除结果" })
    get clearResultsButton() {
        return false;
    }
    
    set clearResultsButton(value: boolean) {
        if (value) {
            this.testResults.length = 0;
            this.testResults.push("测试结果已清除");
        }
    }
}