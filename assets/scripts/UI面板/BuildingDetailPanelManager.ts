import { _decorator, Component, Node, Button, Prefab, instantiate, Vec3, Label, Sprite, Canvas, UITransform, BlockInputEvents } from 'cc';
import { BuildInfo } from '../地图生成/BuildInfo';
const { ccclass, property } = _decorator;

/**
 * 建筑详情面板管理器
 * 负责管理建筑详情面板的显示、隐藏、页面切换等功能
 */
@ccclass('BuildingDetailPanelManager')
export class BuildingDetailPanelManager extends Component {
    @property({ type: Prefab, tooltip: '建筑详情面板预制体' })
    buildingDetailPanelPrefab: Prefab | null = null;
    
    // 运行时获取的面板节点引用（不使用装饰器，因为是预制体实例化后获取）
    private detailPanelRoot: Node | null = null;
    private page1Container: Node | null = null;
    private page2Container: Node | null = null;
    private closeButton: Button | null = null;
    private leftPageButton: Button | null = null;
    private rightPageButton: Button | null = null;
    
    // 建筑信息显示组件
    private buildingNameLabel: Label | null = null;
    private buildingImageSprite: Sprite | null = null;
    
    // 私有变量
    private currentDetailPanel: Node | null = null; // 当前显示的详情面板实例
    private currentDetailPanelBuilding: Node | null = null; // 当前显示详情面板的建筑节点
    private currentPageIndex: number = 1; // 当前页面索引 (1或2)
    private onCloseCallback: (() => void) | null = null; // 关闭回调函数
    private modalMask: Node | null = null; // 模态遮罩节点
    
    /**
     * 显示建筑详情面板
     * @param buildingNode 建筑节点
     * @param onClose 关闭回调函数
     */
    public showBuildingDetailPanel(buildingNode: Node, onClose?: () => void): boolean {
        // 如果已经有详情面板在显示，先关闭它
        if (this.currentDetailPanel && this.currentDetailPanel.isValid) {
            this.closeBuildingDetailPanel();
        }
        
        // 检查预制体是否设置
        if (!this.buildingDetailPanelPrefab) {
            console.error('建筑详情面板预制体未设置，请在编辑器中设置预制体');
            return false;
        }
        
        // 创建详情面板实例
        this.currentDetailPanel = instantiate(this.buildingDetailPanelPrefab);
        
        if (this.currentDetailPanel && buildingNode) {
            // 查找Canvas节点并将面板添加到Canvas下
            const canvas = this.node.scene.getComponentInChildren(Canvas);
            if (canvas) {
                this.currentDetailPanel.setParent(canvas.node);
                
                // 创建全屏遮罩来阻止背景交互
                this.createModalMask(canvas.node);
            } else {
                console.warn('未找到Canvas节点，将面板添加到场景根节点');
                this.currentDetailPanel.setParent(this.node.scene);
            }
            
            // 设置面板在屏幕中央显示
            this.currentDetailPanel.setPosition(new Vec3(0, 0, 0));
            
            // 记录当前显示详情面板的建筑节点
            this.currentDetailPanelBuilding = buildingNode;
            
            // 设置关闭回调
            this.onCloseCallback = onClose || null;
            
            // 设置初始页面状态
            this.currentPageIndex = 1;
            
            // 初始化面板组件引用
            this.initializePanelReferences();
            
            // 更新页面显示
            this.updatePageDisplay();
            
            // 绑定按钮事件
            this.bindDetailPanelEvents();
            
            // 更新建筑信息显示
            this.updateBuildingInfo(buildingNode);
            
            console.log('显示建筑详情面板');
            return true;
        }
        
        return false;
    }

