import { _decorator, Component, Node, UITransform, Vec3, Vec2, Color, input, Input, EventMouse, Camera, Graphics, Sprite, Canvas } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 地块框选管理系统
 * 允许玩家通过鼠标框选选择多个地块
 * 根据选择区域大小改变地块颜色
 * 完全独立，不依赖地图生成器
 */
@ccclass('TileSelectionManager')
export class TileSelectionManager extends Component {
    private camera: Camera = null;
    private allTiles: Node[] = [];
    private isEnabled: boolean = true;
    private tileWidth: number = 100;
    private tileHeight: number = 100;
    private rows: number = 10;
    private columns: number = 10;
    
    @property({ tooltip: '选择框颜色' })
    selectionBoxColor: Color = new Color(0, 255, 255, 100); // 青色半透明
    
    @property({ tooltip: '有效选择颜色（蓝色）' })
    validSelectionColor: Color = new Color(0, 0, 255, 150); // 蓝色
    
    @property({ tooltip: '无效选择颜色（红色）' })
    invalidSelectionColor: Color = new Color(255, 0, 0, 150); // 红色
    
    @property({ tooltip: '最大允许选择尺寸' })
    maxSelectionSize: number = 3;
    
    // 私有变量
    private isSelecting: boolean = false;
    private startPos: Vec3 = new Vec3();
    private endPos: Vec3 = new Vec3();
    private selectionBox: Node = null;
    private selectedTiles: Node[] = [];
    private selectionGraphics: Graphics = null;
    
    start() {
        // 初始化将由ImprovedMapGenerator调用
    }
    
    /**
     * 初始化框选管理器
     * @param tiles 所有地块节点
     * @param mapConfig 地图配置信息
     */
    initialize(tiles: Node[], mapConfig: { rows: number, columns: number, tileWidth: number, tileHeight: number }) {
        this.allTiles = tiles;
        this.rows = mapConfig.rows;
        this.columns = mapConfig.columns;
        this.tileWidth = mapConfig.tileWidth;
        this.tileHeight = mapConfig.tileHeight;
        
        this.findCamera();
        this.setupInput();
        this.createSelectionBox();
        
        console.log('TileSelectionManager 初始化完成');
    }
    
    /**
     * 自动查找摄像机
     */
    private findCamera() {
        // 查找场景中的主摄像机
        const canvas = this.node.scene.getComponentInChildren(Canvas);
        if (canvas && canvas.cameraComponent) {
            this.camera = canvas.cameraComponent;
        } else {
            // 如果没找到Canvas摄像机，查找场景中的第一个摄像机
            const cameraNode = this.node.scene.getComponentInChildren(Camera);
            if (cameraNode) {
                this.camera = cameraNode;
            }
        }
        
        if (!this.camera) {
            console.warn('未找到摄像机，框选功能可能无法正常工作');
        }
    }
    
    /**
     * 更新tiles引用
     * @param tiles 所有地块节点
     */
    updateTiles(tiles: Node[]) {
        this.allTiles = tiles;
    }
    
    /**
     * 启用/禁用框选功能
     * @param enabled 是否启用
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        
        if (!enabled) {
            this.clearSelection();
            if (this.selectionBox) {
                this.selectionBox.active = false;
            }
        }
    }
    
    /**
     * 设置输入事件监听
     */
    setupInput() {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
    
    /**
     * 创建选择框
     */
    createSelectionBox() {
        this.selectionBox = new Node('SelectionBox');
        this.selectionBox.parent = this.node;
        
        const transform = this.selectionBox.addComponent(UITransform);
        transform.setContentSize(0, 0);
        
        this.selectionGraphics = this.selectionBox.addComponent(Graphics);
        this.selectionBox.setPosition(0, 0, 0);
        this.selectionBox.active = false;
    }
    
    /**
     * 鼠标按下事件
     */
    onMouseDown(event: EventMouse) {
        if (!this.isEnabled) return;
        
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.isSelecting = true;
            this.startPos = this.screenToWorldPos(event.getLocation());
            this.endPos = this.startPos.clone();
            
            // 清除之前的选择
            this.clearSelection();
            
            // 显示选择框
            this.selectionBox.active = true;
            this.updateSelectionBox();
        }
    }
    
    /**
     * 鼠标移动事件
     */
    onMouseMove(event: EventMouse) {
        if (!this.isEnabled || !this.isSelecting) return;
        
        if (this.isSelecting) {
            this.endPos = this.screenToWorldPos(event.getLocation());
            this.updateSelectionBox();
            this.updateTileSelection();
        }
    }
    
