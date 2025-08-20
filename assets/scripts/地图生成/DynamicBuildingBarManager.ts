import { _decorator, Component, Node, EventTouch, input, Input, Vec2, Vec3, UITransform, instantiate, Prefab, Layout, Size } from 'cc';
import { BuildInfo } from './BuildInfo';
import { BuildingPlacer } from './BuildingPlacer';
import { PlayerOperationState, PlayerOperationType } from '../交互管理/PlayerOperationState';
import { BuildingsInterface } from '../InterfaceManager/BuildingsInterface';
import { BuildingPrefabMapper } from './BuildingPrefabMapper';

const { ccclass, property } = _decorator;

/**
 * 动态建筑栏管理器
 * 根据配置文件动态生成建筑节点，支持预制体映射和固定预览尺寸
 */
@ccclass('DynamicBuildingBarManager')
export class DynamicBuildingBarManager extends Component {
    @property({ type: Node, tooltip: '建筑栏容器节点' })
    buildingBarContainer: Node = null;
    
    @property({ type: BuildingPlacer, tooltip: '建筑放置器' })
    buildingPlacer: BuildingPlacer = null;
    
    @property({ type: [Prefab], tooltip: '建筑预制体数组，按尺寸命名(如Tile_1-1, Tile_2-2等)' })
    buildingPrefabs: Prefab[] = [];
    
    @property({ tooltip: '建筑栏中预览图标的固定宽度' })
    previewIconWidth: number = 150;
    
    @property({ tooltip: '建筑栏中预览图标的固定高度' })
    previewIconHeight: number = 150;
    
    @property({ tooltip: '建筑栏图标之间的间距' })
    iconSpacing: number = 10;
    
    // 私有变量
    private buildingNodes: Node[] = []; // 动态生成的建筑节点数组
    private currentSelectedIndex: number = -1; // 当前选中的建筑索引
    
    start() {
        this.initializePrefabMapping();
        this.loadAndCreateBuildingNodes();
        this.setupInputEvents();
    }
    
    /**
     * 初始化预制体映射
     */
    private initializePrefabMapping() {
        // 使用BuildingPrefabMapper来管理预制体映射
        BuildingPrefabMapper.initializePrefabMap(this.buildingPrefabs);
        
        // 打印映射信息（调试用）
        if (this.buildingPrefabs.length > 0) {
            BuildingPrefabMapper.printMappingInfo();
            
            // 验证映射完整性
            const validation = BuildingPrefabMapper.validateMapping();
            if (!validation.isValid) {
                console.warn('预制体映射验证失败:');
                if (validation.missingPrefabs.length > 0) {
                    console.warn('缺失的预制体:', validation.missingPrefabs);
                }
                if (validation.invalidPrefabs.length > 0) {
                    console.warn('无效的预制体:', validation.invalidPrefabs);
                }
            }
        }
    }
    
    /**
     * 加载建筑配置并创建建筑节点
     */
    private async loadAndCreateBuildingNodes() {
        try {
            const buildInfos = await BuildingsInterface.loadAllBuildings();
            if (!buildInfos || buildInfos.length === 0) {
                console.warn('没有加载到建筑配置数据');
                return;
            }
            
            console.log(`加载到 ${buildInfos.length} 个建筑配置`);
            
            // 清除现有的建筑节点
            this.clearBuildingNodes();
            
            // 为每个建筑配置创建节点
            for (const buildInfo of buildInfos) {
                const node = await this.createBuildingNode(buildInfo);
                if (node) {
                    this.buildingNodes.push(node);
                }
            }
            
            // 更新建筑栏布局
            this.updateBuildingBarLayout();
            
            console.log(`成功创建 ${this.buildingNodes.length} 个建筑节点`);
            
        } catch (error) {
            console.error('加载建筑配置失败:', error);
        }
    }
    