    /**
     * 初始化面板组件引用
     */
    private initializePanelReferences() {
        if (!this.currentDetailPanel || !this.currentDetailPanel.isValid) {
            return;
        }
        
        // 直接从预制体实例中查找节点
        this.detailPanelRoot = this.currentDetailPanel.getChildByPath('DetailPanel');
        
        if (this.detailPanelRoot) {
            // 获取页面容器
            this.page1Container = this.detailPanelRoot.getChildByPath('Page1Container');
            this.page2Container = this.detailPanelRoot.getChildByPath('Page2Container');
            
            // 获取按钮组件
            const closeButtonNode = this.detailPanelRoot.getChildByPath('CloseButton');
            this.closeButton = closeButtonNode ? closeButtonNode.getComponent(Button) : null;
            
            const leftPageButtonNode = this.detailPanelRoot.getChildByPath('PageButtonsContainer/LeftPageButton');
            this.leftPageButton = leftPageButtonNode ? leftPageButtonNode.getComponent(Button) : null;
            
            const rightPageButtonNode = this.detailPanelRoot.getChildByPath('PageButtonsContainer/RightPageButton');
            this.rightPageButton = rightPageButtonNode ? rightPageButtonNode.getComponent(Button) : null;
            
            // 获取建筑信息显示组件
            if (this.page1Container) {
                const buildingNameNode = this.page1Container.getChildByPath('BuildingNameLabel');
                this.buildingNameLabel = buildingNameNode ? buildingNameNode.getComponent(Label) : null;
                
                const buildingImageNode = this.page1Container.getChildByPath('BuildingImageSprite');
                this.buildingImageSprite = buildingImageNode ? buildingImageNode.getComponent(Sprite) : null;
            }
        }
    }
    
    /**
     * 更新建筑信息显示
     * @param buildingNode 建筑节点
     */
    private updateBuildingInfo(buildingNode: Node) {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法更新建筑信息');
            return;
        }
        
        // 获取建筑的BuildInfo组件
        const buildInfo = buildingNode.getComponent(BuildInfo);
        if (!buildInfo) {
            console.warn('建筑节点缺少BuildInfo组件，无法获取建筑信息');
            return;
        }
        
        // 更新建筑名称
        if (this.buildingNameLabel) {
            const buildingType = buildInfo.getBuildingType();
            this.buildingNameLabel.string = buildingType || '未知建筑';
            console.log(`更新建筑名称: ${buildingType}`);
        } else {
            console.warn('建筑名称标签组件未找到');
        }
        
