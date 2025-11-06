import { _decorator, Component, Node, Prefab, instantiate, Vec3, sp, CCString, tween, director } from 'cc';
import { TouristController } from './TouristController';
import { TopBarManager } from '../UI面板/TopBarManager';
import { TileEditorTool } from '../工具/TileEditorTool';
const { ccclass, property } = _decorator;

/**
 * 游客生成系统
 * 根据客流量数值生成对应数量的游客，实现游客到达终点后逐渐隐藏消失的功能
 */
@ccclass('TouristGenerator')
export class TouristGenerator extends Component {
    
    // 静态实例引用，方便其他系统调用
    private static instance: TouristGenerator = null;
    
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
     * 地图容器（包含所有 Tile_x_y 子节点）
     */
    @property({ type: Node, tooltip: '地图容器（包含所有 Tile_* 节点）' })
    mapContainer: Node | null = null;
    
    /**
     * 自动生成游客（基于客流量）
     */
    @property
    autoGenerate: boolean = true;
    
    /**
     * 基础生成间隔（秒）- 客流量为1时的生成间隔
     */
    @property
    baseGenerateInterval: number = 2.0;
    
    /**
     * 最大游客数量
     */
    @property
    maxTourists: number = 50;
    
    /**
     * 客流量倍率 - 每点客流量对应的游客生成速率倍数
     */
    @property
    trafficFlowMultiplier: number = 1.0;
    
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
    
    onLoad() {
        // 设置静态实例引用
        TouristGenerator.instance = this;
    }
    
    onDestroy() {
        // 清除静态实例引用
        if (TouristGenerator.instance === this) {
            TouristGenerator.instance = null;
        }
    }
    
    start() {
        if (!this.mapContainer) {
            this.mapContainer = this.findMapContainerNode() || this.node;
        }
    }
    
    update(deltaTime: number) {
        if (this.autoGenerate) {
            // 获取当前客流量
            const topBarManager = TopBarManager.getInstance();
            const currentTrafficFlow = topBarManager ? topBarManager.getCurrentTrafficFlow() : 0;
            
            // 计算目标游客数量（客流量就是目标游客数量）
            const targetTouristCount = Math.min(currentTrafficFlow, this.maxTourists);
            
            // 如果当前游客数量少于目标数量，生成新游客
            if (this.currentTouristCount < targetTouristCount) {
                this.generateTimer += deltaTime;
                
                // 使用较短的间隔来快速补充游客到目标数量
                const quickGenerateInterval = this.baseGenerateInterval; // 2秒间隔快速生成
                
                if (this.generateTimer >= quickGenerateInterval) {
                    this.generateTimer = 0;
                    this.generateRandomTourist();
                }
            }
        }
    }
    
