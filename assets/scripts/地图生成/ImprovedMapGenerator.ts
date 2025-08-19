import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Vec3 } from 'cc';
import { TileSelectionManager } from './TileSelectionManager';
const { ccclass, property } = _decorator;

/**
 * 改进版地图生成器
 * 生成正方形地块并旋转45度形成菱形效果
 */
@ccclass('ImprovedMapGenerator')
export class ImprovedMapGenerator extends Component {
    @property({ type: [SpriteFrame], tooltip: '地块图片数组' })
    tileSprites: SpriteFrame[] = [];
    
    @property({ tooltip: '网格行数' })
    rows: number = 10;
    
    @property({ tooltip: '网格列数' })
    columns: number = 10;
    
    @property({ tooltip: '地块尺寸（正方形对角线长度）' })
    tileSize: number = 100;
    
    @property({ tooltip: '启用框选功能' })
    enableTileSelection: boolean = true;
    
    @property({ type: TileSelectionManager, tooltip: '地块选择管理器' })
    tileSelectionManager: TileSelectionManager = null;
    
    private mapContainer: Node = null;
    private allTiles: Node[] = []; // 存储所有地块的数组
    
    start() {
        this.generateMap();
        
        if (this.enableTileSelection) {
            this.setupTileSelection();
        }
    }
    
    /**
     * 生成地图
     */
    generateMap() {
        if (this.tileSprites.length === 0) {
            console.warn('地块图片数组为空，将生成没有图片的空节点');
        }
        
        // 清除之前的地图
        this.clearMap();
        
        // 创建地图容器
        this.createMapContainer();
        
        // 生成菱形网格
        this.generateDiamondGrid();
        
        // 如果启用了框选功能，更新tiles引用
         if (this.enableTileSelection && this.tileSelectionManager) {
             this.tileSelectionManager.updateTiles(this.getAllTiles());
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
        // 清空地块数组
        this.allTiles = [];
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
        const maxDimension = Math.max(this.rows, this.columns);
        
        // 计算优化后的坐标系统
        let i: number;
        let j: number;
        
        if (row < maxDimension) {
            // 在max(n,m)行之前：每新起一行i+1，每往右走一格i-1
            i = row + 1 - col;
            j = 1 + col; // j从1开始
        } else {
            // 到达max(n,m)行后：新起的行不再每次i+1
            i = maxDimension - col;
            j = col + (row - maxDimension + 2); // j从x-max(n,m)开始
        }
        
        // 创建地块节点
        const tileNode = new Node(`Tile_${i}_${j}`);
        tileNode.parent = this.mapContainer;
        
        // 添加UITransform（正方形）
        // tileSize是对角线长度，边长 = tileSize / √2
        const tileTransform = tileNode.addComponent(UITransform);
        const sideLength = this.tileSize / Math.sqrt(2);
        tileTransform.setContentSize(sideLength, sideLength);
        
        // 计算菱形网格位置
        const pos = this.calculateTilePosition(row, col);
        tileNode.setPosition(pos);
        
        // 创建旋转的正方形地块
        this.createRotatedSquareTile(tileNode);
        
        // 将地块添加到数组中
        this.allTiles.push(tileNode);
    }
    
    /**
     * 创建旋转45度的正方形地块
     * @param tileNode 地块节点
     */
    createRotatedSquareTile(tileNode: Node) {
        // 如果有图片资源，则添加Sprite组件
        if (this.tileSprites.length > 0) {
            const sprite = tileNode.addComponent(Sprite);
            sprite.spriteFrame = this.getRandomTileSprite();
        }
        
        // 确保UITransform组件存在并设置正确的尺寸
        // tileSize是对角线长度，边长 = tileSize / √2
        const transform = tileNode.getComponent(UITransform) || tileNode.addComponent(UITransform);
        const sideLength = this.tileSize / Math.sqrt(2);
        transform.setContentSize(sideLength, sideLength);
        
        // 旋转-45度形成菱形效果
        tileNode.setRotationFromEuler(0, 0, 45);
    }
    
    /**
     * 生成菱形网格
     */
    private generateDiamondGrid() {
        const totalRows = this.rows + this.columns - 1;
        const minDimension = Math.min(this.rows, this.columns);
        const maxDimension = Math.max(this.rows, this.columns);
        
        for (let row = 0; row < totalRows; row++) {
            // 计算当前行的地块数量
            let tilesInRow: number;
            if (row < minDimension) {
                // 前半部分：逐行增加
                tilesInRow = row + 1;
            } else if (row < maxDimension) {
                // 中间部分：保持最大宽度
                tilesInRow = minDimension;
            } else {
                // 后半部分：逐行减少
                tilesInRow = totalRows - row;
            }
            
            // 生成当前行的地块
            for (let col = 0; col < tilesInRow; col++) {
                this.createTile(row, col);
            }
        }
    }
    
    /**
     * 计算地块在菱形网格中的位置
     * @param row 行索引
     * @param col 列索引
     * @returns 世界坐标位置
     */
    calculateTilePosition(row: number, col: number): Vec3 {
        const totalRows = this.rows + this.columns - 1;
        const minDimension = Math.min(this.rows, this.columns);
        const maxDimension = Math.max(this.rows, this.columns);
        
        // 计算当前行的地块数量
        let tilesInRow: number;
        if (row < minDimension) {
            tilesInRow = row + 1;
        } else if (row < maxDimension) {
            tilesInRow = minDimension;
        } else {
            tilesInRow = totalRows - row;
        }
        
        // 计算水平偏移，使地块居中
        let startX = -(tilesInRow - 1) * this.tileSize * 0.5;
        
        // 计算中间部分的最大偏移量
        const maxMiddleOffset = (maxDimension - minDimension) * this.tileSize * 0.5;
        
        // 在中间部分添加额外的偏移
        if (row >= minDimension && row < maxDimension) {
            // 计算在中间部分的相对行数
            const middleRowIndex = row - minDimension + 1;
            
            // 根据rows和columns的大小关系决定偏移方向
            if (this.rows > this.columns) {
                // rows更大，向右偏移
                startX += middleRowIndex * this.tileSize * 0.5;
            } else if (this.columns > this.rows) {
                // columns更大，向左偏移
                startX -= middleRowIndex * this.tileSize * 0.5;
            }
            // 如果rows == columns，不需要偏移
        }
        // 在后半部分也添加偏移影响
        else if (row >= maxDimension) {
            // 后半部分需要保持与中间部分最后一行相同的偏移
            if (this.rows > this.columns) {
                // rows更大，保持最大右偏移
                startX += maxMiddleOffset;
            } else if (this.columns > this.rows) {
                // columns更大，保持最大左偏移
                startX -= maxMiddleOffset;
            }
        }
        
        const x = startX + col * this.tileSize;
        
        // 计算垂直位置（0.25才是中心）
        const startY = (totalRows - 1) * this.tileSize * 0.25;
        const y = startY - row * this.tileSize * 0.5; // 上下合缝
        
        return new Vec3(x, y, 0);
    }
    
    /**
     * 随机获取一个地块图片
     * @returns 随机选择的SpriteFrame，如果数组为空则返回null
     */
    getRandomTileSprite(): SpriteFrame | null {
        if (this.tileSprites.length === 0) {
            return null;
        }
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
     * @param size 地块尺寸（正方形边长）
     */
    setTileSize(size: number) {
        this.tileSize = Math.max(10, size);
        this.generateMap();
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
        if (row < 0 || col < 0 || row >= this.rows || col >= this.columns) {
            return null;
        }
        
        const index = row * this.columns + col;
        if (index >= 0 && index < this.allTiles.length) {
            return this.allTiles[index];
        }
        
        return null;
    }
    
    /**
     * 获取地图信息
     * @returns 地图信息对象
     */
    getMapInfo() {
        // 计算菱形布局的总地块数
        const totalRows = this.rows + this.columns - 1;
        const minDimension = Math.min(this.rows, this.columns);
        const maxDimension = Math.max(this.rows, this.columns);
        let totalTiles = 0;
        
        for (let row = 0; row < totalRows; row++) {
            if (row < minDimension) {
                totalTiles += row + 1;
            } else if (row < maxDimension) {
                totalTiles += minDimension;
            } else {
                totalTiles += totalRows - row;
            }
        }
        
        return {
            rows: this.rows,
            columns: this.columns,
            tileSize: this.tileSize,
            totalTiles: totalTiles,
            spriteCount: this.tileSprites.length,
            actualRows: totalRows,
            maxTilesPerRow: minDimension
        };
    }
    
    /**
     * 获取所有地块节点
     * @returns 所有地块节点数组
     */
    getAllTiles(): Node[] {
        return this.allTiles;
    }
    
    /**
     * 获取地图容器节点
     * @returns 地图容器节点
     */
    getMapContainer(): Node {
        return this.mapContainer;
    }
    
    /**
     * 根据世界坐标获取对应的地块
     * @param worldPos 世界坐标
     * @returns 地块节点或null
     */
    getTileAtWorldPosition(worldPos: Vec3): { tile: Node, row: number, col: number } | null {
        if (!this.mapContainer) {
            return null;
        }
        
        let closestTile = null;
        let closestDistance = Infinity;
        let closestRow = -1;
        let closestCol = -1;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                const tile = this.getTileAt(row, col);
                if (tile) {
                    const tileWorldPos = tile.getWorldPosition();
                    const distance = Vec3.distance(worldPos, tileWorldPos);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestTile = tile;
                        closestRow = row;
                        closestCol = col;
                    }
                }
            }
        }
        