        // 更新建筑图片
        if (this.buildingImageSprite) {
            const previewImage = buildInfo.getPreviewImage();
            if (previewImage) {
                this.buildingImageSprite.spriteFrame = previewImage;
                console.log('更新建筑预览图片');
            } else {
                console.warn('建筑预览图片不存在');
            }
        } else {
            console.warn('建筑图片精灵组件未找到');
        }
    }
    
    /**
     * 更新页面显示
     */
    private updatePageDisplay() {
        if (!this.page1Container || !this.page2Container) {
            console.error('页面容器节点未设置，请在编辑器中拖拽设置');
            return;
        }
        
        // 根据当前页面索引显示对应页面
        if (this.currentPageIndex === 1) {
            this.page1Container.active = true;
            this.page2Container.active = false;
        } else {
            this.page1Container.active = false;
            this.page2Container.active = true;
        }
        
        console.log(`切换到第${this.currentPageIndex}页`);
    }
    
    /**
     * 绑定详情面板按钮事件
     */
    private bindDetailPanelEvents() {
        // 绑定关闭按钮
        if (this.closeButton) {
            this.closeButton.node.on(Button.EventType.CLICK, this.onDetailPanelCloseClicked, this);
        } else {
            console.warn('关闭按钮未设置，请在编辑器中拖拽设置');
        }
        
        // 绑定左翻页按钮
        if (this.leftPageButton) {
            this.leftPageButton.node.on(Button.EventType.CLICK, this.onLeftPageClicked, this);
        } else {
            console.warn('左翻页按钮未设置，请在编辑器中拖拽设置');
        }
        
        // 绑定右翻页按钮
        if (this.rightPageButton) {
            this.rightPageButton.node.on(Button.EventType.CLICK, this.onRightPageClicked, this);
        } else {
            console.warn('右翻页按钮未设置，请在编辑器中拖拽设置');
        }
    }
    
    /**
     * 解绑详情面板按钮事件
     */
    private unbindDetailPanelEvents() {
        // 解绑关闭按钮
        if (this.closeButton) {
            this.closeButton.node.off(Button.EventType.CLICK, this.onDetailPanelCloseClicked, this);
        }
        
        // 解绑左翻页按钮
        if (this.leftPageButton) {
            this.leftPageButton.node.off(Button.EventType.CLICK, this.onLeftPageClicked, this);
        }
        
        // 解绑右翻页按钮
        if (this.rightPageButton) {
            this.rightPageButton.node.off(Button.EventType.CLICK, this.onRightPageClicked, this);
        }
    }
    
    /**
     * 关闭详情面板
     */
    public closeBuildingDetailPanel() {
        if (this.currentDetailPanel && this.currentDetailPanel.isValid) {
            // 移除事件监听器
            this.unbindDetailPanelEvents();
            
            // 销毁面板
            this.currentDetailPanel.destroy();
            this.currentDetailPanel = null;
            this.currentDetailPanelBuilding = null;
            
            // 销毁模态遮罩
            if (this.modalMask && this.modalMask.isValid) {
                this.modalMask.destroy();
                this.modalMask = null;
            }
            
            // 调用关闭回调
            if (this.onCloseCallback) {
                this.onCloseCallback();
                this.onCloseCallback = null;
            }
            
            console.log('关闭建筑详情面板');
        }
    }
    
    /**
     * 详情面板关闭按钮点击事件
     */
    private onDetailPanelCloseClicked() {
        this.closeBuildingDetailPanel();
    }
    
    /**
     * 左翻页按钮点击事件
     */
    private onLeftPageClicked() {
        if (this.currentPageIndex > 1) {
            this.currentPageIndex = 1;
            this.updatePageDisplay();
        }
    }
    
    /**
     * 右翻页按钮点击事件
     */
    private onRightPageClicked() {
        if (this.currentPageIndex < 2) {
            this.currentPageIndex = 2;
            this.updatePageDisplay();
        }
    }
    
    /**
     * 获取当前页面索引
     */
    public getCurrentPageIndex(): number {
        return this.currentPageIndex;
    }
    
    /**
     * 设置当前页面索引
     */
    public setCurrentPageIndex(pageIndex: number) {
        if (pageIndex >= 1 && pageIndex <= 2) {
            this.currentPageIndex = pageIndex;
            this.updatePageDisplay();
        }
    }
    
    /**
     * 检查详情面板是否正在显示
     */
    public isDetailPanelVisible(): boolean {
        return this.currentDetailPanel !== null && this.currentDetailPanel.isValid;
    }
    
    /**
     * 获取当前显示详情面板的建筑节点
     */
    public getCurrentDetailPanelBuilding(): Node | null {
        return this.currentDetailPanelBuilding;
    }
    
    /**
     * 组件销毁时清理资源
     */
    /**
     * 创建模态遮罩
     * @param canvasNode Canvas节点
     */
    private createModalMask(canvasNode: Node) {
        // 创建遮罩节点
        this.modalMask = new Node('ModalMask');
        this.modalMask.setParent(canvasNode);
        
        // 添加UITransform组件并设置为全屏
        const uiTransform = this.modalMask.addComponent(UITransform);
        const canvasTransform = canvasNode.getComponent(UITransform);
        if (canvasTransform) {
            uiTransform.setContentSize(canvasTransform.contentSize);
        }
        
        // 添加BlockInputEvents组件来阻止输入事件穿透
        this.modalMask.addComponent(BlockInputEvents);
        
        // 设置遮罩在面板之下
        this.modalMask.setSiblingIndex(this.modalMask.parent.children.length - 2);
        
        // 确保面板在遮罩之上
        if (this.currentDetailPanel) {
            this.currentDetailPanel.setSiblingIndex(this.currentDetailPanel.parent.children.length - 1);
        }
    }
    
    onDestroy() {
        this.closeBuildingDetailPanel();
    }
}