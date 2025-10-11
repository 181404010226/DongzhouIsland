import { _decorator, Component, Node, Prefab, instantiate, Vec3, sp, CCString } from 'cc';
import { NavigationSystem } from './NavigationSystem';
import { TouristController } from './TouristController';
const { ccclass, property } = _decorator;

/**
 * 游客生成系统
 * 接收人物预制体和起点名字，随机生成人物（修改预制体中spine骨骼组件的皮肤来生成不同的人物）
 */
@ccclass('TouristGenerator')
export class TouristGenerator extends Component {
    
    /**
     * 人物预制体
     */
    @property(Prefab)
    touristPrefab: Prefab = null;
    
    /**
     * 可用的皮肤名称列表
     */
    @property([CCString])
    availableSkins: string[] = [];
    
    /**
     * 生成的游客父节点
     */
    @property(Node)
    touristParent: Node = null;
    
    /**
     * 自动生成游客
     */
    @property
    autoGenerate: boolean = false;
    
    /**
     * 自动生成间隔（秒）
     */
    @property
    generateInterval: number = 5.0;
    
    /**
     * 最大游客数量
     */
    @property
    maxTourists: number = 20;
    
    /**
     * 游客生成节点数组（游客将在这些节点中随机选择起点和终点）
     */
    @property([Node])
    spawnNodes: Node[] = [];
    
    /**
     * 是否使用节点数组模式（如果为true，将使用spawnNodes数组；如果为false，使用导航系统的所有点）
     */
    @property
    useNodeArrayMode: boolean = false;
    
    /**
     * 当前游客数量
     */
    private currentTouristCount: number = 0;
    
    /**
     * 生成计时器
     */
    private generateTimer: number = 0;
    
    start() {
        if (!this.touristParent) {
            this.touristParent = this.node;
        }
    }
    
    update(deltaTime: number) {
        if (this.autoGenerate && this.currentTouristCount < this.maxTourists) {
            this.generateTimer += deltaTime;
            if (this.generateTimer >= this.generateInterval) {
                this.generateTimer = 0;
                this.generateRandomTourist();
            }
        }
    }
    
    /**
     * 生成游客
     * @param startPointName 起点名称，如果不指定则随机选择
     * @param skinName 皮肤名称，如果不指定则随机选择
     * @param targetPointName 目标点名称，如果不指定则随机选择
     */
    generateTourist(startPointName?: string, skinName?: string, targetPointName?: string): Node | null {
        if (!this.touristPrefab) {
            console.error('游客预制体未设置');
            return null;
        }
        
        const navigationSystem = NavigationSystem.getInstance();
        if (!navigationSystem) {
            console.error('导航系统未初始化');
            return null;
        }
        
        let finalStartPoint = startPointName;
        let finalTargetPoint = targetPointName;
        
        // 根据模式选择起点和终点
        if (this.useNodeArrayMode) {
            const result = this.selectStartAndTargetFromNodes(finalStartPoint, finalTargetPoint);
            if (!result) {
                return null;
            }
            finalStartPoint = result.startPoint;
            finalTargetPoint = result.targetPoint;
            console.log(`[TouristGenerator] 生成游客: 起点=${finalStartPoint}, 终点=${finalTargetPoint}`);
        } else {
            // 使用原有的导航系统逻辑
            if (!finalStartPoint) {
                finalStartPoint = navigationSystem.getRandomNavigationPointName();
            }
            
            if (!finalStartPoint || !navigationSystem.hasNavigationPoint(finalStartPoint)) {
                console.error('无效的起点:', finalStartPoint);
                return null;
            }
        }
        
        // 实例化游客
        const touristNode = instantiate(this.touristPrefab);
        if (!touristNode) {
            console.error('实例化游客失败');
            return null;
        }
        
        // 设置父节点
        touristNode.setParent(this.touristParent);
        
        // 设置起始位置
        let startPosition: Vec3;
        if (this.useNodeArrayMode) {
            startPosition = this.getNodePositionByName(finalStartPoint);
        } else {
            startPosition = navigationSystem.getNavigationPointPosition(finalStartPoint);
        }
        
        if (startPosition) {
            touristNode.setWorldPosition(startPosition);
        }
        
        // 设置皮肤
        this.setTouristSkin(touristNode, skinName);
        
        // 添加游客控制器组件
        let touristController = touristNode.getComponent(TouristController);
        if (!touristController) {
            touristController = touristNode.addComponent(TouristController);
        }
        
        // 设置起点
        touristController.setCurrentPoint(finalStartPoint);
        
        // 如果有目标点，设置目标点
        if (finalTargetPoint) {
            touristController.setTargetDestination(finalTargetPoint);
        }
        
        // 增加游客计数
        this.currentTouristCount++;
        
        // 监听游客销毁事件
        touristNode.on(Node.EventType.NODE_DESTROYED, () => {
            this.currentTouristCount--;
        });
        
        return touristNode;
    }
    