        // 检查距离是否在合理范围内（地块大小的一半）
        const maxDistance = this.tileSize * 0.5;
        if (closestDistance <= maxDistance) {
            return { tile: closestTile, row: closestRow, col: closestCol };
        }
        
        return null;
     }
     
     /**
      * 设置地块框选功能
      */
     private setupTileSelection() {
         if (!this.tileSelectionManager) {
             console.warn('TileSelectionManager未设置，无法启用框选功能');
             return;
         }
         
         // 初始化框选管理器
         const mapConfig = {
             rows: this.rows,
             columns: this.columns,
             tileSize: this.tileSize
         };
         this.tileSelectionManager.initialize(this.getAllTiles(), mapConfig);
         
         console.log('地块框选功能已启用');
     }
     
     /**
      * 获取框选管理器
      */
     getTileSelectionManager(): TileSelectionManager {
         return this.tileSelectionManager;
     }
     
     /**
      * 启用/禁用框选功能
      */
     setTileSelectionEnabled(enabled: boolean) {
         this.enableTileSelection = enabled;
         
         if (this.tileSelectionManager) {
             if (enabled) {
                 this.setupTileSelection();
             } else {
                 this.tileSelectionManager.setEnabled(false);
             }
         } else if (enabled) {
             console.warn('TileSelectionManager未设置，无法启用框选功能');
         }
     }
}