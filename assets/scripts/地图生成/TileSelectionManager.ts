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
    private tileSize: number = 100;
    private rows: number = 10;
    private columns: number = 10;
    
    // 删除选择框颜色属性
    
    @property({ tooltip: '有效选择颜色（蓝色）' })
    validSelectionColor: Color = new Color(0, 0, 255, 150); // 蓝色
    
    @property({ tooltip: '无效选择颜色（红色）' })
    invalidSelectionColor: Color = new Color(255, 0, 0, 150); // 红色
    
    @property({ tooltip: '最大允许选择尺寸' })
    maxSelectionSize: number = 3;
    
    // 私有变量
    private isSelecting: boolean = false;
    private startTile: { row: number, col: number } | null = null;
    private endTile: { row: number, col: number } | null = null;
    private selectedTiles: Node[] = [];
    private tileMap: Map<string, Node> = new Map(); // 存储地块索引映射
    
    start() {
        // 初始化将由ImprovedMapGenerator调用
    }
    
    /**
     * 初始化框选管理器
     * @param tiles 所有地块节点
     * @param mapConfig 地图配置信息
     */
    initialize(tiles: Node[], mapConfig: { rows: number, columns: number, tileSize: number }) {
        this.allTiles = tiles;
        this.rows = mapConfig.rows;
        this.columns = mapConfig.columns;
        this.tileSize = mapConfig.tileSize;
        
        // 建立地块索引映射
        this.buildTileMap();
        
        this.findCamera();
        this.setupInput();
        
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
            console.log('找到Canvas摄像机');
        } else {
            // 如果没找到Canvas摄像机，查找场景中的第一个摄像机
            const cameraNode = this.node.scene.getComponentInChildren(Camera);
            if (cameraNode) {
                this.camera = cameraNode;
                console.log('找到场景摄像机');
            }
        }
        
        if (!this.camera) {
            console.warn('未找到摄像机，框选功能可能无法正常工作');
        } else {
            console.log('摄像机初始化成功:', this.camera.node.name);
        }
    }
    
    /**
     * 建立地块索引映射
     */
    private buildTileMap() {
        this.tileMap.clear();
        this.allTiles.forEach(tile => {
            const tileName = tile.name;
            const match = tileName.match(/Tile_(\d+)_(\d+)/);
            if (match) {
                const i = parseInt(match[1]);
                const j = parseInt(match[2]);
                const key = `${i}_${j}`;
                this.tileMap.set(key, tile);
            }
        });
    }
    
    /**
     * 更新tiles引用
     * @param tiles 所有地块节点
     */
    updateTiles(tiles: Node[]) {
        this.allTiles = tiles;
        this.buildTileMap();
    }
    
    /**
     * 启用/禁用框选功能
     * @param enabled 是否启用
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        
        if (!enabled) {
            this.clearSelection();
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
     * 鼠标按下事件
     */
    onMouseDown(event: EventMouse) {
        if (!this.isEnabled) {
            return;
        }
        
        const screenPos = event.getLocation();
        console.log(`鼠标点击位置: (${screenPos.x}, ${screenPos.y})`);
        
        const tileInfo = this.getTileAtScreenPos(screenPos);
        if (tileInfo) {
            console.log(`找到地块: i=${tileInfo.row}, j=${tileInfo.col}`);
            this.isSelecting = true;
            this.startTile = tileInfo;
            this.endTile = tileInfo;
            this.updateSelectionByTileIndex();
        } else {
            console.log('未找到地块，清除选择');
            this.clearSelection();
        }
    }
    
    /**
     * 鼠标移动事件
     */
    onMouseMove(event: EventMouse) {
        if (!this.isEnabled || !this.isSelecting) {
            return;
        }
        
        const screenPos = event.getLocation();
        const tileInfo = this.getTileAtScreenPos(screenPos);
        if (tileInfo) {
            this.endTile = tileInfo;
            this.updateSelectionByTileIndex();
        }
    }
    
    /**
     * 鼠标抬起事件
     */
    onMouseUp(event: EventMouse) {
        if (!this.isEnabled || !this.isSelecting) {
            return;
        }
        
        this.isSelecting = false;
        console.log('选择完成');
    }
    
    /**
     * 获取屏幕位置对应的地块索引
     * 使用UITransform的isHit方法进行精确检测
     */
    private getTileAtScreenPos(screenPos: Vec2): { row: number, col: number } | null {
        const worldPos = this.screenToWorldPos(screenPos);
        
        // 遍历所有地块，使用UITransform的isHit方法检测
        for (const tile of this.allTiles) {
            const tileTransform = tile.getComponent(UITransform);
            if (!tileTransform) continue;
            
            // 使用UITransform的isHit方法，它会自动处理旋转
            // 将世界坐标转换为地块的本地坐标进行检测
            const localPos = tile.getComponent(UITransform).convertToNodeSpaceAR(worldPos);
            
            // 检查是否在UITransform的矩形范围内（本地坐标系）
            const halfWidth = tileTransform.width * 0.5;
            const halfHeight = tileTransform.height * 0.5;
            
            if (Math.abs(localPos.x) <= halfWidth && Math.abs(localPos.y) <= halfHeight) {
                // 解析地块名称获取索引
                const tileName = tile.name;
                const match = tileName.match(/Tile_(\d+)_(\d+)/);
                if (match) {
                    const i = parseInt(match[1]);
                    const j = parseInt(match[2]);
                    console.log(`检测到地块: ${tileName}, 本地坐标: (${localPos.x.toFixed(2)}, ${localPos.y.toFixed(2)})`);
                    return { row: i, col: j };
                }
            }
        }
        
        console.log(`未找到有效地块，世界坐标: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
        return null;
    }
    
    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorldPos(screenPos: Vec2): Vec3 {
        if (!this.camera) {
            console.error('Camera not found for coordinate conversion');
            return new Vec3(0, 0, 0);
        }
        
        // 直接使用摄像机的screenToWorld方法转换屏幕坐标
        const worldPos = this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
        console.log(`屏幕坐标: (${screenPos.x}, ${screenPos.y}) -> 世界坐标: (${worldPos.x}, ${worldPos.y})`);
        
        return worldPos;
    }
    
    /**
     * 基于地块索引更新选择
     */
    private updateSelectionByTileIndex() {
        if (!this.startTile || !this.endTile) return;
        
        // 清除之前的选择
        this.clearTileColors();
        this.selectedTiles = [];
        
        // 计算选择区域的边界
        const minI = Math.min(this.startTile.row, this.endTile.row);
        const maxI = Math.max(this.startTile.row, this.endTile.row);
        const minJ = Math.min(this.startTile.col, this.endTile.col);
        const maxJ = Math.max(this.startTile.col, this.endTile.col);
        
        // 选择矩形区域内的所有地块
        for (let i = minI; i <= maxI; i++) {
            for (let j = minJ; j <= maxJ; j++) {
                const key = `${i}_${j}`;
                const tile = this.tileMap.get(key);
                if (tile) {
                    this.selectedTiles.push(tile);
                }
            }
        }
        
        // 计算选择区域的尺寸
        const selectionWidth = maxJ - minJ + 1;
        const selectionHeight = maxI - minI + 1;
        
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
        this.isSelecting = false;
        this.startTile = null;
        this.endTile = null;
        this.selectedTiles = [];
        this.clearTileColors();
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
        if (this.selectedTiles.length === 0 || !this.startTile || !this.endTile) {
            return null;
        }
        
        // 计算选择区域的边界
        const minI = Math.min(this.startTile.row, this.endTile.row);
        const maxI = Math.max(this.startTile.row, this.endTile.row);
        const minJ = Math.min(this.startTile.col, this.endTile.col);
        const maxJ = Math.max(this.startTile.col, this.endTile.col);
        
        const width = maxJ - minJ + 1;
        const height = maxI - minI + 1;
        
        return {
            tileCount: this.selectedTiles.length,
            startTile: { row: this.startTile.row, col: this.startTile.col },
            endTile: { row: this.endTile.row, col: this.endTile.col },
            rowRange: { min: minI, max: maxI },
            colRange: { min: minJ, max: maxJ },
            width: width,
            height: height,
            isValid: width <= this.maxSelectionSize && height <= this.maxSelectionSize
        };
    }
    
    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
}