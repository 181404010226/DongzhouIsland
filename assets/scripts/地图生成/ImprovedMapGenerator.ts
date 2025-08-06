import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Graphics, Mask, Vec3, Color } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 改进版地图生成器
 * 使用Graphics组件绘制菱形遮罩，不依赖外部遮罩图片
 */
@ccclass('ImprovedMapGenerator')
export class ImprovedMapGenerator extends Component {
    @property({ type: [SpriteFrame], tooltip: '地块图片数组' })
    tileSprites: SpriteFrame[] = [];
    
    @property({ tooltip: '网格行数' })
    rows: number = 10;
    
    @property({ tooltip: '网格列数' })
    columns: number = 10;
    
    @property({ tooltip: '单个地块宽度' })
    tileWidth: number = 100;
    
    @property({ tooltip: '单个地块高度' })
    tileHeight: number = 100;
    
    @property({ tooltip: '是否使用菱形遮罩' })
    useDiamondMask: boolean = true;
    
    @property({ tooltip: '遮罩颜色' })
    maskColor: Color = Color.WHITE;
    
    @property({ tooltip: '菱形遮罩缩放比例(0-1)' })
    diamondScale: number = 0.9;
    
    private mapContainer: Node = null;
    
    start() {
        this.generateMap();
    }
    
