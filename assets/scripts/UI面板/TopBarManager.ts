import { _decorator, Component, find } from 'cc';
import { NumberDisplayComponent } from '../组件/NumberDisplayComponent';
const { ccclass, property } = _decorator;

/**
 * 顶部面板管理系统
 * 负责管理游戏的金币和客流量数据并更新UI显示
 * 
 * 功能职责：
 * 1. 管理当前金币数量
 * 2. 管理当前客流量数值
 * 3. 更新顶部面板的金币和客流量显示
 * 4. 通知游客生成系统根据客流量生成游客
 * 
 * 数据流向：
 * 建筑系统 → TopBarManager → UI显示 & TouristGenerator
 */
@ccclass('TopBarManager')
export class TopBarManager extends Component {
    

    
    // 私有属性
    private coinsDisplay: NumberDisplayComponent | null = null;
    private trafficFlowDisplay: NumberDisplayComponent | null = null;
    
    // 静态实例引用，方便其他系统调用
    private static instance: TopBarManager = null;
    
    // 游戏数据
    private currentCoins: number = 1000; // 初始金币
    private currentTrafficFlow: number = 0; // 当前客流量

    
    onLoad() {
        // 设置静态实例引用
        TopBarManager.instance = this;
        
        // 查找数字显示组件
        this.findUIDisplays();
        
        // 初始化显示
        this.updateCoinsDisplay();
        this.updateTrafficFlowDisplay();

        // 初始化数字显示组件小数位（金币、客流量均为整数）
        if (this.coinsDisplay) {
            this.coinsDisplay.setDecimalPlaces(0);
        }
        if (this.trafficFlowDisplay) {
            this.trafficFlowDisplay.setDecimalPlaces(0);
        }
    }
    
    onDestroy() {
        // 清除静态实例引用
        if (TopBarManager.instance === this) {
            TopBarManager.instance = null;
        }
    }
    
    /**
     * 查找数字显示组件
     */
    private findUIDisplays(): void {
        try {
            // 查找金币显示节点
            const coinsNode = find('CanvasUI/TopBar/金币');
            if (coinsNode) {
                this.coinsDisplay = coinsNode.getComponent(NumberDisplayComponent);
                if (!this.coinsDisplay) {
                    console.error('[顶部面板管理器] 金币节点缺少NumberDisplayComponent组件');
                }
            } else {
                console.error('[顶部面板管理器] 未找到金币显示节点: CanvasUI/TopBar/金币');
            }
            
            // 查找客流量显示节点
            const trafficFlowNode = find('CanvasUI/TopBar/客流量');
            if (trafficFlowNode) {
                this.trafficFlowDisplay = trafficFlowNode.getComponent(NumberDisplayComponent);
                if (!this.trafficFlowDisplay) {
                    console.error('[顶部面板管理器] 客流量节点缺少NumberDisplayComponent组件');
                }
            } else {
                console.error('[顶部面板管理器] 未找到客流量显示节点: CanvasUI/TopBar/客流量');
            }
        } catch (error) {
            console.error('[顶部面板管理器] 查找数字显示组件失败:', error);
        }
    }
    
    /**
     * 更新金币显示
     */
    private updateCoinsDisplay(): void {
        if (!this.coinsDisplay) {
            console.error('[顶部面板管理器] 金币NumberDisplayComponent不存在，无法更新显示');
            return;
        }
        this.coinsDisplay.setValue(this.currentCoins);
    }
    
    /**
     * 更新客流量显示
     */
    private updateTrafficFlowDisplay(): void {
        if (!this.trafficFlowDisplay) {
            console.error('[顶部面板管理器] 客流量NumberDisplayComponent不存在，无法更新显示');
            return;
        }
        this.trafficFlowDisplay.setValue(this.currentTrafficFlow);
    }
    
    /**
     * 设置金币数量
     * @param coins 新的金币数量
     */
    public setCoins(coins: number): void {
        this.currentCoins = Math.max(0, coins);
        this.updateCoinsDisplay();
    }
    
    /**
     * 增加金币
     * @param amount 增加的金币数量
     */
    public addCoins(amount: number): void {
        this.currentCoins += amount;
        this.updateCoinsDisplay();
    }
    
    /**
     * 扣除金币
     * @param amount 扣除的金币数量
     * @returns 是否扣除成功
     */
    public spendCoins(amount: number): boolean {
        if (this.currentCoins >= amount) {
            this.currentCoins -= amount;
            this.updateCoinsDisplay();
            return true;
        }
        return false;
    }


    
    /**
     * 设置客流量
     * @param trafficFlow 新的客流量数值
     */
    public setTrafficFlow(trafficFlow: number): void {
        this.currentTrafficFlow = Math.max(0, trafficFlow);
        this.updateTrafficFlowDisplay();

    }
    

    
  
    
    /**
     * 获取当前金币数量
     * @returns 当前金币数量
     */
    public getCurrentCoins(): number {
        return this.currentCoins;
    }
    
    /**
     * 获取当前客流量
     * @returns 当前客流量数值
     */
    public getCurrentTrafficFlow(): number {
        return this.currentTrafficFlow;
    }
    
    /**
     * 静态方法：获取TopBarManager实例
     * @returns TopBarManager实例，如果不存在则返回null
     */
    public static getInstance(): TopBarManager | null {
        return TopBarManager.instance;
    }
    
    /**
     * 静态方法：设置金币数量（便捷调用）
     * @param coins 新的金币数量
     */
    public static setCoins(coins: number): void {
        const instance = TopBarManager.getInstance();
        if (instance) {
            instance.setCoins(coins);
        } else {
            console.error('[顶部面板管理器] 实例不存在，无法设置金币');
        }
    }
    
    /**
     * 静态方法：设置客流量（便捷调用）
     * @param trafficFlow 新的客流量数值
     */
    public static setTrafficFlow(trafficFlow: number): void {
        const instance = TopBarManager.getInstance();
        if (instance) {
            instance.setTrafficFlow(trafficFlow);
        } else {
            console.error('[顶部面板管理器] 实例不存在，无法设置客流量');
        }
    }


    
    /**
     * 静态方法：增加金币（便捷调用）
     * @param amount 增加的金币数量
     */
    public static addCoins(amount: number): void {
        const instance = TopBarManager.getInstance();
        if (instance) {
            instance.addCoins(amount);
        } else {
            console.error('[顶部面板管理器] 实例不存在，无法增加金币');
        }
    }
    
    /**
     * 静态方法：扣除金币（便捷调用）
     * @param amount 扣除的金币数量
     * @returns 是否扣除成功
     */
    public static spendCoins(amount: number): boolean {
        const instance = TopBarManager.getInstance();
        if (instance) {
            return instance.spendCoins(amount);
        } else {
            console.error('[顶部面板管理器] 实例不存在，无法扣除金币');
            return false;
        }
    }
}