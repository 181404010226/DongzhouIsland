import { _decorator, Component, Node, UITransform, Sprite, Vec3, Vec2, EventTouch, input, Input, Color, Camera, Graphics, EventTarget } from 'cc';
import { BuildInfo } from './BuildInfo';
import { TileOccupancyManager } from './TileOccupancyManager';
import { PlayerOperationState, PlayerOperationType } from '../交互管理/PlayerOperationState';
const { ccclass, property } = _decorator;

/**
 * 建筑放置器
 * 专注于处理玩家交互，建筑管理委托给TileOccupancyManager
 */
@ccclass('BuildingPlacer')
export class BuildingPlacer extends Component {
    @property({ type: Camera, tooltip: '主相机' })
    mainCamera: Camera = null;
    
    @property({ type: TileOccupancyManager, tooltip: '地块占用管理器' })
    tileOccupancyManager: TileOccupancyManager = null;
    
    @property({ type: Node, tooltip: '图层根节点，用于管理预览和建筑图层' })
    layerRootNode: Node = null;
    
    // 私有变量
    private previewNode: Node = null; // 预览节点
    private influenceRangePreviewNode: Node = null; // 影响范围预览节点
    private isDragging: boolean = false; // 是否正在拖拽
    private currentBuildInfo: BuildInfo = null; // 当前建筑信息
    private replacementNode: Node = null; // 重新放置的建筑节点
    
    // 编辑器只读字段：重新放置相关信息
    @property({ readonly: true, serializable: false, tooltip: '重新放置节点的原始地块行坐标（编辑器查看）' })
    private replacementOriginalRow: number = -1; // 重新放置节点的原始行坐标
    
    @property({ readonly: true, serializable: false, tooltip: '重新放置节点的原始地块列坐标（编辑器查看）' })
    private replacementOriginalCol: number = -1; // 重新放置节点的原始列坐标
    
    @property({ type: BuildInfo, readonly: true, serializable: false, tooltip: '重新放置节点的BuildInfo（编辑器查看）' })
    private  replacementBuildInfo: BuildInfo = null; // 重新放置节点的BuildInfo（用于恢复占用记录）
    
    private onBuildingPlacedCallback: Function = null; // 建筑放置完成回调
    
    // 事件目标，用于发射事件
    public static eventTarget: EventTarget = new EventTarget();
    
    start() {
        this.setupInputEvents();
    }
    
