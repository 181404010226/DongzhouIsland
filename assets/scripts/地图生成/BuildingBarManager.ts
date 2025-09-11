import { _decorator, Component, Node, Vec2, Vec3, UITransform, instantiate, Prefab, Layout, Size, Sprite, Camera, Widget, Canvas } from 'cc';
import { BuildInfo } from './BuildInfo';
import { BuildingPlacer } from './BuildingPlacer';
import { PlayerOperationState, PlayerOperationType } from '../交互管理/PlayerOperationState';
import { BuildingsInterface } from '../InterfaceManager/BuildingsInterface';
import { CustomScrollView } from '../交互管理/CustomScrollView';


const { ccclass, property } = _decorator;

/**
 * 动态建筑栏管理器
 * 根据配置文件动态生成建筑节点，支持预制体映射和固定预览尺寸
 */
@ccclass('BuildingBarManager')
export class DynamicBuildingBarManager extends Component {
    @property({ type: Node, tooltip: '建筑栏容器节点' })
    buildingBarContainer: Node = null;
    
    @property({ type: BuildingPlacer, tooltip: '建筑放置器' })
    buildingPlacer: BuildingPlacer = null;
    
    @property({ type: CustomScrollView, tooltip: '自定义滚动视图组件' })
    customScrollView: CustomScrollView = null;
    
    @property({ type: Prefab, tooltip: '建造栏统一使用的建筑预制体(Building.prefab)' })
    buildingBarPrefab: Prefab = null;
    
    @property({ type: [Prefab], tooltip: '地图放置用的建筑预制体数组，按尺寸命名(如Tile_1-1, Tile_2-2等)' })
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
    private camera: Camera = null; // 摄像机组件
    
    start() {
        // 查找摄像机
        this.findCamera();
        
        this.initializePrefabMapping();
        this.loadAndCreateBuildingNodes();
        this.setupInputEvents();
        
        // 初始化自定义滚动视图
        if (this.customScrollView) {
            this.customScrollView.scrollView = this.buildingBarContainer;
        }
    }
    
    /**
     * 查找场景中的摄像机
     */
    private findCamera() {
        // 查找场景中的主摄像机
        const canvas = this.node.scene.getComponentInChildren(Canvas);
        if (canvas && canvas.cameraComponent) {
            this.camera = canvas.cameraComponent;
            console.log('DynamicBuildingBarManager找到Canvas摄像机');
        } else {
            // 如果没找到Canvas摄像机，查找场景中的第一个摄像机
            const cameraNode = this.node.scene.getComponentInChildren(Camera);
            if (cameraNode) {
                this.camera = cameraNode;
                console.log('DynamicBuildingBarManager找到场景摄像机');
            }
        }
        
        if (!this.camera) {
            console.warn('DynamicBuildingBarManager未找到摄像机，触摸检测可能无法正常工作');
        }
    }
    
    // 预制体映射表：key为"宽度-高度"，value为预制体
    private prefabMap: Map<string, Prefab> = new Map();
    
