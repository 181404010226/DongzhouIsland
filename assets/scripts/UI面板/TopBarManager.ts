import { _decorator, Component, Label, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 顶部面板管理系统
 * 负责接收魅力值计算系统的数据并更新UI显示
 * 
 * 功能职责：
 * 1. 接收来自魅力值计算系统的总魅力值
 * 2. 更新顶部面板的魅力值显示
 * 
 * 数据流向：
 * CharmCalculationSystem → TopBarManager → UI显示
 */
@ccclass('TopBarManager')
export class TopBarManager extends Component {
    
    @property({ tooltip: '魅力值显示前缀文本' })
    charmValuePrefix: string = '总魅力值: ';
    
    // 私有属性
    private charmValueLabel: Label = null;
    
    // 静态实例引用，方便其他系统调用
    private static instance: TopBarManager = null;
    
    onLoad() {
        // 设置静态实例引用
        TopBarManager.instance = this;
        
        // 查找魅力值显示节点
        this.findCharmValueLabel();
        

    }
    
    onDestroy() {
        // 清除静态实例引用
        if (TopBarManager.instance === this) {
            TopBarManager.instance = null;
        }
    }
    
    /**
     * 查找魅力值显示Label组件
     */
    private findCharmValueLabel(): void {
        try {
            const charmValueNode = find('CanvasUI/TopBar/总魅力值');
            if (charmValueNode) {
                this.charmValueLabel = charmValueNode.getComponent(Label);
                if (this.charmValueLabel) {

                    // 设置初始显示
                    this.updateCharmValueDisplay(0);
                } else {
                    console.error('[顶部面板管理器] 魅力值节点缺少Label组件');
                }
            } else {
                console.error('[顶部面板管理器] 未找到魅力值显示节点: CanvasUI/TopBar/总魅力值');
            }
        } catch (error) {
            console.error('[顶部面板管理器] 查找魅力值Label失败:', error);
        }
    }
    
    /**
     * 更新魅力值显示
     * @param charmValue 新的魅力值
     */
    public updateCharmValueDisplay(charmValue: number): void {
        if (!this.charmValueLabel) {
            console.error('[顶部面板管理器] Label组件不存在，无法更新显示');
            return;
        }
        
        const displayValue = Math.max(0, charmValue);
        const displayText = `${this.charmValuePrefix}${displayValue}`;
        
        this.charmValueLabel.string = displayText;
        

    }
    

    
    /**
     * 处理魅力值计算结果
     * @param totalCharmValue 总魅力值
     * @param buildingCount 建筑数量
     */
    public handleCharmCalculationResult(totalCharmValue: number, buildingCount: number): void {
        if (totalCharmValue < 0) {
            console.error('[顶部面板管理器] 魅力值计算结果无效');
            return;
        }
        

        
        // 更新魅力值显示
        this.updateCharmValueDisplay(totalCharmValue);
    }
    
    /**
     * 静态方法：获取TopBarManager实例
     * @returns TopBarManager实例，如果不存在则返回null
     */
    public static getInstance(): TopBarManager | null {
        return TopBarManager.instance;
    }
    
    /**
     * 静态方法：处理魅力值计算结果（便捷调用）
     * @param totalCharmValue 总魅力值
     * @param buildingCount 建筑数量
     */
    public static handleCalculationResult(totalCharmValue: number, buildingCount: number): void {
        const instance = TopBarManager.getInstance();
        if (instance) {
            instance.handleCharmCalculationResult(totalCharmValue, buildingCount);
        } else {
            console.error('[顶部面板管理器] 实例不存在，无法处理计算结果');
        }
    }
}