    /**
     * 设置输入事件
     */
    private setupInputEvents() {
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    
    /**
     * 移除输入事件
     */
    private removeInputEvents() {
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    
    /**
     * 创建预览节点
     */
    private createPreviewNode() {
        if (!this.currentBuildInfo) {
            return;
        }
        
        if (!this.currentBuildInfo.getBuildingPrefab()) {
            return;
        }
        
        // 如果有重新放置的节点，直接使用它作为预览节点
        if (this.replacementNode) {
            this.previewNode = this.replacementNode;
            
            // 将预览节点绑定到图层根节点的最上层
            if (this.layerRootNode) {
                this.previewNode.parent = this.layerRootNode;
                this.previewNode.setSiblingIndex(this.layerRootNode.children.length - 1); // 设置为最上层
            }
            
            // 设置初始颜色为正常透明度并旋转45度
            this.setPreviewNodeColor(new Color(255, 255, 255, 150));
            this.previewNode.setRotationFromEuler(0, 0, 45);
            // 立即以replacementNode原来所在tile位置更新预览节点位置
            if (this.replacementOriginalRow >= 0 && this.replacementOriginalCol >= 0 && this.tileOccupancyManager) {
                const tileKey = `${this.replacementOriginalRow}_${this.replacementOriginalCol}`;
                const originalTile = this.tileOccupancyManager['getTileByKey'](tileKey);
                if (originalTile) {
                    this.previewNode.setWorldPosition(originalTile.getWorldPosition());
                    this.previewNode.setPosition(this.previewNode.position.x, 
                        this.previewNode.position.y+this.tileOccupancyManager.mapGenerator.tileSize/2, 1);
                }
            }
        
    
        } else {
            // 委托给TileOccupancyManager创建预览节点
            if (this.tileOccupancyManager) {
                this.previewNode = this.tileOccupancyManager.createPreviewNode(this.currentBuildInfo);
                if (this.previewNode) {
                    this.previewNode.active = false;
                    
                    // 将预览节点绑定到图层根节点的最上层
                    if (this.layerRootNode) {
                        this.previewNode.parent = this.layerRootNode;
                        this.previewNode.setSiblingIndex(this.layerRootNode.children.length - 1); // 设置为最上层
                    }
                    
                    // 设置初始颜色为正常透明度并旋转45度
                    this.setPreviewNodeColor(new Color(255, 255, 255, 150));
                    this.previewNode.setRotationFromEuler(0, 0, 45);
                }
            }
        }
        
        // 创建影响范围预览节点
        this.createInfluenceRangePreviewNode(this.currentBuildInfo);
    }
    
    /**
     * 创建影响范围预览节点
     */
    private createInfluenceRangePreviewNode(buildInfo: BuildInfo) {
        if (!this.tileOccupancyManager) {
            return;
        }
        
        // 销毁旧的影响范围预览节点
        if (this.influenceRangePreviewNode) {
            this.influenceRangePreviewNode.destroy();
            this.influenceRangePreviewNode = null;
        }
        
        // 创建新的影响范围预览节点
        this.influenceRangePreviewNode = new Node('InfluenceRangePreview');
        
        // 添加Graphics组件用于绘制矩形边框
        const graphics = this.influenceRangePreviewNode.addComponent(Graphics);
        
        // 获取影响范围
        const influenceRange = buildInfo.getInfluenceRange();
        if (influenceRange.length > 0) {
            // 设置绘制样式
            graphics.lineWidth = 3;
            graphics.strokeColor = new Color(255, 0, 0, 200); // 红色边框，半透明
            graphics.fillColor = new Color(255, 0, 0, 30); // 红色填充，很透明
        }
        
        // 将影响范围预览节点绑定到图层根节点
        if (this.layerRootNode) {
            this.influenceRangePreviewNode.parent = this.layerRootNode;
            this.influenceRangePreviewNode.setSiblingIndex(this.layerRootNode.children.length - 1); // 设置为最上层
        }
        
        // 初始时隐藏影响范围预览
        this.influenceRangePreviewNode.active = false;
    }
    

    
    /**
     * 触摸移动事件
     */
    private onTouchMove(event: EventTouch) {
        if (!this.currentBuildInfo || !this.previewNode) {
            return;
        }
        
        // 如果还没有开始拖拽，则开始拖拽
        if (!this.isDragging) {
            this.startDrag();
        }
        
        const touchPos = event.getLocation();
        this.updatePreviewPosition(new Vec3(touchPos.x, touchPos.y, 0));
    }
    
    /**
     * 触摸结束事件
     */
    private onTouchEnd(event: EventTouch) {
        if (!this.isDragging || !this.currentBuildInfo) {
            return;
        }
        
        const touchPos = event.getLocation();
        this.endDrag(new Vec3(touchPos.x, touchPos.y, 0));
    }
    

    
    /**
     * 设置建筑信息
     */
    public setBuildingInfo(buildInfo: BuildInfo, onPlacedCallback?: Function, replacementNode?: Node, originalInfo?: any) {
        if (!buildInfo) {
            console.warn('BuildInfo不能为空');
            return;
        }
        
        this.currentBuildInfo = buildInfo;
        this.replacementNode = replacementNode || null;
        this.onBuildingPlacedCallback = onPlacedCallback || null;
        
        // 如果是重新放置节点，记录其原始位置信息
        if (this.replacementNode && originalInfo) {
            console.log("赋值信息");
            if (originalInfo.originalTileInfo) {
                this.replacementOriginalRow = originalInfo.originalTileInfo.row;
                this.replacementOriginalCol = originalInfo.originalTileInfo.col;
            }
            this.replacementBuildInfo = originalInfo.buildInfo;
        } 
        
        // 销毁旧的预览节点并创建新的（但不销毁replacementNode）
        if (this.previewNode && this.previewNode !== this.replacementNode) {
            this.previewNode.destroy();
        }
        this.previewNode = null;
        
        // 销毁旧的影响范围预览节点
        if (this.influenceRangePreviewNode) {
            this.influenceRangePreviewNode.destroy();
            this.influenceRangePreviewNode = null;
        }
        
        this.createPreviewNode();
        this.startDrag();
        console.log(`设置建筑信息: ${buildInfo.getType()}`);
    }
    
    /**
     * 清除建筑信息
     */
    public clearBuildingInfo() {
        // 清理预览节点（但不删除重新放置的节点）
        if (this.previewNode && this.previewNode !== this.replacementNode) {
            console.log('清除预览节点');
            this.previewNode.destroy();
        } else if (this.previewNode && this.previewNode === this.replacementNode) {
            // 如果预览节点就是重新放置的节点，恢复其旋转和透明度
            console.log('恢复重新放置节点的旋转和透明度');
            this.previewNode.setRotationFromEuler(0, 0, 0);
            this.setNodeColor(this.previewNode, new Color(255, 255, 255, 255));
        }
        
        this.currentBuildInfo = null;
        this.replacementNode = null;
        // 重置重新放置相关信息
        this.replacementOriginalRow = -1;
        this.replacementOriginalCol = -1;
        this.replacementBuildInfo = null;
        this.onBuildingPlacedCallback = null;
        this.previewNode = null;
        
        // 清理影响范围预览节点
        if (this.influenceRangePreviewNode) {
            this.influenceRangePreviewNode.destroy();
            this.influenceRangePreviewNode = null;
        }
        
        // 如果正在拖拽，结束拖拽
        if (this.isDragging) {
            this.isDragging = false;
            PlayerOperationState.resetToIdle();
        }
        
        console.log('清除建筑信息');
    }
    
    /**
     * 检查点是否在节点范围内
     */
    private isPointInNode(point: Vec3, nodeTransform: UITransform, node: Node): boolean {
        const nodePos = node.getWorldPosition();
        const size = nodeTransform.contentSize;
        
        return point.x >= nodePos.x - size.width / 2 &&
               point.x <= nodePos.x + size.width / 2 &&
               point.y >= nodePos.y - size.height / 2 &&
               point.y <= nodePos.y + size.height / 2;
    }
    
    /**
     * 开始拖拽
     */
    public startDrag() {
        this.isDragging = true;
        
        // 设置操作状态为建筑放置
        PlayerOperationState.setCurrentOperation(PlayerOperationType.BUILDING_PLACEMENT, {
            buildingType: this.currentBuildInfo?.getType()
        });
        
        // 显示影响范围预览
        if (this.influenceRangePreviewNode) {
            this.influenceRangePreviewNode.active = true;
        }
        
        console.log('开始拖拽建筑');
    }
    
    /**
     * 更新预览位置
     */
    private updatePreviewPosition(touchPos: Vec3) {
        if (!this.previewNode || !this.mainCamera || !this.tileOccupancyManager) {
            return;
        }
        
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        
        if (!this.currentBuildInfo) {
            return;
        }
        
        // 确保预览节点在layerRootNode中
        if (this.layerRootNode && this.previewNode.parent !== this.layerRootNode) {
            this.previewNode.parent = this.layerRootNode;
            this.previewNode.setSiblingIndex(this.layerRootNode.children.length - 1);
        }
        
        // 使用TileOccupancyManager的边界检查逻辑
        const tileInfo = this.tileOccupancyManager['getTileAtScreenPos'](screenPos, this.mainCamera);
        
        if (tileInfo) {
            // 显示预览节点
            this.previewNode.active = true;
            
            // 检查是否可以放置建筑
            const canPlace = this.tileOccupancyManager.canPlaceBuildingAt(
                tileInfo.row, tileInfo.col, 
                this.currentBuildInfo.getWidth(), this.currentBuildInfo.getHeight()
            );
            
            // 获取地块节点并设置预览位置
            const tileKey = `${tileInfo.row}_${tileInfo.col}`;
            const tile = this.tileOccupancyManager['getTileByKey'](tileKey);
            if (tile) {
                // 将预览节点定位到地块中心
                this.previewNode.setWorldPosition(tile.getWorldPosition());
                this.previewNode.setPosition(this.previewNode.position.x, this.previewNode.position.y, 1);
            }
            
            // 根据是否可以放置设置颜色
            if (canPlace) {
                // 可以放置：正常透明度
                this.setPreviewNodeColor(new Color(255, 255, 255, 150));
            } else {
                // 不能放置：半透明红色
                this.setPreviewNodeColor(new Color(255, 100, 100, 150));
            }
            
            // 同时更新影响范围预览位置
            this.updateInfluenceRangePreviewPosition(screenPos, this.currentBuildInfo);
        } else {
            // 没有找到有效地块，隐藏预览
            this.previewNode.active = false;
        }
    }
    

    

    

    
    /**
     * 设置预览节点颜色（递归设置所有Sprite组件）
     */
    private setPreviewNodeColor(color: Color) {
        if (!this.previewNode) {
            return;
        }
        
        this.setNodeColor(this.previewNode, color);
    }
    
    /**
     * 递归设置节点及其子节点的颜色
     */
    private setNodeColor(node: Node, color: Color) {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.color = color;
        }
        
        // 递归设置子节点
        for (const child of node.children) {
            this.setNodeColor(child, color);
        }
    }
    
    /**
     * 更新影响范围预览位置
     */
    private updateInfluenceRangePreviewPosition(screenPos: Vec2, buildInfo: BuildInfo) {
        if (!this.influenceRangePreviewNode || !this.mainCamera || !this.tileOccupancyManager || !this.previewNode) {
            return;
        }
        
        // 直接将影响范围预览节点的位置设置为预览节点的位置
        this.influenceRangePreviewNode.setWorldPosition(this.previewNode.getWorldPosition());
        
        // 基于BuildInfo的建筑尺寸重新绘制边框
        const graphics = this.influenceRangePreviewNode.getComponent(Graphics);
        
        if (graphics) {
            graphics.clear();
            
            // 计算影响范围的尺寸（建筑占用地块数 + 影响范围扩展）
            const tileSize = this.tileOccupancyManager.mapGenerator.tileSize / Math.sqrt(2); // 地块边长
            const influenceRadius = 2.5; // 影响范围半径（考虑中心地块0.5占用）
            
            const totalWidth = (buildInfo.getWidth() + influenceRadius * 2-1) * tileSize;
            const totalHeight = (buildInfo.getHeight() + influenceRadius * 2-1) * tileSize;
            
            // 设置绘制样式
            graphics.lineWidth = 3;
            graphics.strokeColor = new Color(0, 100, 255, 200); // 蓝色边框
            graphics.fillColor = new Color(0, 0, 0, 0); // 完全透明填充
            
            // 旋转45度
            this.influenceRangePreviewNode.angle = 45;
            
            // 绘制矩形边框（以左下角为基准点）
            // 左下角向外延伸2.5格，右上角延伸到建筑尺寸+2.5格
            const leftOffset = -influenceRadius * tileSize;
            const bottomOffset = influenceRadius * tileSize; // 修正为正值，确保是左下角
            
            graphics.rect(leftOffset, -bottomOffset,  totalHeight,totalWidth);
            graphics.fill();
            graphics.stroke();
        }
    }
    
    /**
     * 结束拖拽
     */
    private endDrag(touchPos: Vec3) {
        this.isDragging = false;
        
        // 重置操作状态为空闲
        PlayerOperationState.resetToIdle();
        
        // 隐藏预览节点（但不隐藏重新放置的节点）
        if (this.previewNode && this.previewNode !== this.replacementNode) {
            this.previewNode.active = false;
            this.previewNode.parent = null;
        }
        
        // 隐藏影响范围预览节点
        if (this.influenceRangePreviewNode) {
            this.influenceRangePreviewNode.active = false;
            this.influenceRangePreviewNode.parent = null;
        }
        
        // 尝试在地图上放置建筑
        this.tryPlaceBuilding(touchPos);
        

        
        console.log('结束拖拽建筑');
    }
    
    /**
     * 尝试在地图上放置建筑
     */
    private tryPlaceBuilding(touchPos: Vec3) {
        if (!this.tileOccupancyManager || !this.currentBuildInfo) {
            console.warn('缺少必要组件或未设置建筑信息，无法放置建筑');
            this.handlePlacementFailure('缺少必要组件或建筑信息');
            return;
        }
        
        if (!this.currentBuildInfo.getBuildingPrefab() && !this.replacementNode) {
            console.warn('当前建筑信息缺少建筑预制体');
            this.handlePlacementFailure('建筑预制体缺失');
            return;
        }
        
        // 委托给TileOccupancyManager处理建筑放置
        const screenPos = new Vec2(touchPos.x, touchPos.y);
        const success = this.tileOccupancyManager.tryPlaceBuildingAtScreenPos(screenPos, this.mainCamera, this.currentBuildInfo, this.replacementNode);
        
        if (success) {
            this.onBuildingPlaced(this.currentBuildInfo);
            // 清理重新放置的节点引用
            this.replacementNode = null;
            // 重置重新放置相关信息
            this.replacementOriginalRow = -1;
            this.replacementOriginalCol = -1;
            this.replacementBuildInfo = null;
        } else {
            this.handlePlacementFailure('无法在此位置放置建筑');
        }
    }
    
    /**
     * 建筑放置完成回调
     */
    private onBuildingPlaced(buildInfo: BuildInfo) {
        // 获取建筑的影响范围并存储到buildInfo中
        const influenceRange = buildInfo.getInfluenceRange();
        buildInfo.setInfluenceRange(influenceRange);
        
        console.log(`建筑放置完成: ${buildInfo.getType()}，影响范围已存储（${influenceRange.length}个地块）`);
        
        // 调用外部回调函数
        if (this.onBuildingPlacedCallback) {
            this.onBuildingPlacedCallback();
        }
        
        // 清除建筑信息，结束放置流程
        this.clearBuildingInfo();
    }
    

    
    /**
     * 移除指定地块上的建筑
     */
    public removeBuilding(row: number, col: number): boolean {
        if (!this.tileOccupancyManager) {
            console.warn('TileOccupancyManager未设置，无法移除建筑');
            return false;
        }
        
        const result = this.tileOccupancyManager.removeBuilding(row, col);
        return result !== null;
    }
    
    /**
     * 清除所有已放置的建筑
     */
    public clearAllBuildings() {
        if (!this.tileOccupancyManager) {
            console.warn('TileOccupancyManager未设置，无法清除建筑');
            return;
        }
        
        this.tileOccupancyManager.clearAllBuildings();
    }
    
    /**
     * 获取当前建筑信息
     */
    public getCurrentBuildInfo(): BuildInfo | null {
        return this.currentBuildInfo;
    }
    

    
    /**
     * 设置主相机
     */
    public setMainCamera(camera: Camera) {
        this.mainCamera = camera;
    }
    
    /**
     * 设置地块占用管理器
     */
    public setTileOccupancyManager(manager: TileOccupancyManager) {
        this.tileOccupancyManager = manager;
    }
    
    /**
     * 设置图层根节点
     */
    public setLayerRootNode(layerRoot: Node) {
        this.layerRootNode = layerRoot;
    }
    
    /**
     * 设置重新放置的建筑节点
     */
    public setReplacementNode(node: Node) {
        this.replacementNode = node;
    }
    

    
    /**
     * 处理放置失败
     */
    private handlePlacementFailure(reason: string) {
        console.warn(`建筑放置失败: ${reason}`);
        
        // 如果是重新放置的节点，恢复到原始位置和父节点
        if (this.replacementNode && this.replacementOriginalRow >= 0 && this.replacementOriginalCol >= 0) {
            // 通过原始地块信息获取地块节点
            const tileKey = `${this.replacementOriginalRow}_${this.replacementOriginalCol}`;
            const originalTile = this.tileOccupancyManager['getTileByKey'](tileKey);
            
            if (originalTile) {
                // 恢复到原始父节点
                this.replacementNode.parent = originalTile;
                // 恢复到原始本地位置（使用默认位置）
                this.replacementNode.setPosition(Vec3.ZERO);
                this.replacementNode.active = true;
                
                // 通过TileOccupancyManager重新注册该建筑在原始位置的占用信息
                if (this.tileOccupancyManager && this.replacementBuildInfo) {
                    // 重新注册建筑占用信息
                    const success = this.tileOccupancyManager.reregisterBuildingAtPosition(
                        this.replacementOriginalRow, 
                        this.replacementOriginalCol, 
                        this.replacementBuildInfo, 
                        this.replacementNode
                    );
                    if (success) {
                        console.log(`建筑已恢复到原始位置 (${this.replacementOriginalRow}, ${this.replacementOriginalCol})`);
                    } else {
                        console.warn('恢复建筑占用信息失败');
                    }
                }
                
                console.log('已将建筑恢复到原始位置和父节点');
            } else {
                console.warn('无法找到原始地块节点');
            }
        }
        
        // 发射放置失败事件
        BuildingPlacer.eventTarget.emit('building-placement-failed', {
            reason: reason,
            buildingType: this.currentBuildInfo?.getType() || '未知建筑'
        });
        
        // 清空当前建筑信息
        this.clearBuildingInfo();
    }
    
    onDestroy() {
        // 清理资源
        this.removeInputEvents();
        this.clearBuildingInfo();
    }
}