    /**
     * 创建单个建筑节点
     */
    private async createBuildingNode(buildInfo: BuildInfo): Promise<Node | null> {
        try {
            // 根据建筑尺寸获取对应的预制体
            const prefab = BuildingPrefabMapper.getPrefabBySize(buildInfo.getWidth(), buildInfo.getHeight());
            if (!prefab) {
                console.warn(`未找到尺寸为 ${buildInfo.getWidth()}x${buildInfo.getHeight()} 的预制体`);
                return null;
            }
            
            // 实例化预制体
            const node = instantiate(prefab);
            if (!node) {
                console.error('实例化预制体失败');
                return null;
            }
            
            // 获取节点上的BuildInfo组件并复制配置数据
            const nodeBuildInfo = node.getComponent(BuildInfo);
            if (nodeBuildInfo) {
                nodeBuildInfo.copyFrom(buildInfo);
                
                // 设置建筑预制体引用（用于放置时实例化）
                nodeBuildInfo.setBuildingPrefab(prefab);
            } else {
                console.warn('预制体节点缺少BuildInfo组件');
                return null;
            }
            
            // 设置节点名称
            node.name = `Building_${buildInfo.getBuildingName()}`;
            
            // 设置为建筑栏容器的子节点
            if (this.buildingBarContainer) {
                node.parent = this.buildingBarContainer;
            }
            
            // 调整节点尺寸为固定的预览尺寸
            this.adjustNodeSizeForPreview(node);
            
            // 让BuildInfo负责加载并设置建筑图片
            const imageLoaded = await nodeBuildInfo.loadAndSetImage(node);
            if (!imageLoaded) {
                console.warn(`建筑图片加载失败: ${buildInfo.getBuildingName()}`);
            }
            
            console.log(`创建建筑节点: ${buildInfo.getBuildingName()} (${buildInfo.getWidth()}x${buildInfo.getHeight()})`);
            
            return node;
            
        } catch (error) {
            console.error('创建建筑节点失败:', error);
            return null;
        }
    }
    
    /**
     * 调整节点尺寸为预览尺寸
     */
    private adjustNodeSizeForPreview(node: Node) {
        const uiTransform = node.getComponent(UITransform);
        if (uiTransform) {
            // 设置为固定的预览尺寸
            uiTransform.setContentSize(new Size(this.previewIconWidth, this.previewIconHeight));
            
            // 递归调整子节点的缩放以适应预览尺寸
            this.adjustChildNodesScale(node);
        }
    }
    
    /**
     * 递归调整子节点缩放
     */
    private adjustChildNodesScale(node: Node) {
        for (const child of node.children) {
            const childUITransform = child.getComponent(UITransform);
            if (childUITransform) {
                // 计算缩放比例以适应预览尺寸
                const originalSize = childUITransform.contentSize;
                const scaleX = this.previewIconWidth / originalSize.width;
                const scaleY = this.previewIconHeight / originalSize.height;
                const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
                
                child.setScale(scale, scale, 1);
            }
            
            // 递归处理子节点
            this.adjustChildNodesScale(child);
        }
    }
    

    
    /**
     * 更新建筑栏布局
     */
    private updateBuildingBarLayout() {
        if (!this.buildingBarContainer) {
            return;
        }
        
        // 检查是否有Layout组件，如果没有则手动排列
        const layout = this.buildingBarContainer.getComponent(Layout);
        if (layout) {
            layout.updateLayout();
        } else {
            // 手动水平排列建筑节点
            let currentX = 0;
            for (let i = 0; i < this.buildingNodes.length; i++) {
                const node = this.buildingNodes[i];
                node.setPosition(currentX, 0, 0);
                currentX += this.previewIconWidth + this.iconSpacing;
            }
        }
    }
    
