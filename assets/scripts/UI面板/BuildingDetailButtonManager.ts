import { _decorator, Component, Node, Button, Label, Vec3, UITransform, Canvas, Camera, tween, Color, Sprite, Prefab, instantiate, input, Input, EventTouch } from 'cc';
import { BuildingDetailPanelManager } from './BuildingDetailPanelManager';

/**
 * 地块占用信息接口（从TileOccupancyManager复制，避免循环依赖）
 */
export interface TileOccupancyInfo {
    buildingId: string;
    buildingType: string;
    anchorRow: number;
    anchorCol: number;
    width: number;
    height: number;
    buildingNode: Node;
}

/**
 * 相机移动监听器接口
 */
interface CameraMovementListener {
    onCameraMove(cameraPosition: Vec3): void;
}

const { ccclass, property } = _decorator;

/**
 * 建筑详情按钮管理器
 * 负责为建筑节点创建和管理详情按钮，按钮作为建筑节点的直接子节点
 * 这样按钮会自动跟随建筑节点移动，无需手动同步位置
 * 
 * 工作流程：
 * 1. 只有通过TileOccupancyManager真正放置到地图上的建筑才会创建详情按钮
 * 2. 当建筑放置到地图时，TileOccupancyManager会调用showDetailButton方法
 * 3. bindingBuildings数组已弃用，不再在start方法中自动创建按钮
 */
@ccclass('BuildingDetailButtonManager')
export class BuildingDetailButtonManager extends Component implements CameraMovementListener {
    @property({ type: Prefab, tooltip: '详情按钮预制体' })
    detailButtonPrefab: Prefab | null = null;
    
    @property({ type: BuildingDetailPanelManager, tooltip: '建筑详情面板管理器' })
    detailPanelManager: BuildingDetailPanelManager | null = null;
    
    @property({ type: [Node], tooltip: '绑定的建筑节点数组（已弃用）- 现在按钮只会为真正放置到地图上的建筑创建' })
    bindingBuildings: Node[] = [];
    
    // 按钮样式属性已移除，因为使用预制体
    
    @property({ tooltip: '按钮相对建筑的偏移' })
    buttonOffset: Vec3 = new Vec3(0, 80, 0);
    
    @property({ type: Node, tooltip: '相机节点' })
    cameraNode: Node | null = null;
    
    @property({ type: Node, tooltip: '地图容器节点 (Canvas/地图生成区域/MapContainer) - 可选，用于兼容性' })
    mapContainer: Node | null = null;
    
    // 私有变量
    private buildingButtonMap: Map<Node, Node> = new Map(); // 建筑节点到按钮节点的映射
    private lastCameraPosition: Vec3 = new Vec3(); // 上一次相机位置
    private isTrackingCamera: boolean = false; // 是否正在跟踪相机移动
    private currentVisibleButton: Node | null = null; // 当前显示的详情按钮
    private currentVisibleBuilding: Node | null = null; // 当前显示按钮的建筑节点
    
    start() {
        this.initializeButtonPrefab();
        // 移除自动初始化绑定建筑的按钮，只有真正放置到地图上的建筑才会创建按钮
        this.initializeCameraTracking();
        // 添加全局点击监听器
        this.initializeGlobalClickListener();
    }
    
    /**
     * 初始化按钮预制体
     */
    private initializeButtonPrefab() {
        if (!this.detailButtonPrefab) {
            console.error('详情按钮预制体未设置，请在编辑器中设置预制体');
        }
    }
    
    /**
     * 初始化相机跟踪
     */
    private initializeCameraTracking() {
        if (this.cameraNode) {
            this.lastCameraPosition.set(this.cameraNode.position);
            this.isTrackingCamera = true;
            console.log('BuildingDetailButtonManager: 开始跟踪相机移动');
        } else {
            console.warn('BuildingDetailButtonManager: 相机节点未设置，无法跟踪相机移动');
        }
    }
    
    /**
     * 初始化全局点击监听器
     */
    private initializeGlobalClickListener() {
        input.on(Input.EventType.TOUCH_START, this.onGlobalTouch, this);
        console.log('BuildingDetailButtonManager: 已添加全局点击监听器');
    }
    
