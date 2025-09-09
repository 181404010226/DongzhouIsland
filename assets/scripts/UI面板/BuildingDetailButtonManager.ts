import { _decorator, Component, Node, Button, Vec3, Canvas, Prefab, instantiate, input, Input, EventTouch, UITransform } from 'cc';
import { BuildingDetailPanelManager } from './BuildingDetailPanelManager';

const { ccclass, property } = _decorator;

/**
 * 建筑详情按钮管理器
 * 简化版本：点击建筑在点击位置显示按钮，再次点击删除按钮
 */
@ccclass('BuildingDetailButtonManager')
export class BuildingDetailButtonManager extends Component {
    @property({ type: Prefab, tooltip: '详情按钮预制体' })
    detailButtonPrefab: Prefab | null = null;
    
    @property({ type: BuildingDetailPanelManager, tooltip: '建筑详情面板管理器' })
    detailPanelManager: BuildingDetailPanelManager | null = null;
    
    // 私有变量
    private currentButton: Node | null = null; // 当前显示的按钮
    private currentBuilding: Node | null = null; // 当前关联的建筑
    
    start() {
    }
    
    /**
     * 处理建筑点击事件
     * @param buildingNode 被点击的建筑节点
     * @param clickPosition 点击位置（世界坐标）
     */
    public onBuildingClicked(buildingNode: Node | null, clickPosition: Vec3) {
        // 如果buildingNode为null（点击空白处），删除当前按钮
        if (buildingNode === null) {
            if (this.currentButton) {
                this.destroyCurrentButton();
            }
            return;
        }
        
        // 如果点击的是当前已显示按钮的建筑，删除按钮
        if (this.currentBuilding === buildingNode && this.currentButton) {
            this.destroyCurrentButton();
            return;
        }
        
        // 如果有其他按钮在显示，先删除
        if (this.currentButton) {
            this.destroyCurrentButton();
        }
        
        // 在点击位置创建新按钮
        this.createButtonAtPosition(buildingNode, clickPosition);
    }
    

    /**
     * 在指定位置创建按钮
     * @param buildingNode 关联的建筑节点
     * @param clickPosition 点击位置（世界坐标）
     */
    private createButtonAtPosition(buildingNode: Node, clickPosition: Vec3) {
        if (!this.detailButtonPrefab) {
            return;
        }
        
        // 创建按钮实例
        const buttonNode = instantiate(this.detailButtonPrefab);
        if (!buttonNode) {
            return;
        }
        
        // 获取Canvas节点
        const canvas = this.node.scene.getComponentInChildren(Canvas);
        if (!canvas) {
            buttonNode.destroy();
            return;
        }
        
        // 将按钮添加到Canvas下
        buttonNode.setParent(canvas.node);
        
        // 将世界坐标转换为Canvas的本地坐标
        const localPos = new Vec3();
        canvas.node.inverseTransformPoint(localPos, clickPosition);
        
        // 获取按钮的UITransform组件，向上偏移一个按钮高度
        const buttonUITransform = buttonNode.getComponent(UITransform);
        if (buttonUITransform) {
            localPos.y += buttonUITransform.height;
        }
        
        buttonNode.setPosition(localPos);
        
        // 保存建筑节点引用
        (buttonNode as any)._buildingNodeRef = buildingNode;
        
        // 绑定按钮点击事件
        const button = buttonNode.getComponent(Button);
        if (button) {
            button.node.on(Button.EventType.CLICK, this.onDetailButtonClicked, this);
        }
        
        // 更新当前状态
        this.currentButton = buttonNode;
        this.currentBuilding = buildingNode;
        

    }
    
    /**
     * 销毁当前按钮
     */
    private destroyCurrentButton() {
        if (this.currentButton && this.currentButton.isValid) {
            this.currentButton.destroy();
        }
        this.currentButton = null;
        this.currentBuilding = null;

    }
    

    /**
     * 详情按钮点击事件
     */
    private onDetailButtonClicked(event: any) {
        // 阻止事件冒泡
        event.propagationStopped = true;
        
        // 获取关联的建筑节点
        const buildingNode: Node | null = (event.target as any)._buildingNodeRef || null;
        
        if (buildingNode && buildingNode.isValid) {
            // 删除按钮
            this.destroyCurrentButton();
            
            // 显示详情面板
            this.showBuildingDetailPanel(buildingNode);
        }
    }
    

    /**
     * 显示建筑详情面板
     */
    private showBuildingDetailPanel(buildingNode: Node) {
        if (!this.detailPanelManager) {
            return;
        }
        
        this.detailPanelManager.showBuildingDetailPanel(buildingNode);
    }

    
    /**
     * 检查是否有按钮正在显示
     */
    public isDetailButtonVisible(): boolean {
        return this.currentButton !== null && this.currentButton.isValid;
    }
    
    /**
     * 组件销毁时清理资源
     */
    onDestroy() {
        this.destroyCurrentButton();
    }
}