    /**
     * 清除所有建筑节点
     */
    private clearBuildingNodes() {
        for (const node of this.buildingNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.buildingNodes = [];
        this.currentSelectedIndex = -1;
    }
    
    /**
     * 设置输入事件
     */
    private setupInputEvents() {
        input.on(Input.EventType.TOUCH_START, this.onGlobalTouchStart, this);
    }
    
    /**
     * 移除输入事件
     */
    private removeInputEvents() {
        input.off(Input.EventType.TOUCH_START, this.onGlobalTouchStart, this);
    }
    
    /**
     * 全局触摸开始事件
     */
    private onGlobalTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        
        // 遍历所有建筑节点，检查点击位置
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            if (this.isPointInNode(touchPos, node)) {
                this.onBuildingNodeTouched(i, event);
                break; // 找到第一个匹配的节点就停止
            }
        }
    }
    
    /**
     * 检查点是否在节点范围内
     */
    private isPointInNode(screenPos: Vec2, node: Node): boolean {
        if (!node || !node.active) {
            return false;
        }
        
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }
        
        // 将屏幕坐标转换为节点的本地坐标
        const worldPos = new Vec3(screenPos.x, screenPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        
        const size = uiTransform.contentSize;
        return Math.abs(localPos.x) <= size.width / 2 && Math.abs(localPos.y) <= size.height / 2;
    }
    
    /**
     * 建筑节点被触摸时的处理
     */
    private onBuildingNodeTouched(index: number, event: EventTouch) {
        if (!PlayerOperationState.isBuildingPlacementAllowed()) {
            console.log('当前操作状态不允许建筑操作');
            return;
        }
        
        const node = this.buildingNodes[index];
        const buildInfo = node.getComponent(BuildInfo);
        
        if (!buildInfo || !buildInfo.isEnabled()) {
            console.log('建筑不可用或已禁用');
            return;
        }
        
        // 选中当前建筑
        this.selectBuilding(index);
        
        // 传递BuildInfo给BuildingPlacer
        if (this.buildingPlacer) {
            this.buildingPlacer.setBuildingInfo(buildInfo, () => {
                this.onBuildingPlaced();
            });
        }
        
        console.log(`选中建筑: ${buildInfo.getBuildingName()} (${buildInfo.getType()})`);
    }
    
    /**
     * 选中建筑
     */
    private selectBuilding(index: number) {
        // 取消之前的选中状态
        if (this.currentSelectedIndex >= 0 && this.currentSelectedIndex < this.buildingNodes.length) {
            this.setBuildingNodeSelected(this.currentSelectedIndex, false);
        }
        
        // 设置新的选中状态
        this.currentSelectedIndex = index;
        this.setBuildingNodeSelected(index, true);
        
        // 设置操作状态
        const buildInfo = this.buildingNodes[index].getComponent(BuildInfo);
        PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT, {
            buildingType: buildInfo?.getType()
        });
    }
    
    /**
     * 设置建筑节点的选中状态（视觉反馈）
     */
    private setBuildingNodeSelected(index: number, selected: boolean) {
        if (index < 0 || index >= this.buildingNodes.length) {
            return;
        }
        
        const node = this.buildingNodes[index];
        const buildInfo = node.getComponent(BuildInfo);
        
        if (buildInfo) {
            buildInfo.setSelected(selected);
        }
        
        console.log(`建筑节点 ${node.name} ${selected ? '选中' : '取消选中'}`);
    }
    

    
    /**
     * 取消当前选中
     */
    public cancelSelection() {
        if (this.currentSelectedIndex >= 0) {
            this.setBuildingNodeSelected(this.currentSelectedIndex, false);
            this.currentSelectedIndex = -1;
        }
        
        // 通知BuildingPlacer清除建造信息
        if (this.buildingPlacer) {
            this.buildingPlacer.clearBuildingInfo();
        }
        
        // 重置操作状态
        PlayerOperationState.resetToIdle();
    }
    
    /**
     * 建筑放置完成后的回调
     */
    public onBuildingPlaced() {
        // 建筑放置完成后，取消选中状态
        this.cancelSelection();
    }
    
    /**
     * 重新加载建筑配置
     */
    public async reloadBuildings() {
        await this.loadAndCreateBuildingNodes();
    }
    
    /**
     * 获取当前选中的建筑节点
     */
    public getCurrentSelectedNode(): Node | null {
        if (this.currentSelectedIndex >= 0 && this.currentSelectedIndex < this.buildingNodes.length) {
            return this.buildingNodes[this.currentSelectedIndex];
        }
        return null;
    }
    
    /**
     * 获取建筑节点数组
     */
    public getBuildingNodes(): Node[] {
        return this.buildingNodes.slice();
    }
    
    /**
     * 设置建筑放置器
     */
    public setBuildingPlacer(placer: BuildingPlacer) {
        this.buildingPlacer = placer;
    }
    
    onDestroy() {
        this.removeInputEvents();
        this.clearBuildingNodes();
    }
}