    /**
     * 根据客流量计算游客生成间隔
     * @param trafficFlow 当前客流量
     * @returns 生成间隔（秒）
     */
    private calculateGenerateInterval(trafficFlow: number): number {
        if (trafficFlow <= 0) {
            return Infinity; // 客流量为0时不生成游客
        }
        
        // 客流量越高，生成间隔越短
        const interval = this.baseGenerateInterval / (trafficFlow * this.trafficFlowMultiplier);
        return Math.max(0.1, interval); // 最小间隔0.1秒
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

        const tileTool = this.getTileEditorTool();
        if (!tileTool && !this.useNodeArrayMode) {
            console.error('未找到 TileEditorTool，且未启用节点数组模式');
            return null;
        }
        
        let finalStartPoint = startPointName;
        let finalTargetPoint = targetPointName;
        let startPosition: Vec3 | null = null;

        // 优先：在 TileEditorTool.scenicEntranceNodes 处生成
        const scenicEntranceNodes = this.getScenicEntranceNodes();
        if (!finalStartPoint && scenicEntranceNodes.length > 0) {
            const randomIndex = Math.floor(Math.random() * scenicEntranceNodes.length);
            const entranceNode = scenicEntranceNodes[randomIndex];
            if (entranceNode && entranceNode.isValid) {
                startPosition = entranceNode.getWorldPosition();
                // 将当前点设为距离入口最近的 TileEditorTool 导航点名称
                if (tileTool) {
                    finalStartPoint = tileTool.findNearestNavigationPointName(startPosition) || tileTool.getRandomNavigationPointName(true);
                }
            }
        }
        
        // 如果没有景区入口或未能获取有效起点，则按原逻辑选择
        if (!finalStartPoint) {
            if (this.useNodeArrayMode) {
                const result = this.selectStartAndTargetFromNodes(finalStartPoint, finalTargetPoint);
                if (!result) {
                    return null;
                }
                finalStartPoint = result.startPoint;
                finalTargetPoint = result.targetPoint;
                console.log(`[TouristGenerator] 生成游客: 起点=${finalStartPoint}, 终点=${finalTargetPoint}`);
            } else {
                // 使用 TileEditorTool 的导航点
                finalStartPoint = tileTool ? tileTool.getRandomNavigationPointName(true) : null;
            }
        }

        // 校验起点
        if (!finalStartPoint || (tileTool && !tileTool.hasNavigationPoint(finalStartPoint))) {
            console.error('无效的起点:', finalStartPoint);
            return null;
        }
        
        // 实例化游客
        const touristNode = instantiate(this.touristPrefab);
        if (!touristNode) {
            console.error('实例化游客失败');
            return null;
        }
        
        // 初始父节点：根据起点对应的 Tile 将游客挂到 MapContainer 下的具体 Tile
        const startTileName = this.getTileNameForPoint(finalStartPoint, tileTool);
        const startTileNode = this.getTileNodeByName(startTileName);
        if (startTileNode) {
            touristNode.setParent(startTileNode, true);
        } else if (this.mapContainer) {
            touristNode.setParent(this.mapContainer, true);
        } else {
            touristNode.setParent(this.node);
        }
        
        // 设置起始位置
        if (!startPosition) {
            if (this.useNodeArrayMode) {
                startPosition = this.getNodePositionByName(finalStartPoint);
            } else {
                startPosition = tileTool ? tileTool.getNavigationPointPosition(finalStartPoint) : null;
            }
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
        
        // 设置起点（若使用景区入口，则已转换为最近的导航点名称）
        touristController.setCurrentPoint(finalStartPoint);
        // 将 MapContainer 传递给控制器用于中途换挂载
        touristController.mapContainer = this.mapContainer;
        
        // 如果有目标点，设置目标点并添加到达回调；否则随机一个与起点不同的目标
        if (finalTargetPoint) {
            touristController.setTargetDestination(finalTargetPoint);
            this.setupTouristArrivalCallback(touristController, touristNode);
        } else {
            const entrances = tileTool ? tileTool.getEntrancePointNames(true) : [];
            const candidates = entrances.filter(n => n !== finalStartPoint);
            if (candidates.length > 0) {
                const idx = Math.floor(Math.random() * candidates.length);
                touristController.setTargetDestination(candidates[idx]);
                this.setupTouristArrivalCallback(touristController, touristNode);
            } else if (tileTool) {
                const anyEntrance = tileTool.getRandomEntranceName(finalStartPoint);
                if (anyEntrance) {
                    touristController.setTargetDestination(anyEntrance);
                    this.setupTouristArrivalCallback(touristController, touristNode);
                }
            }
        }
        
        // 增加游客计数
        this.currentTouristCount++;
        
        // 监听游客销毁事件
        touristNode.on(Node.EventType.NODE_DESTROYED, () => {
            this.currentTouristCount--;
        });
        
        // 如果最终没有分配到目标点，则逐渐隐藏并消失
        try {
            const dest = touristController.getTargetDestination();
            if (!dest) {
                this.hideTouristGradually(touristNode);
            }
        } catch {}
        
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

    /** 根据导航点名称获取应挂载的 Tile 名称（入口映射为其相邻Tile） */
    private getTileNameForPoint(pointName: string, tileTool?: TileEditorTool | null): string | null {
        if (!pointName) return null;
        if (/^Tile_\d+_\d+$/i.test(pointName)) return pointName;
        if (tileTool && tileTool.isEntrancePointName(pointName)) {
            const adj = tileTool.getAdjacentPoints(pointName) || [];
            const tileAdj = adj.find(n => /^Tile_\d+_\d+$/i.test(n));
            return tileAdj || null;
        }
        return null;
    }

    /** 在 MapContainer 下通过名称获取 Tile 节点 */
    private getTileNodeByName(tileName: string | null): Node | null {
        if (!tileName || !this.mapContainer) return null;
        const direct = this.mapContainer.getChildByName(tileName);
        if (direct) return direct;
        for (const c of this.mapContainer.children) {
            if (c.name === tileName) return c;
        }
        return null;
    }

    /** 尝试在场景中查找名为 MapContainer 的节点 */
    private findMapContainerNode(): Node | null {
        try {
            const scene = director.getScene();
            if (!scene) return null;
            let candidate: Node | null = scene.getChildByName('MapContainer');
            if (candidate) return candidate;
            const stack: Node[] = [scene];
            while (stack.length > 0) {
                const n = stack.pop()!;
                for (const c of n.children) {
                    if (c.name === 'MapContainer') return c;
                    stack.push(c);
                }
            }
            return null;
        } catch {
            return null;
        }
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

    /** 从场景中获取 TileEditorTool 的 scenicEntranceNodes 列表 */
    private getScenicEntranceNodes(): Node[] {
        const result: Node[] = [];
        try {
            const scene = director.getScene();
            if (!scene) return result;
            const tools = scene.getComponentsInChildren(TileEditorTool) || [];
            for (const tool of tools) {
                if (!tool) continue;
                const arr = tool.scenicEntranceNodes || [];
                for (const n of arr) {
                    if (n && n.isValid) result.push(n);
                }
            }
        } catch (e) {
            console.warn('获取景区入口节点失败:', e);
        }
        return result;
    }

    /** 获取场景中的第一个 TileEditorTool */
    private getTileEditorTool(): TileEditorTool | null {
        try {
            const scene = director.getScene();
            if (!scene) return null;
            const tools = scene.getComponentsInChildren(TileEditorTool) || [];
            return tools.length > 0 ? tools[0] : null;
        } catch {
            return null;
        }
    }

    /** 通过世界坐标查找最近的导航点名称 */
    private findNearestNavigationPointName(worldPos: Vec3): string | null {
        const tool = this.getTileEditorTool();
        if (!tool) return null;
        return tool.findNearestNavigationPointName(worldPos, true);
    }
    
    /**
     * 生成随机游客
     */
    generateRandomTourist(): Node | null {
        return this.generateTourist();
    }
    
    /**
     * 设置游客到达终点的回调
     * @param touristController 游客控制器
     * @param touristNode 游客节点
     */
    private setupTouristArrivalCallback(touristController: TouristController, touristNode: Node): void {
        // 定期检查游客是否到达终点
        const checkArrival = () => {
            if (!touristNode.isValid) {
                return;
            }
            
            const currentPoint = touristController.getCurrentPoint();
            const targetDestination = touristController.getTargetDestination();
            
            // 检查是否到达最终目标点且不在移动状态
            if (currentPoint === targetDestination && 
                !touristController.getIsMoving() && 
                !touristController.getIsStaying()) {
                
                console.log(`游客到达终点: ${targetDestination}，重新选择新目标点`);
                this.assignNewTargetToTourist(touristController);
                
                // 继续检查下一个目标点
                this.scheduleOnce(checkArrival, 2.0); // 给游客一些时间开始移动到新目标
                return;
            }
            
            // 如果还没到达，继续检查
            this.scheduleOnce(checkArrival, 0.5);
        };
        
        // 延迟开始检查，给游客一些时间开始移动
        this.scheduleOnce(checkArrival, 1.0);
    }
    
    /**
     * 为游客分配新的目标点
     * @param touristController 游客控制器
     */
    private assignNewTargetToTourist(touristController: TouristController): void {
        const currentPoint = touristController.getCurrentPoint();
        let newTarget: string | null = null;
        
        if (this.useNodeArrayMode) {
            // 使用节点数组模式选择新目标
            const validNodeNames = this.getValidNodeNames();
            const availableTargets = validNodeNames.filter(name => name !== currentPoint);
            
            if (availableTargets.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableTargets.length);
                newTarget = availableTargets[randomIndex];
            }
        } else {
            // 使用 TileEditorTool 选择新目标
            const tileTool = this.getTileEditorTool();
            if (tileTool) {
                const allPoints = tileTool.getAllNavigationPointNames();
                const availableTargets = allPoints.filter(name => name !== currentPoint && tileTool.isNavigationPointWalkable(name));
                if (availableTargets.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableTargets.length);
                    newTarget = availableTargets[randomIndex];
                }
            }
        }
        
        if (newTarget) {
            console.log(`游客从 ${currentPoint} 前往新目标: ${newTarget}`);
            touristController.setTargetDestination(newTarget);
        } else {
            console.warn(`无法为游客找到新的目标点，当前位置: ${currentPoint}`);
            this.hideTouristGradually(touristController.node);
        }
    }
    
    /**
     * 让游客逐渐隐藏并消失
     * @param touristNode 游客节点
     */
    private hideTouristGradually(touristNode: Node): void {
        if (!touristNode.isValid) {
            return;
        }
        
        // 创建渐隐动画
        tween(touristNode)
            .to(2.0, { 
                scale: new Vec3(0.1, 0.1, 1),
                position: new Vec3(
                    touristNode.position.x,
                    touristNode.position.y + 50, // 向上飘移
                    touristNode.position.z
                )
            }, {
                easing: 'sineOut'
            })
            .call(() => {
                // 动画完成后销毁节点
                if (touristNode.isValid) {
                    touristNode.destroy();
                }
            })
            .start();
            
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
     * 设置基础生成间隔
     */
    setBaseGenerateInterval(interval: number): void {
        this.baseGenerateInterval = interval;
    }
    
    /**
     * 设置客流量倍率
     */
    setTrafficFlowMultiplier(multiplier: number): void {
        this.trafficFlowMultiplier = multiplier;
    }
    
    /**
     * 获取当前有效的生成间隔
     */
    getCurrentGenerateInterval(): number {
        const topBarManager = TopBarManager.getInstance();
        const currentTrafficFlow = topBarManager ? topBarManager.getCurrentTrafficFlow() : 0;
        return this.calculateGenerateInterval(currentTrafficFlow);
    }
    

    
    /**
     * 静态方法：获取TouristGenerator实例
     * @returns TouristGenerator实例，如果不存在则返回null
     */
    public static getInstance(): TouristGenerator | null {
        return TouristGenerator.instance;
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
    
    
}