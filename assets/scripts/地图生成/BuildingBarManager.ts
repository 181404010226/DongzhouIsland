import { _decorator, Component, Node, EventTouch, input, Input, Vec2, Vec3, UITransform } from 'cc';
import { BuildInfo } from './BuildInfo';
import { BuildingPlacer } from './BuildingPlacer';
import { PlayerOperationState, PlayerOperationType } from '../交互管理/PlayerOperationState';

const { ccclass, property } = _decorator;

/**
 * 建造栏管理器
 * 负责管理建造栏内的建筑节点事件，传递BuildInfo给BuildingPlacer
 */
@ccclass('BuildingBarManager')
export class BuildingBarManager extends Component {
    @property({ type: [Node], tooltip: '建造栏内的建筑节点数组' })
    buildingNodes: Node[] = [];
    
    @property({ type: BuildingPlacer, tooltip: '建筑放置器' })
    buildingPlacer: BuildingPlacer = null;
    
    // 私有变量
    private currentSelectedIndex: number = -1; // 当前选中的建筑索引
    
    start() {
        this.setupInputEvents();
    }
    
    /**
     * 设置全局输入事件
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
        
        console.log(`选中建筑: ${buildInfo.getBuildingType()}`);
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
            buildingType: buildInfo?.getBuildingType()
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
        // 这里可以添加视觉反馈，比如改变透明度、边框等
        // 例如：node.getComponent(Sprite).color = selected ? Color.YELLOW : Color.WHITE;
        
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
        // 建筑放置完成后，可以选择保持选中状态或取消选中
        // 这里选择取消选中，用户需要重新点击才能继续建造
        this.cancelSelection();
    }
    
    /**
     * 添加建筑节点
     */
    public addBuildingNode(node: Node): boolean {
        if (!node || !node.getComponent(BuildInfo)) {
            console.warn('节点必须包含BuildInfo组件');
            return false;
        }
        
        if (this.buildingNodes.indexOf(node) >= 0) {
            console.warn('节点已存在于建造栏中');
            return false;
        }
        
        this.buildingNodes.push(node);
        
        // 为新节点添加事件
        const index = this.buildingNodes.length - 1;
        node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            this.onBuildingNodeTouched(index, event);
        }, this);
        
        console.log(`添加建筑节点到建造栏: ${node.name}`);
        return true;
    }
    
    /**
     * 移除建筑节点
     */
    public removeBuildingNode(node: Node): boolean {
        const index = this.buildingNodes.indexOf(node);
        if (index < 0) {
            console.warn('节点不存在于建造栏中');
            return false;
        }
        
        // 移除事件监听
        node.off(Node.EventType.TOUCH_START);
        
        // 如果移除的是当前选中的节点，取消选中
        if (this.currentSelectedIndex === index) {
            this.cancelSelection();
        } else if (this.currentSelectedIndex > index) {
            this.currentSelectedIndex--;
        }
        
        this.buildingNodes.splice(index, 1);
        console.log(`从建造栏移除建筑节点: ${node.name}`);
        return true;
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
    }
}