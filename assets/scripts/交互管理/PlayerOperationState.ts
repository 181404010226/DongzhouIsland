import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 玩家操作状态枚举
 */
export enum PlayerOperationType {
    NONE = 'none',                    // 无操作
    LONG_PRESSING = 'long_pressing',  // 长按中（可以直接切换到其他状态）
    CAMERA_DRAG = 'camera_drag',      // 相机拖拽
    BUILDING_PLACEMENT = 'building_placement', // 建筑放置
    TILE_SELECTION = 'tile_selection' // 地块选择
}

/**
 * 玩家操作状态信息
 * 静态类，用于管理全局的玩家操作状态
 */
@ccclass('PlayerOperationState')
export class PlayerOperationState {
    private static _currentOperation: PlayerOperationType = PlayerOperationType.NONE;
    private static _operationData: any = null;
    private static _listeners: Map<string, (operation: PlayerOperationType, data?: any) => void> = new Map();
    
    /**
     * 获取当前操作类型
     */
    public static getCurrentOperation(): PlayerOperationType {
        return this._currentOperation;
    }
    
    /**
     * 设置当前操作类型
     */
    public static setCurrentOperation(operation: PlayerOperationType, data?: any) {
        const previousOperation = this._currentOperation;
        this._currentOperation = operation;
        this._operationData = data;
        
        console.log(`玩家操作状态变更: ${previousOperation} -> ${operation}`);
        
        // 通知所有监听器
        this._listeners.forEach((callback) => {
            callback(operation, data);
        });
    }
    
    /**
     * 获取当前操作数据
     */
    public static getOperationData(): any {
        return this._operationData;
    }
    
    /**
     * 检查是否为指定操作类型
     */
    public static isOperation(operation: PlayerOperationType): boolean {
        return this._currentOperation === operation;
    }
    
    /**
     * 检查是否为空闲状态
     */
    public static isIdle(): boolean {
        return this._currentOperation === PlayerOperationType.NONE;
    }
    
    /**
     * 重置为空闲状态
     */
    public static resetToIdle() {
        this.setCurrentOperation(PlayerOperationType.NONE);
    }
    
    /**
     * 添加状态变更监听器
     */
    public static addListener(id: string, callback: (operation: PlayerOperationType, data?: any) => void) {
        this._listeners.set(id, callback);
    }
    
    /**
     * 移除状态变更监听器
     */
    public static removeListener(id: string) {
        this._listeners.delete(id);
    }
    
    /**
     * 清除所有监听器
     */
    public static clearListeners() {
        this._listeners.clear();
    }
    
    /**
     * 检查当前操作是否允许相机拖拽
     */
    public static isCameraDragAllowed(): boolean {
        return this._currentOperation === PlayerOperationType.NONE || 
               this._currentOperation === PlayerOperationType.LONG_PRESSING ||
               this._currentOperation === PlayerOperationType.CAMERA_DRAG;
    }
    
    /**
     * 检查当前操作是否允许建筑放置
     */
    public static isBuildingPlacementAllowed(): boolean {
        return this._currentOperation === PlayerOperationType.NONE || 
               this._currentOperation === PlayerOperationType.LONG_PRESSING ||
               this._currentOperation === PlayerOperationType.BUILDING_PLACEMENT;
    }
    
    /**
     * 检查当前操作是否允许地块选择
     */
    public static isTileSelectionAllowed(): boolean {
        return this._currentOperation === PlayerOperationType.NONE || 
               this._currentOperation === PlayerOperationType.LONG_PRESSING ||
               this._currentOperation === PlayerOperationType.TILE_SELECTION;
    }
}