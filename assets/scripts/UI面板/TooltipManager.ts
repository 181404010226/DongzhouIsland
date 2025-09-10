import { _decorator, Component, Node, Label, tween, Vec3, Color } from 'cc';
import { BuildingPlacer } from '../地图生成/BuildingPlacer';

const { ccclass, property } = _decorator;

/**
 * 提示UI管理器
 * 负责显示建筑放置失败等提示信息，并提供动画效果
 */
@ccclass('TooltipManager')
export class TooltipManager extends Component {
    @property({ type: Node, tooltip: '提示UI节点' })
    tooltipNode: Node = null;
    
    @property({ type: Label, tooltip: '提示文本标签' })
    tooltipLabel: Label = null;
    
    // 私有变量
    private originalPosition: Vec3 = new Vec3();
    private isAnimating: boolean = false;
    
    start() {
        this.setupEventListeners();
        this.initializeTooltip();
    }
    
    /**
     * 初始化提示UI
     */
    private initializeTooltip() {
        if (this.tooltipNode) {
                this.originalPosition = this.tooltipNode.getPosition().clone();
            this.tooltipNode.active = false;
        }
        
        if (this.tooltipLabel) {
            this.tooltipLabel.string = '';
        }
    }
    
    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        BuildingPlacer.eventTarget.on('building-placement-failed', this.onBuildingPlacementFailed, this);
    }
    
    /**
     * 移除事件监听器
     */
    private removeEventListeners() {
        BuildingPlacer.eventTarget.off('building-placement-failed', this.onBuildingPlacementFailed, this);
    }
    
    private onBuildingPlacementFailed(eventData: { reason: string, buildingType: string }) {
        const message = `${eventData.buildingType} 放置失败: ${eventData.reason}`;
        this.showTooltip(message);
    }
    
    /**
     * 显示提示信息
     */
    public showTooltip(message: string) {
        if (!this.tooltipNode || !this.tooltipLabel || this.isAnimating) {
            return;
        }
        
        this.tooltipLabel.string = message;
        
        this.tooltipNode.setPosition(this.originalPosition);
        this.tooltipNode.active = true;
        const labelComponent = this.tooltipLabel.getComponent(Label);
        if (labelComponent) {
            labelComponent.color = new Color(255, 100, 100, 255);
        }
        
        this.playTooltipAnimation();
    }
    
    /**
     * 播放提示动画
     */
    private playTooltipAnimation() {
        if (!this.tooltipNode || this.isAnimating) {
            return;
        }
        
        this.isAnimating = true;
        
        const startPos = this.originalPosition.clone();
        const endPos = new Vec3(startPos.x, startPos.y + 50, startPos.z);
        tween(this.tooltipNode)
            .to(0.2, { 
                position: new Vec3(startPos.x, startPos.y + 10, startPos.z),
                scale: new Vec3(1.1, 1.1, 1.1)
            }, { easing: 'backOut' })
            .call(() => {
                tween(this.tooltipNode)
                    .delay(1.0)
                    .call(() => {
                        this.fadeOutAnimation(endPos);
                    })
                    .start();
            })
            .start();
    }
    
    /**
     * 淡出动画
     */
    private fadeOutAnimation(endPos: Vec3) {
        if (!this.tooltipNode) {
            return;
        }
        
        tween(this.tooltipNode)
            .to(0.5, { 
                position: endPos,
                scale: new Vec3(0.8, 0.8, 0.8)
            }, { easing: 'sineOut' })
            .call(() => {
                this.onAnimationComplete();
            })
            .start();
            
        
        if (this.tooltipLabel) {
            const labelComponent = this.tooltipLabel.getComponent(Label);
            if (labelComponent) {
                tween(labelComponent)
                    .to(0.5, { 
                        color: new Color(255, 100, 100, 0) 
                    })
                    .start();
            }
        }
    }
    
    /**
     * 动画完成回调
     */
    private onAnimationComplete() {
        this.isAnimating = false;
        
        if (this.tooltipNode) {
            this.tooltipNode.active = false;
            this.tooltipNode.setPosition(this.originalPosition);
            this.tooltipNode.setScale(Vec3.ONE);
        }
        
        if (this.tooltipLabel) {
            const labelComponent = this.tooltipLabel.getComponent(Label);
            if (labelComponent) {
                labelComponent.color = new Color(255, 100, 100, 255);
            }
            this.tooltipLabel.string = '';
        }
    }
    
    /**
     * 手动隐藏提示
     */
    public hideTooltip() {
        if (this.tooltipNode) {
            this.tooltipNode.active = false;
        }
        this.isAnimating = false;
    }
    
    /**
     * 设置提示节点
     */
    public setTooltipNode(node: Node) {
        this.tooltipNode = node;
        this.initializeTooltip();
    }
    
    /**
     * 设置提示标签
     */
    public setTooltipLabel(label: Label) {
        this.tooltipLabel = label;
    }
    
    onDestroy() {
        this.removeEventListeners();
    }
}