    /**
     * 鼠标抬起事件
     */
    onMouseUp(event: EventMouse) {
        if (!this.isEnabled) return;
        
        if (event.getButton() === EventMouse.BUTTON_LEFT && this.isSelecting) {
            this.isSelecting = false;
            this.selectionBox.active = false;
            
            // 最终确定选择
            this.finalizeSelection();
        }
    }
    
    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorldPos(screenPos: Vec2): Vec3 {
        if (!this.camera) {
            console.warn('摄像机引用为空');
            return new Vec3(screenPos.x, screenPos.y, 0);
        }
        
        const worldPos = new Vec3();
        this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0), worldPos);
        return worldPos;
    }
    
    /**
     * 更新选择框显示
     */
    updateSelectionBox() {
        if (!this.selectionGraphics) return;
        
        const minX = Math.min(this.startPos.x, this.endPos.x);
        const maxX = Math.max(this.startPos.x, this.endPos.x);
        const minY = Math.min(this.startPos.y, this.endPos.y);
        const maxY = Math.max(this.startPos.y, this.endPos.y);
        
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        
        // 设置选择框位置和大小
        this.selectionBox.setPosition(centerX, centerY, 0);
        const transform = this.selectionBox.getComponent(UITransform);
        transform.setContentSize(width, height);
        
        // 绘制选择框
        this.selectionGraphics.clear();
        this.selectionGraphics.strokeColor = this.selectionBoxColor;
        this.selectionGraphics.lineWidth = 2;
        this.selectionGraphics.rect(-width * 0.5, -height * 0.5, width, height);
        this.selectionGraphics.stroke();
    }
    
    /**
     * 更新地块选择状态
     */
    updateTileSelection() {
        if (this.allTiles.length === 0) return;
        
        // 清除之前的选择
        this.clearTileColors();
        this.selectedTiles = [];
        
        // 计算选择区域
        const minX = Math.min(this.startPos.x, this.endPos.x);
        const maxX = Math.max(this.startPos.x, this.endPos.x);
        const minY = Math.min(this.startPos.y, this.endPos.y);
        const maxY = Math.max(this.startPos.y, this.endPos.y);
        
        // 遍历所有地块，检查是否在选择区域内
        let selectedRows = new Set<number>();
        let selectedCols = new Set<number>();
        
        this.allTiles.forEach(tile => {
            const tilePos = tile.getWorldPosition();
            
            // 检查地块是否在选择区域内
            if (tilePos.x >= minX && tilePos.x <= maxX && 
                tilePos.y >= minY && tilePos.y <= maxY) {
                this.selectedTiles.push(tile);
                
                // 从tile名称中提取行列信息
                const tileName = tile.name;
                const match = tileName.match(/Tile_(\d+)_(\d+)/);
                if (match) {
                    const row = parseInt(match[1]);
                    const col = parseInt(match[2]);
                    selectedRows.add(row);
                    selectedCols.add(col);
                }
            }
        });
        
        // 计算选择区域的尺寸
        const selectionWidth = selectedCols.size;
        const selectionHeight = selectedRows.size;
        
        // 根据选择尺寸决定颜色
        const isValidSelection = selectionWidth <= this.maxSelectionSize && selectionHeight <= this.maxSelectionSize;
        const tileColor = isValidSelection ? this.validSelectionColor : this.invalidSelectionColor;
        
        // 应用颜色到选中的地块
        this.applyColorToTiles(this.selectedTiles, tileColor);
    }
    
    /**
     * 应用颜色到地块
     */
    applyColorToTiles(tiles: Node[], color: Color) {
        tiles.forEach(tile => {
            this.setTileColor(tile, color);
        });
    }
    
    /**
     * 设置单个地块颜色
     */
    setTileColor(tile: Node, color: Color) {
        // 查找地块中的Sprite组件
        let sprite = tile.getComponent(Sprite);
        
        // 如果没有直接的Sprite组件，查找子节点中的Sprite
        if (!sprite) {
            const findSpriteInChildren = (node: Node): Sprite => {
                const childSprite = node.getComponent(Sprite);
                if (childSprite) return childSprite;
                
                for (let child of node.children) {
                    const result = findSpriteInChildren(child);
                    if (result) return result;
                }
                return null;
            };
            
            sprite = findSpriteInChildren(tile);
        }
        
        if (sprite) {
            sprite.color = color;
        }
    }
    
    /**
     * 清除地块颜色
     */
    clearTileColors() {
        this.allTiles.forEach(tile => {
            this.setTileColor(tile, Color.WHITE); // 恢复原色
        });
    }
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.clearTileColors();
        this.selectedTiles = [];
    }
    
    /**
     * 最终确定选择
     */
    finalizeSelection() {
        if (this.selectedTiles.length > 0) {
            console.log(`选择了 ${this.selectedTiles.length} 个地块`);
            
            // 这里可以添加选择完成后的逻辑
            // 比如触发建造系统等
        }
    }
    
    /**
     * 获取当前选择的地块
     */
    getSelectedTiles(): Node[] {
        return [...this.selectedTiles];
    }
    
    /**
     * 设置最大选择尺寸
     */
    setMaxSelectionSize(size: number) {
        this.maxSelectionSize = Math.max(1, size);
    }
    
    /**
     * 获取选择区域信息
     */
    getSelectionInfo() {
        if (this.selectedTiles.length === 0) {
            return null;
        }
        
        // 计算选择区域的行列范围
        let minRow = Infinity, maxRow = -Infinity;
        let minCol = Infinity, maxCol = -Infinity;
        
        this.selectedTiles.forEach(tile => {
            const tileName = tile.name;
            const match = tileName.match(/Tile_(\d+)_(\d+)/);
            if (match) {
                const row = parseInt(match[1]);
                const col = parseInt(match[2]);
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
                minCol = Math.min(minCol, col);
                maxCol = Math.max(maxCol, col);
            }
        });
        
        return {
            tileCount: this.selectedTiles.length,
            rowRange: { min: minRow, max: maxRow },
            colRange: { min: minCol, max: maxCol },
            width: maxCol - minCol + 1,
            height: maxRow - minRow + 1,
            isValid: (maxCol - minCol + 1) <= this.maxSelectionSize && (maxRow - minRow + 1) <= this.maxSelectionSize
        };
    }
    
    onDestroy() {
        // 清理输入事件监听
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
}