    /**
     * 相机移动监听接口实现
     * 由于按钮现在是建筑节点的子节点，会自动跟随父节点移动，此方法保留用于扩展
     */
    onCameraMove(cameraPosition: Vec3): void {
        if (!this.isTrackingCamera) return;
        
        // 计算相机移动的偏移量
        const deltaX = cameraPosition.x - this.lastCameraPosition.x;
        const deltaY = cameraPosition.y - this.lastCameraPosition.y;
        
        // 按钮会自动跟随建筑节点移动，这里可以添加其他相机移动相关的逻辑
        this.updateAllButtonPositions(deltaX, deltaY);
        
        // 更新上一次相机位置
        this.lastCameraPosition.set(cameraPosition);
    }
    
    /**
     * 更新所有按钮位置
     * 由于按钮现在是建筑节点的子节点，它们会自动跟随父节点移动，无需手动更新位置
     */
    private updateAllButtonPositions(deltaX: number, deltaY: number) {
        // 按钮作为建筑节点的子节点，会自动跟随父节点移动
        // 这里可以添加其他需要在相机移动时执行的逻辑
    }
    
    /**
     * 更新单个按钮位置
     */
    private updateButtonPosition(buttonNode: Node, buildingNode: Node) {
        if (!buttonNode || !buildingNode) return;
        
        // 由于按钮现在是建筑节点的子节点，只需要设置本地偏移位置
        buttonNode.setPosition(this.buttonOffset);
    }
    

    /**
     * 为建筑节点创建详情按钮
     */
    private createDetailButtonForBuilding(buildingNode: Node): Node | null {
        // 查找建筑节点下的Sprite子节点
        const spriteNode = buildingNode.getChildByName('Sprite');
        if (!spriteNode) {
            console.error(`建筑 ${buildingNode.name} 没有找到Sprite子节点，无法创建详情按钮`);
            return null;
        }
        
        // 检查是否已经为该建筑根节点创建了管理器控制的按钮
        const existingButton = this.findManagedButtonInHierarchy(buildingNode);
        if (existingButton) {
            console.warn(`建筑 ${buildingNode.name} 已经有管理器创建的详情按钮`);
            return existingButton;
        }
        
        let buttonNode: Node;
        
        if (!this.detailButtonPrefab) {
            console.error('详情按钮预制体未设置，无法创建按钮');
            return null;
        }
        
        // 使用预制体创建按钮
        buttonNode = instantiate(this.detailButtonPrefab);
        
        if (buttonNode) {
            // 设置唯一的名称以区分管理器创建的按钮
            buttonNode.name = 'ManagedDetailButton';
            
            // 【优化】直接获取最终目标节点（地图生成区域节点）
            const targetParentNode = this.getMapGenerationAreaNode(buildingNode);
            if (!targetParentNode) {
                console.error(`无法找到地图生成区域节点，无法创建按钮`);
                buttonNode.destroy();
                return null;
            }
            
            // 【优化】计算按钮在目标父节点下的正确位置
            const buttonWorldPosition = this.calculateButtonWorldPosition(buildingNode, spriteNode);
            
            // 【优化】直接将按钮挂载到最终目标节点
            buttonNode.setParent(targetParentNode);
            
            // 【优化】将世界坐标转换为目标父节点的本地坐标
            const localPos = new Vec3();
            targetParentNode.inverseTransformPoint(localPos, buttonWorldPosition);
            buttonNode.setPosition(localPos);
            
            // 在按钮节点上保存建筑节点的引用，确保能获取建筑信息
            (buttonNode as any)._buildingNodeRef = buildingNode;
            
            // 设置按钮点击事件
            const button = buttonNode.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onDetailButtonClicked, this);
            }
            
            // 移除关闭按钮的事件绑定，因为现在点击任何地方都会关闭
            const closeButton = buttonNode.getChildByName('CloseButton');
            if (closeButton) {
                closeButton.active = false;
                console.log(`隐藏了建筑 ${buildingNode.name} 的关闭按钮，现在点击任何地方都会关闭详情按钮`);
            }
            
            console.log(`为建筑 ${buildingNode.name} 创建了详情按钮，直接挂载到地图生成区域节点: ${targetParentNode.name}`);
            