    /**
     * 从节点数组中选择起点和终点
     * @param preferredStart 首选起点
     * @param preferredTarget 首选终点
     * @returns 选择的起点和终点，如果失败返回null
     */
    private selectStartAndTargetFromNodes(preferredStart?: string, preferredTarget?: string): { startPoint: string, targetPoint: string } | null {
        if (!this.spawnNodes || this.spawnNodes.length < 2) {
            console.error('节点数组模式需要至少2个节点');
            return null;
        }
        
        // 获取所有有效节点名称
        const validNodeNames = this.spawnNodes
            .filter(node => node && node.isValid)
            .map(node => node.name);
            
        if (validNodeNames.length < 2) {
            console.error('有效节点数量不足，需要至少2个有效节点');
            return null;
        }
        
        let startPoint = preferredStart;
        let targetPoint = preferredTarget;
        
        // 选择起点
        if (!startPoint || !validNodeNames.includes(startPoint)) {
            const randomStartIndex = Math.floor(Math.random() * validNodeNames.length);
            startPoint = validNodeNames[randomStartIndex];
        }
        
        // 选择终点（确保与起点不同）
        if (!targetPoint || !validNodeNames.includes(targetPoint) || targetPoint === startPoint) {
            const availableTargets = validNodeNames.filter(name => name !== startPoint);
            if (availableTargets.length === 0) {
                console.error('无法找到与起点不同的终点');
                return null;
            }
            const randomTargetIndex = Math.floor(Math.random() * availableTargets.length);
            targetPoint = availableTargets[randomTargetIndex];
        }
        
        return { startPoint, targetPoint };
    }
    
    /**
     * 根据节点名称获取节点位置
     * @param nodeName 节点名称
     * @returns 节点的世界坐标，如果未找到返回null
     */
    private getNodePositionByName(nodeName: string): Vec3 | null {
        const node = this.spawnNodes.find(n => n && n.isValid && n.name === nodeName);
        if (node) {
            return node.getWorldPosition();
        }
        return null;
    }
    
    /**
     * 获取所有有效的节点名称
     * @returns 有效节点名称数组
     */
    getValidNodeNames(): string[] {
        if (!this.spawnNodes) {
            return [];
        }
        return this.spawnNodes
            .filter(node => node && node.isValid)
            .map(node => node.name);
    }
    
    /**
     * 生成随机游客
     */
    generateRandomTourist(): Node | null {
        return this.generateTourist();
    }
    
    /**
     * 设置游客皮肤
     * @param touristNode 游客节点
     * @param skinName 皮肤名称
     */
    private setTouristSkin(touristNode: Node, skinName?: string): void {
        // 查找Spine组件
        const spineComponent = touristNode.getComponent(sp.Skeleton);
        if (!spineComponent) {
            console.warn('游客节点未找到Spine组件');
            return;
        }
        
        // 确定皮肤名称
        let finalSkinName = skinName;
        if (!finalSkinName && this.availableSkins.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.availableSkins.length);
            finalSkinName = this.availableSkins[randomIndex];
        }
        
        // 设置皮肤
        if (finalSkinName) {
            try {
                spineComponent.setSkin(finalSkinName);

            } catch (error) {
                console.error(`设置皮肤失败: ${finalSkinName}`, error);
            }
        }
    }
    
    /**
     * 清除所有游客
     */
    clearAllTourists(): void {
        if (this.touristParent) {
            this.touristParent.children.forEach(child => {
                const touristController = child.getComponent(TouristController);
                if (touristController) {
                    child.destroy();
                }
            });
        }
        this.currentTouristCount = 0;
    }
    
    /**
     * 获取当前游客数量
     */
    getCurrentTouristCount(): number {
        return this.currentTouristCount;
    }
    
    /**
     * 设置最大游客数量
     */
    setMaxTourists(count: number): void {
        this.maxTourists = count;
    }
    
    /**
     * 设置自动生成状态
     */
    setAutoGenerate(enabled: boolean): void {
        this.autoGenerate = enabled;
    }
    
    /**
     * 设置生成间隔
     */
    setGenerateInterval(interval: number): void {
        this.generateInterval = interval;
    }
    
    /**
     * 手动生成按钮（编辑器用）
     */
    @property({ displayName: "生成游客" })
    get generateTouristButton() {
        return false;
    }
    
    set generateTouristButton(value: boolean) {
        if (value) {
            this.generateRandomTourist();
        }
    }
    
    /**
     * 清除游客按钮（编辑器用）
     */
    @property({ displayName: "清除所有游客" })
    get clearTouristsButton() {
        return false;
    }
    
    set clearTouristsButton(value: boolean) {
        if (value) {
            this.clearAllTourists();
        }
    }
}