    /**
     * 初始化预制体映射
     */
    private initializePrefabMapping() {
        try {
            this.prefabMap.clear();
            
            for (const prefab of this.buildingPrefabs) {
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
        } catch (error) {
            console.error('初始化预制体映射失败:', error);
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
        
        // 重置到左边界对齐位置
        this.resetToLeftBoundary();
        
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
            // 建造栏统一使用Building.prefab预制体
            if (!this.buildingBarPrefab) {
                console.warn('建造栏预制体(buildingBarPrefab)未设置');
                return null;
            }
            
            // 实例化Building.prefab预制体
            const node = instantiate(this.buildingBarPrefab);
            if (!node) {
                console.error('实例化预制体失败');
                return null;
            }
            
            // 获取节点上的BuildInfo组件并复制配置数据
            const nodeBuildInfo = node.getComponent(BuildInfo);
            if (nodeBuildInfo) {
                nodeBuildInfo.copyFrom(buildInfo);
                
                // 查找并设置Sprite组件引用
                const spriteNode = node.getChildByName('Sprite');
                if (spriteNode) {
                    const spriteComponent = spriteNode.getComponent(Sprite);
                    if (spriteComponent) {
                        nodeBuildInfo.buildingSprite = spriteComponent;
                    }
                }
                
                // 设置建筑预制体引用（用于放置时实例化，使用对应尺寸的Tile预制体）
                const tilePrefab = this.getPrefabBySize(buildInfo.getWidth(), buildInfo.getHeight());
                if (tilePrefab) {
                    nodeBuildInfo.setBuildingPrefab(tilePrefab);
                } else {
                    console.warn(`未找到尺寸为 ${buildInfo.getWidth()}x${buildInfo.getHeight()} 的Tile预制体，将使用Building.prefab`);
                    nodeBuildInfo.setBuildingPrefab(this.buildingBarPrefab);
                }
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
            
            // 确保节点的碰撞区域与视觉尺寸一致
            node.setScale(1, 1, 1);
            
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
     * 根据尺寸获取对应的预制体
     */
    private getPrefabBySize(width: number, height: number): Prefab | null {
        const key = `${width}-${height}`;
        const prefab = this.prefabMap.get(key);
        
        if (!prefab) {
            console.warn(`未找到尺寸为 ${width}x${height} 的预制体`);
            return null;
        }
        
        return prefab;
    }

    
    /**
     * 更新建筑栏布局
     */
    private updateBuildingBarLayout() {
        if (!this.buildingBarContainer) {
            return;
        }
        
        // 获取ScrollView/Layout的左边缘位置进行对齐
        let layoutLeftEdge = 0;
        
        // 尝试从父节点层级中找到Layout组件
        let parentNode = this.buildingBarContainer.parent;
        while (parentNode) {
            const layout = parentNode.getComponent(Layout);
            if (layout) {
                // 获取Layout组件的UITransform
                const layoutTransform = parentNode.getComponent(UITransform);
                if (layoutTransform) {
                    // 计算Layout的左边缘位置（世界坐标）
                    const layoutWorldPos = parentNode.worldPosition;
                    const layoutWidth = layoutTransform.width;
                    layoutLeftEdge = layoutWorldPos.x - layoutWidth / 2;
                    console.log(`[DynamicBuildingBarManager] 找到Layout组件，左边缘位置: ${layoutLeftEdge}`);
                }
                break;
            }
            parentNode = parentNode.parent;
        }
        
        // 检查buildingBarContainer本身是否有Layout组件
        const containerLayout = this.buildingBarContainer.getComponent(Layout);
        if (containerLayout) {
            // 禁用Layout组件以避免冲突
            containerLayout.enabled = false;
            
            // 如果没有从父节点找到Layout，使用容器自身的边缘
            if (layoutLeftEdge === 0) {
                const containerTransform = this.buildingBarContainer.getComponent(UITransform);
                if (containerTransform) {
                    const containerWorldPos = this.buildingBarContainer.worldPosition;
                    const containerWidth = containerTransform.width;
                    layoutLeftEdge = containerWorldPos.x - containerWidth / 2;
                    console.log(`[DynamicBuildingBarManager] 使用容器自身左边缘: ${layoutLeftEdge}`);
                }
            }
        }
        
        // 计算建筑节点的起始位置，让第一个建筑的左边缘与容器左边缘对齐
        const containerTransform = this.buildingBarContainer.getComponent(UITransform);
        let startX = this.previewIconWidth / 2; // 第一个建筑节点的中心点位置，使其左边缘在容器左边缘
        
        if (containerTransform && layoutLeftEdge !== 0) {
            // 计算容器相对于Layout左边缘的偏移
            const containerWorldPos = this.buildingBarContainer.worldPosition;
            const containerLeftEdge = containerWorldPos.x - containerTransform.width / 2;
            const offsetFromLayoutEdge = containerLeftEdge - layoutLeftEdge;
            
            // 调整起始位置，使第一个建筑的左边缘对齐到Layout左边缘
            // 建筑中心点 = Layout左边缘 + 建筑宽度的一半 + 容器偏移
            startX = this.previewIconWidth / 2 - offsetFromLayoutEdge;
            console.log(`[DynamicBuildingBarManager] 计算对齐偏移: 容器左边缘=${containerLeftEdge}, Layout左边缘=${layoutLeftEdge}, 偏移=${offsetFromLayoutEdge}, 起始X=${startX}`);
        } else {
            // 如果没有找到Layout组件，第一个建筑的左边缘与容器左边缘对齐
            // 建筑中心点在 previewIconWidth/2 位置，这样左边缘就在容器左边缘（0位置）
            startX = this.previewIconWidth / 2;
            console.log(`[DynamicBuildingBarManager] 未找到Layout组件，建筑左边缘与容器左边缘对齐，起始X=${startX}`);
        }
        
        // 手动水平排列建筑节点，从计算出的起始位置开始
        let currentX = startX;
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            node.setPosition(currentX, 0, 0);
            
            // 获取建筑信息用于调试
            const buildInfo = node.getComponent(BuildInfo);
            const buildingName = buildInfo ? buildInfo.getBuildingName() : 'Unknown';
            
            console.log(`[DynamicBuildingBarManager] 建筑节点 ${i} (${buildingName}) 对齐到Layout左边缘，位置: ${node.position.x}`);
            currentX += this.previewIconWidth + this.iconSpacing;
        }
        
        // 更新容器内容尺寸以支持滚动
        this.updateContainerContentSize();
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
     * 注意：输入事件现在由InteractionControl统一管理
     */
    private setupInputEvents() {
        // 输入事件现在由InteractionControl统一管理
        console.log('DynamicBuildingBarManager: 输入事件由InteractionControl统一管理');
    }
    
    /**
     * 移除输入事件
     * 注意：输入事件现在由InteractionControl统一管理
     */
    private removeInputEvents() {
        // 输入事件现在由InteractionControl统一管理
        console.log('DynamicBuildingBarManager: 移除输入事件监听');
    }
    
    /**
     * 检测是否点击了建筑栏区域（仅检测，不触发选择）
     */
    public isBuildingBarTouched(screenPos: Vec2): boolean {
        // 在触摸检测前，确保建筑栏布局是最新的（考虑滚动位置）
        this.updateBuildingBarLayout();
        
        // 遍历所有建筑节点，检查点击位置
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            if (this.isPointInNode(screenPos, node)) {
                return true; // 找到匹配的节点，返回true表示点击了建筑栏
            }
        }
        return false; // 没有找到匹配的节点
    }

    /**
     * 处理建筑栏触摸（由InteractionManager调用）
     */
    public handleBuildingBarTouch(screenPos: Vec2): boolean {
        console.log(`[建筑栏触摸] 开始检测触摸位置: (${screenPos.x}, ${screenPos.y})`);
        
        // 确保有建筑节点可以检测
        if (this.buildingNodes.length === 0) {
            console.log(`[建筑栏触摸] 没有建筑节点可供检测`);
            return false;
        }
        
        // 遍历所有建筑节点，检查点击位置
        for (let i = 0; i < this.buildingNodes.length; i++) {
            const node = this.buildingNodes[i];
            if (!node || !node.isValid || !node.active) {
                console.log(`[建筑栏触摸] 节点 ${i} 无效或未激活，跳过`);
                continue;
            }
            
            if (this.isPointInNode(screenPos, node)) {
                const buildInfo = node.getComponent(BuildInfo);
                const buildingName = buildInfo ? buildInfo.getBuildingName() : 'Unknown';
                console.log(`[建筑栏触摸] 匹配到建筑: 索引${i}, 名称${buildingName}`);
                this.onBuildingNodeTouched(i);
                return true; // 找到匹配的节点，返回true表示处理了触摸
            }
        }
        console.log(`[建筑栏触摸] 未找到匹配的建筑节点`);
        return false; // 没有找到匹配的节点
    }
    
    /**
     * 检查点是否在节点范围内
     * 计算节点在屏幕上的实际位置，直接与触摸点比较
     */
    private isPointInNode(screenPos: Vec2, node: Node): boolean {
        if (!node || !node.active) {
            return false;
        }
        
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }
        
        // 获取建筑名称用于调试
        const buildInfo = node.getComponent(BuildInfo);
        const buildingName = buildInfo ? buildInfo.getBuildingName() : 'Unknown';
        
        // 获取节点的屏幕位置（UI坐标）
        const nodeScreenPos = uiTransform.convertToWorldSpaceAR(Vec3.ZERO);
        
        // 使用固定的预览尺寸进行碰撞检测，而不是节点的实际尺寸
        // 这样可以确保触摸区域与视觉显示一致
        const halfWidth = this.previewIconWidth / 2;
        const halfHeight = this.previewIconHeight / 2;
        
        // 计算节点在屏幕坐标系中的边界
        const left = nodeScreenPos.x - halfWidth;
        const right = nodeScreenPos.x + halfWidth;
        const bottom = nodeScreenPos.y - halfHeight;
        const top = nodeScreenPos.y + halfHeight;
        
        // 检查X和Y坐标是否在范围内
        const xInRange = screenPos.x >= left && screenPos.x <= right;
        const yInRange = screenPos.y >= bottom && screenPos.y <= top;
        
        // 同时满足X和Y范围才算点击到节点
        const isInside = xInRange && yInRange;
        
        console.log(`[建筑栏触摸检测] 节点: ${node.name} (${buildingName})`);
        console.log(`  - 屏幕坐标: (${screenPos.x.toFixed(2)}, ${screenPos.y.toFixed(2)})`);
        console.log(`  - 节点屏幕位置: (${nodeScreenPos.x.toFixed(2)}, ${nodeScreenPos.y.toFixed(2)})`);
        console.log(`  - 使用固定预览尺寸: ${this.previewIconWidth.toFixed(2)}x${this.previewIconHeight.toFixed(2)}`);
        console.log(`  - X范围: [${left.toFixed(2)}, ${right.toFixed(2)}], X匹配: ${xInRange}`);
        console.log(`  - Y范围: [${bottom.toFixed(2)}, ${top.toFixed(2)}], Y匹配: ${yInRange}`);
        console.log(`  - 最终结果: ${isInside}`);
        
        return isInside;
    }
    
    /**
     * 建筑节点被触摸时的处理
     */
    private onBuildingNodeTouched(index: number) {
        if (!PlayerOperationState.isBuildingPlacementAllowed()) {
            console.log(`[建筑栏] 当前状态不允许建筑放置，操作被忽略`);
            return;
        }
        
        const node = this.buildingNodes[index];
        if (!node || !node.isValid) {
            console.log(`[建筑栏] 建筑节点无效，索引: ${index}`);
            return;
        }
        
        const buildInfo = node.getComponent(BuildInfo);
        
        if (!buildInfo || !buildInfo.isEnabled()) {
            console.log(`[建筑栏] 建筑信息无效或未启用，索引: ${index}`);
            return;
        }
        
        // 选中当前建筑
        this.selectBuilding(index);
        
        // 传递BuildInfo给BuildingPlacer
        if (this.buildingPlacer) {
            this.buildingPlacer.setBuildingInfo(buildInfo, () => {
                this.onBuildingPlaced();
            });
            
            // 设置操作状态为建筑放置
            PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT, {
                buildingType: buildInfo.getType()
            });
            
            console.log(`[建筑栏] 开始放置建筑: ${buildInfo.getBuildingName()} (${buildInfo.getType()})`);
        } else {
            console.log(`[建筑栏] 建筑放置器未设置，无法开始放置`);
        }
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
        // 建筑放置完成后，取消选中状态但不清除建筑信息
        if (this.currentSelectedIndex >= 0) {
            this.setBuildingNodeSelected(this.currentSelectedIndex, false);
            this.currentSelectedIndex = -1;
        }
        
        // 重置操作状态，但不调用clearBuildingInfo以保留已放置的建筑
        PlayerOperationState.resetToIdle();
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
    

    
    /**
     * 更新容器内容尺寸
     */
    private updateContainerContentSize() {
        if (!this.buildingBarContainer) {
            return;
        }
        
        const containerTransform = this.buildingBarContainer.getComponent(UITransform);
        if (!containerTransform) {
            return;
        }
        
        // 计算总宽度
        const totalWidth = this.buildingNodes.length * (this.previewIconWidth + this.iconSpacing) - this.iconSpacing;
        const height = this.previewIconHeight;
        
        // 设置容器内容尺寸
        containerTransform.setContentSize(new Size(Math.max(totalWidth, 0), height));
        
        console.log(`更新容器内容尺寸: ${totalWidth} x ${height}`);
    }
    

    
    /**
     * 处理建筑栏滚动移动 - 委托给CustomScrollView组件
     */
    public handleBuildingBarMove(deltaX: number, deltaY: number, speed: number) {
        if (this.customScrollView) {
            this.customScrollView.handleScrollMove(deltaX, deltaY, speed);
        }
    }
    
    /**
     * 处理建筑栏滚动结束
     */
    public handleBuildingBarEnd() {
        if (this.customScrollView) {
            this.customScrollView.handleScrollEnd();
        }
    }

    /**
     * 滚动到指定建筑 - 使用CustomScrollView组件
     */
    public scrollToBuilding(index: number) {
        if (!this.customScrollView || index < 0 || index >= this.buildingNodes.length) {
            return;
        }
        
        // 计算目标建筑对应的滚动百分比
        const targetPercent = this._calculateBuildingScrollPercent(index);
        
        // 使用CustomScrollView滚动到目标位置
        this.customScrollView.scrollToPercent(targetPercent, true);
        
        console.log(`[DynamicBuildingBarManager] 滚动到建筑 ${index}，目标百分比: ${targetPercent.toFixed(3)}`);
    }
    
    /**
     * 计算建筑滚动百分比
     */
    private _calculateBuildingScrollPercent(buildingIndex: number): number {
        if (this.buildingNodes.length <= 1) {
            return 0;
        }
        
        // 计算目标建筑在整个列表中的相对位置
        const relativePosition = buildingIndex / (this.buildingNodes.length - 1);
        
        // 确保百分比在0-1范围内
        return Math.max(0, Math.min(1, relativePosition));
    }
    
    /**
     * 重置建筑栏到左边界对齐位置
     */
    public resetToLeftBoundary() {
        if (!this.customScrollView) {
            return;
        }
        
        // 使用CustomScrollView滚动到0%位置（左边界）
        this.customScrollView.scrollToPercent(0, true);
        
        console.log(`[DynamicBuildingBarManager] 重置到左边界对齐`);
    }
    
    onDestroy() {
        this.removeInputEvents();
        this.clearBuildingNodes();
    }
}