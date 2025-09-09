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
     */
    generateTourist(startPointName?: string, skinName?: string): Node | null {
        if (!this.touristPrefab) {
            console.error('游客预制体未设置');
            return null;
        }
        
        const navigationSystem = NavigationSystem.getInstance();
        if (!navigationSystem) {
            console.error('导航系统未初始化');
            return null;
        }
        
        // 确定起点
        let finalStartPoint = startPointName;
        if (!finalStartPoint) {
            finalStartPoint = navigationSystem.getRandomNavigationPointName();
        }
        
        if (!finalStartPoint || !navigationSystem.hasNavigationPoint(finalStartPoint)) {
            console.error('无效的起点:', finalStartPoint);
            return null;
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
        const startPosition = navigationSystem.getNavigationPointPosition(finalStartPoint);
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
        
        // 增加游客计数
        this.currentTouristCount++;
        
        // 监听游客销毁事件
        touristNode.on(Node.EventType.NODE_DESTROYED, () => {
            this.currentTouristCount--;
        });
        

        
        return touristNode;
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