            // 【优化】按钮创建后立即可见，无需等待跳转序列
            buttonNode.active = true;
        }
        
        return buttonNode;
    }
    /**
     * 【优化新增】获取地图生成区域节点
     */
    private getMapGenerationAreaNode(buildingNode: Node): Node | null {
        // 按照层级结构：建筑节点 -> Tile节点 -> MapContainer节点 -> 地图生成区域节点
        const tileNode = buildingNode.parent;
        if (!tileNode) {
            console.error('找不到Tile节点');
            return null;
        }
        
        const mapContainer = tileNode.parent;
        if (!mapContainer) {
            console.error('找不到MapContainer节点');
            return null;
        }
        
        const mapGenerationArea = mapContainer.parent;
        if (!mapGenerationArea) {
            console.error('找不到地图生成区域节点');
            return null;
        }
        
        return mapGenerationArea;
    }

    /**
     * 【优化新增】计算按钮在世界坐标系中的位置
     */
    private calculateButtonWorldPosition(buildingNode: Node, spriteNode: Node): Vec3 {
        // 计算Sprite节点的世界坐标
        const spriteWorldPos = spriteNode.getWorldPosition();
        
        // 应用按钮偏移（偏移量在世界坐标系中）
        const buttonWorldPosition = new Vec3(
            spriteWorldPos.x + this.buttonOffset.x,
            spriteWorldPos.y + this.buttonOffset.y,
            spriteWorldPos.z + this.buttonOffset.z
        );
        
        return buttonWorldPosition;
    }
    

    
    /**
     * 全局点击事件处理
     */
    private onGlobalTouch(event: EventTouch) {
        // 如果当前有显示的详情按钮，隐藏它
        if (this.currentVisibleButton && this.currentVisibleBuilding) {
            this.hideBuildingDetailButton(this.currentVisibleBuilding);
        }
    }
    
    /**
     * 详情按钮点击事件
     */
    private onDetailButtonClicked(event: any) {
        // 阻止事件冒泡，避免触发全局点击事件
        event.propagationStopped = true;
        
        // 获取点击的详情按钮
        const detailButtonNode = event.target;
        
        // 优先从按钮节点上获取保存的建筑节点引用
        let buildingNode: Node | null = (detailButtonNode as any)._buildingNodeRef || null;
        
        // 如果直接引用不存在，则通过buildingButtonMap反向查找
        if (!buildingNode) {
            for (const [building, button] of this.buildingButtonMap) {
                if (button === detailButtonNode) {
                    buildingNode = building;
                    break;
                }
            }
        }
        
        if (buildingNode && buildingNode.isValid) {
            // 先关闭"查看详情"按钮
            this.hideBuildingDetailButton(buildingNode);
            
            // 获取建筑信息用于日志输出
            const buildInfo = buildingNode.getComponent('BuildInfo') as any;
            if (buildInfo) {
                const position = buildInfo.getCurrentPosition();
                if (position && position.row >= 0 && position.col >= 0) {
                    console.log(`查看建筑详情: ${buildInfo.getBuildingType()}`);
                    console.log(`建筑位置: (${position.row}, ${position.col})`);
                    console.log(`建筑尺寸: ${buildInfo.getBuildingWidth()}x${buildInfo.getBuildingHeight()}`);
                }
            }
            
            // 然后显示详情面板，传递建筑节点
            this.showBuildingDetailPanel(buildingNode);
        } else {
            console.error('无法找到对应的建筑节点或建筑节点已失效，建筑信息可能已丢失');
        }
    }
    

    
    /**
     * 显示建筑详情面板
     */
    private showBuildingDetailPanel(buildingNode?: Node) {
        if (!this.detailPanelManager) {
            console.error('建筑详情面板管理器未设置，请在编辑器中拖拽设置');
            return;
        }
        
        if (!buildingNode) {
            console.error('建筑节点无效，无法显示详情面板');
            return;
        }
        
        // 使用详情面板管理器显示面板
        this.detailPanelManager.showBuildingDetailPanel(buildingNode);
    }

    

    


     
    /**
     * 检查指定建筑的按钮是否可见
     * @param buildingNode 建筑节点
     * @returns 按钮是否可见
     */
    public isBuildingButtonVisible(buildingNode: Node): boolean {
        if (!buildingNode || !buildingNode.isValid) {
            return false;
        }
        
        const detailButton = this.buildingButtonMap.get(buildingNode);
        return detailButton ? detailButton.active : false;
    }
    
    /**
     * 显示详情按钮
     * @param buildingNode 建筑节点
     * @param buildingInfo 建筑信息
     */
    public showDetailButton(buildingNode: Node, buildingInfo: TileOccupancyInfo) {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法显示详情按钮');
            return;
        }
        
        // 检查该建筑的按钮是否已经显示
        if (this.isBuildingButtonVisible(buildingNode)) {
            console.log('该建筑的详情按钮已经显示，不做任何改变');
            return;
        }
        
        // 检查是否有预先绑定的按钮
        let detailButton = this.buildingButtonMap.get(buildingNode);
        
        if (!detailButton) {
            // 为建筑创建详情按钮（按钮会在跳转序列完成后自动显示）
            detailButton = this.createDetailButtonForBuilding(buildingNode);
            if (detailButton) {
                this.buildingButtonMap.set(buildingNode, detailButton);
                
                // 隐藏之前显示的按钮（如果有的话）
                if (this.currentVisibleButton && this.currentVisibleBuilding) {
                    this.hideBuildingDetailButton(this.currentVisibleBuilding);
                }
                
                // 更新当前显示的按钮状态（注意：按钮此时还未显示，会在跳转完成后显示）
                this.currentVisibleButton = detailButton;
                this.currentVisibleBuilding = buildingNode;
                
                // 【优化】立即播放显示动画，无需等待跳转序列
                this.playShowAnimation(detailButton);
                
                console.log(`开始为建筑创建详情按钮: ${buildingInfo.buildingType}`);
            }
        } else if (detailButton && detailButton.isValid) {
             // 按钮已存在，直接显示
             // 隐藏之前显示的按钮（如果有的话）
             if (this.currentVisibleButton && this.currentVisibleBuilding) {
                 this.hideBuildingDetailButton(this.currentVisibleBuilding);
             }
             
             // 显示按钮
             detailButton.active = true;
             
             // 更新当前显示的按钮状态
             this.currentVisibleButton = detailButton;
             this.currentVisibleBuilding = buildingNode;
             
             // 播放显示动画
             this.playShowAnimation(detailButton);
             
             console.log(`显示建筑详情按钮: ${buildingInfo.buildingType}`);
         }
    }
    
    /**
     * 每帧更新 - 检测相机移动（可选，用于扩展功能）
     */
    update(deltaTime: number) {
        // 由于按钮现在是建筑节点的子节点，不需要手动跟踪相机移动来更新按钮位置
        // 这里保留相机跟踪逻辑用于其他可能的扩展功能
        if (this.isTrackingCamera && this.cameraNode) {
            const currentCameraPos = this.cameraNode.position;
            
            // 检查相机位置是否发生变化
            if (!currentCameraPos.equals(this.lastCameraPosition)) {
                this.onCameraMove(currentCameraPos);
            }
        }
    }
    
    /**
     * 隐藏指定建筑的详情按钮
     * @param buildingNode 建筑节点
     */
    public hideBuildingDetailButton(buildingNode: Node) {
        if (!buildingNode || !buildingNode.isValid) {
            console.warn('建筑节点无效，无法隐藏详情按钮');
            return;
        }
        
        const detailButton = this.buildingButtonMap.get(buildingNode);
        if (detailButton && detailButton.isValid && detailButton.active) {
            this.playHideAnimation(detailButton, () => {
                if (detailButton && detailButton.isValid) {
                    detailButton.active = false; // 隐藏而不是销毁
                }
            });
            
            // 清除当前显示状态
            if (this.currentVisibleButton === detailButton) {
                this.currentVisibleButton = null;
                this.currentVisibleBuilding = null;
            }
            
            console.log(`隐藏建筑 ${buildingNode.name} 的详情按钮`);
        }
    }
    
    /**
     * 更新按钮偏移位置
     */
    public updateButtonOffset(offset: Vec3) {
        this.buttonOffset = offset;
        
        // 更新所有绑定建筑的按钮位置
        this.buildingButtonMap.forEach((buttonNode, buildingNode) => {
            if (buttonNode && buttonNode.isValid) {
                this.updateButtonPosition(buttonNode, buildingNode);
            }
        });
    }
    
    /**
     * 播放显示动画
     */
    private playShowAnimation(buttonNode: Node) {
        if (!buttonNode) {
            return;
        }
        
        // 设置初始状态
        buttonNode.setScale(0.5, 0.5, 1);
        
        // 播放缩放动画
        tween(buttonNode)
            .to(0.2, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'sineOut' })
            .start();
    }
    
    /**
     * 播放隐藏动画
     */
    private playHideAnimation(buttonNode: Node, callback?: Function) {
        if (!buttonNode) {
            if (callback) callback();
            return;
        }
        
        // 播放缩放动画
        tween(buttonNode)
            .to(0.15, { scale: new Vec3(0.8, 0.8, 1) }, { easing: 'sineIn' })
            .call(() => {
                if (callback) callback();
            })
            .start();
    }
    
    /**
     * 检查是否有按钮正在显示
     */
    public isDetailButtonVisible(): boolean {
        // 检查是否有任何建筑的按钮正在显示
        for (const [buildingNode, buttonNode] of this.buildingButtonMap) {
            if (buttonNode && buttonNode.isValid && buttonNode.active) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 设置按钮偏移量
     */
    public setButtonOffset(offset: Vec3) {
        this.buttonOffset = offset;
        
        // 更新所有绑定建筑的按钮位置
        this.buildingButtonMap.forEach((buttonNode, buildingNode) => {
            if (buttonNode && buttonNode.isValid) {
                this.updateButtonPosition(buttonNode, buildingNode);
            }
        });
    }
    

    
    /**
     * 设置相机节点
     */
    public setCameraNode(cameraNode: Node) {
        this.cameraNode = cameraNode;
        if (cameraNode) {
            this.lastCameraPosition.set(cameraNode.position);
            this.isTrackingCamera = true;
            console.log('BuildingDetailButtonManager: 设置相机节点并开始跟踪');
        } else {
            this.isTrackingCamera = false;
            console.warn('BuildingDetailButtonManager: 相机节点为空，停止跟踪');
        }
    }
    
    /**
     * 设置地图容器节点
     */
    public setMapContainer(mapContainer: Node) {
        this.mapContainer = mapContainer;
    }
    
    /**
     * 清理指定建筑的管理器创建的按钮
     */
    public cleanupBuildingButton(buildingNode: Node) {
        if (!buildingNode || !buildingNode.isValid) {
            return;
        }
        
        // 从映射中移除并清理按钮
        const button = this.buildingButtonMap.get(buildingNode);
        if (button && button.isValid) {
            const buttonComponent = button.getComponent(Button);
            if (buttonComponent) {
                buttonComponent.node.off(Button.EventType.CLICK, this.onDetailButtonClicked, this);
            }
            
            // 清除当前显示状态（如果是当前显示的按钮）
            if (this.currentVisibleButton === button) {
                this.currentVisibleButton = null;
                this.currentVisibleBuilding = null;
            }
            
            button.destroy();
            this.buildingButtonMap.delete(buildingNode);
            console.log(`清理了建筑 ${buildingNode.name} 的管理器按钮`);
        }
        
        // 【优化】清理可能存在于地图生成区域节点中的管理器创建的按钮
        this.cleanupManagedButtonInHierarchy(buildingNode);
        
        // 注意：已移除全局状态管理，每个建筑的按钮独立管理
    }
    
    /**
     * 【优化】在节点层级中查找管理器创建的按钮
     */
    private findManagedButtonInHierarchy(buildingNode: Node): Node | null {
        if (!buildingNode || !buildingNode.isValid) {
            return null;
        }
        
        // 【优化】直接在地图生成区域节点中查找
        const mapGenerationArea = this.getMapGenerationAreaNode(buildingNode);
        if (mapGenerationArea) {
            const children = mapGenerationArea.children;
            for (const child of children) {
                if (child.name === 'ManagedDetailButton') {
                    const buildingRef = (child as any)._buildingNodeRef;
                    if (buildingRef === buildingNode) {
                        return child;
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * 在节点层次结构中清理管理器创建的按钮
     * 按钮可能在建筑节点、Tile节点、MapContainer节点或地图生成区域节点中
     */
    private cleanupManagedButtonInHierarchy(buildingNode: Node) {
        if (!buildingNode || !buildingNode.isValid) {
            return;
        }
        
        // 【优化】直接在地图生成区域节点中查找并清理
        const mapGenerationArea = this.getMapGenerationAreaNode(buildingNode);
        if (mapGenerationArea) {
            const children = mapGenerationArea.children;
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (child.name === 'ManagedDetailButton') {
                    const buildingRef = (child as any)._buildingNodeRef;
                    if (buildingRef === buildingNode) {
                        this.destroyManagedButton(child, '地图生成区域节点清理');
                    }
                }
            }
        }
    }
    
    /**
     * 销毁管理器创建的按钮
     */
    private destroyManagedButton(buttonNode: Node, location: string) {
        if (!buttonNode || !buttonNode.isValid) {
            return;
        }
        
        const buttonComponent = buttonNode.getComponent(Button);
        if (buttonComponent) {
            buttonComponent.node.off(Button.EventType.CLICK, this.onDetailButtonClicked, this);
        }
        
        // 清理建筑节点引用，防止内存泄漏
        (buttonNode as any)._buildingNodeRef = null;
        
        // 清除当前显示状态（如果是当前显示的按钮）
        if (this.currentVisibleButton === buttonNode) {
            this.currentVisibleButton = null;
            this.currentVisibleBuilding = null;
        }
        
        buttonNode.destroy();
        console.log(`清理了${location}下的管理器按钮`);
    }
    
    /**
     * 清理所有管理器创建的按钮
     */
    private cleanupAllManagedButtons() {
        // 清理buildingButtonMap中的按钮
        this.buildingButtonMap.forEach((button, building) => {
            if (button && button.isValid) {
                const buttonComponent = button.getComponent(Button);
                if (buttonComponent) {
                    buttonComponent.node.off(Button.EventType.CLICK, this.onDetailButtonClicked, this);
                }
                
                button.destroy();
            }
        });
        this.buildingButtonMap.clear();
        
        // 清除当前显示状态
        this.currentVisibleButton = null;
        this.currentVisibleBuilding = null;
        
        // 额外清理：遍历所有绑定的建筑，清理可能遗留的ManagedDetailButton（现在在Sprite节点下）
        this.bindingBuildings.forEach(building => {
            if (building && building.isValid) {
                const spriteNode = building.getChildByName('Sprite');
                if (spriteNode) {
                    const managedButton = spriteNode.getChildByName('ManagedDetailButton');
                    if (managedButton && managedButton.isValid) {
                        const buttonComponent = managedButton.getComponent(Button);
                        if (buttonComponent) {
                            buttonComponent.node.off(Button.EventType.CLICK, this.onDetailButtonClicked, this);
                        }
                        
                        managedButton.destroy();
                        console.log(`清理了建筑 ${building.name} 的Sprite节点下的遗留管理器按钮`);
                    }
                }
            }
        });
    }
    
    onDestroy() {
        // 清理全局点击监听器
        input.off(Input.EventType.TOUCH_START, this.onGlobalTouch, this);
        
        // 清理详情面板
        if (this.detailPanelManager) {
            this.detailPanelManager.closeBuildingDetailPanel();
        }
        
        // 清理所有管理器创建的按钮
        this.cleanupAllManagedButtons();
        
        // 清理所有详情按钮的事件监听
        this.buildingButtonMap.forEach((buttonNode, buildingNode) => {
            if (buttonNode && buttonNode.isValid) {
                const button = buttonNode.getComponent(Button);
                if (button) {
                    button.node.off(Button.EventType.CLICK, this.onDetailButtonClicked, this);
                }
            }
        });
        
        // 清空映射表和状态
        this.buildingButtonMap.clear();
        this.currentVisibleButton = null;
        this.currentVisibleBuilding = null;
        
        console.log('BuildingDetailButtonManager: 已清理所有事件监听器');
    }
}