    /**
     * 生成地图
     */
    generateMap() {
        if (this.tileSprites.length === 0) {
            console.warn('地块图片数组为空，无法生成地图');
            return;
        }
        
        // 清除之前的地图
        this.clearMap();
        
        // 创建地图容器
        this.createMapContainer();
        
        // 生成网格
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                this.createTile(row, col);
            }
        }
    }
    
    /**
     * 清除现有地图
     */
    clearMap() {
        if (this.mapContainer) {
            this.mapContainer.destroy();
            this.mapContainer = null;
        }
    }
    
    /**
     * 创建地图容器
     */
    createMapContainer() {
        this.mapContainer = new Node('MapContainer');
        this.mapContainer.parent = this.node;
        
        // 添加UITransform组件
        const transform = this.mapContainer.addComponent(UITransform);
        const nodeTransform = this.node.getComponent(UITransform);
        if (nodeTransform) {
            transform.setContentSize(nodeTransform.contentSize);
        }
        
        // 设置容器位置
        this.mapContainer.setPosition(0, 0, 0);
    }
    
    /**
     * 创建单个地块
     * @param row 行索引
     * @param col 列索引
     */
    createTile(row: number, col: number) {
        // 创建地块节点
        const tileNode = new Node(`Tile_${row}_${col}`);
        tileNode.parent = this.mapContainer;
        
        // 添加UITransform
        const tileTransform = tileNode.addComponent(UITransform);
        tileTransform.setContentSize(this.tileWidth, this.tileHeight);
        
        // 计算菱形网格位置
        const pos = this.calculateTilePosition(row, col);
        tileNode.setPosition(pos);
        
        if (this.useDiamondMask) {
            // 使用菱形遮罩
            this.createTileWithDiamondMask(tileNode, row, col);
        } else {
            // 直接显示矩形地块
            this.createSimpleTile(tileNode);
        }
    }
    
    /**
     * 创建带菱形遮罩的地块
     * @param tileNode 地块节点
     * @param row 行索引
     * @param col 列索引
     */
    createTileWithDiamondMask(tileNode: Node, row: number, col: number) {
        // 创建遮罩节点
        const maskNode = new Node('DiamondMask');
        maskNode.parent = tileNode;
        
        // 添加UITransform
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(this.tileWidth, this.tileHeight);
        
        // 添加Mask组件（会自动添加Graphics组件）
        const mask = maskNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        
        // 通过mask获取Graphics组件进行绘制
        const graphics = maskNode.getComponent(Graphics);
        if (graphics) {
            this.drawDiamondMask(graphics);
        }
        
        // 设置遮罩位置
        maskNode.setPosition(0, 0, 0);
        
        // 创建地块内容节点（被遮罩的内容）
        const contentNode = new Node('TileContent');
        contentNode.parent = maskNode;
        
        const contentTransform = contentNode.addComponent(UITransform);
        contentTransform.setContentSize(this.tileWidth, this.tileHeight);
        
        // 添加地块图片
        const sprite = contentNode.addComponent(Sprite);
        sprite.spriteFrame = this.getRandomTileSprite();
        
        contentNode.setPosition(0, 0, 0);
    }
    
    /**
     * 创建简单矩形地块
     * @param tileNode 地块节点
     */
    createSimpleTile(tileNode: Node) {
        // 直接添加Sprite组件
        const sprite = tileNode.addComponent(Sprite);
        sprite.spriteFrame = this.getRandomTileSprite();
    }
    
    /**
     * 绘制菱形遮罩
     * @param graphics Graphics组件
     */
    drawDiamondMask(graphics: Graphics) {
        graphics.clear();
        graphics.fillColor = this.maskColor;
        
        const halfWidth = (this.tileWidth * this.diamondScale) * 0.5;
        const halfHeight = (this.tileHeight * this.diamondScale) * 0.5;
        
        // 菱形的四个顶点
        graphics.moveTo(0, halfHeight);           // 上顶点
        graphics.lineTo(halfWidth, 0);            // 右顶点
        graphics.lineTo(0, -halfHeight);          // 下顶点
        graphics.lineTo(-halfWidth, 0);           // 左顶点
        graphics.close();                         // 闭合路径
        
        graphics.fill();
    }
    
    /**
     * 计算地块在菱形网格中的位置
     * @param row 行索引
     * @param col 列索引
     * @returns 世界坐标位置
     */
    calculateTilePosition(row: number, col: number): Vec3 {
        // 菱形网格的偏移计算
        // 奇数行向右偏移半个地块宽度
        const offsetX = (row % 2) * (this.tileWidth * 0.5);
        // 奇数行向下偏移半个地块高度，避免上下缝隙
        const offsetY = (row % 2) * (this.tileHeight * 0.0);
        
        // 计算实际位置
        const x = col * this.tileWidth + offsetX - (this.columns * this.tileWidth * 0.5) + (this.tileWidth * 0.5);
        const y = (this.rows * this.tileHeight * 0.375) - row * (this.tileHeight * 0.5) - offsetY - (this.tileHeight * 0.5);
        
        return new Vec3(x, y, 0);
    }
    
    /**
     * 随机获取一个地块图片
     * @returns 随机选择的SpriteFrame
     */
    getRandomTileSprite(): SpriteFrame {
        const randomIndex = Math.floor(Math.random() * this.tileSprites.length);
        return this.tileSprites[randomIndex];
    }
    
    /**
     * 重新生成地图（供外部调用）
     */
    regenerateMap() {
        this.generateMap();
    }
    
    /**
     * 设置地图尺寸
     * @param rows 行数
     * @param cols 列数
     */
    setMapSize(rows: number, cols: number) {
        this.rows = Math.max(1, rows);
        this.columns = Math.max(1, cols);
        this.generateMap();
    }
    
    /**
     * 设置地块尺寸
     * @param width 地块宽度
     * @param height 地块高度
     */
    setTileSize(width: number, height: number) {
        this.tileWidth = Math.max(10, width);
        this.tileHeight = Math.max(10, height);
        this.generateMap();
    }
    
    /**
     * 切换遮罩模式
     * @param useMask 是否使用菱形遮罩
     */
    toggleDiamondMask(useMask: boolean) {
        this.useDiamondMask = useMask;
        this.generateMap();
    }
    
    /**
     * 设置菱形遮罩缩放
     * @param scale 缩放比例(0-1)
     */
    setDiamondScale(scale: number) {
        this.diamondScale = Math.max(0.1, Math.min(1.0, scale));
        if (this.useDiamondMask) {
            this.generateMap();
        }
    }
    
    /**
     * 添加地块图片
     * @param spriteFrame 要添加的图片
     */
    addTileSprite(spriteFrame: SpriteFrame) {
        if (spriteFrame && this.tileSprites.indexOf(spriteFrame) === -1) {
            this.tileSprites.push(spriteFrame);
        }
    }
    
    /**
     * 移除地块图片
     * @param spriteFrame 要移除的图片
     */
    removeTileSprite(spriteFrame: SpriteFrame) {
        const index = this.tileSprites.indexOf(spriteFrame);
        if (index > -1) {
            this.tileSprites.splice(index, 1);
        }
    }
    
    /**
     * 清空所有地块图片
     */
    clearTileSprites() {
        this.tileSprites = [];
    }
    
    /**
     * 获取指定位置的地块节点
     * @param row 行索引
     * @param col 列索引
     * @returns 地块节点或null
     */
    getTileAt(row: number, col: number): Node | null {
        if (!this.mapContainer || row < 0 || row >= this.rows || col < 0 || col >= this.columns) {
            return null;
        }
        
        const tileName = `Tile_${row}_${col}`;
        return this.mapContainer.getChildByName(tileName);
    }
    
    /**
     * 获取地图信息
     * @returns 地图信息对象
     */
    getMapInfo() {
        return {
            rows: this.rows,
            columns: this.columns,
            tileWidth: this.tileWidth,
            tileHeight: this.tileHeight,
            useDiamondMask: this.useDiamondMask,
            diamondScale: this.diamondScale,
            totalTiles: this.rows * this.columns,
            spriteCount: this.tileSprites.length
        };
    }
}