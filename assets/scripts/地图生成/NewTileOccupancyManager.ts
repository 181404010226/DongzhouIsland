import { _decorator, Component, Node, TiledMap, TiledLayer, Vec2, Vec3, Camera, Color, UITransform, Sprite, SpriteFrame, Texture2D, ImageAsset, CCString, instantiate, sys, TiledTile } from 'cc';
import { BuildInfo } from '../地图生成/BuildInfo';
import { ImprovedMapGenerator } from './ImprovedMapGenerator';

const { ccclass, property } = _decorator;

/**
 * 瓦片状态枚举
 */
export enum TileState {
    NORMAL = 0,      // 正常状态
    HIGHLIGHTED = 1, // 高亮状态（可放置）
    OCCUPIED = 2,    // 被占用状态
    INVALID = 3      // 无效状态（不可放置）
}

/**
 * 瓦片格子信息接口
 */
export interface TileGridInfo {
    row: number;
    col: number;
    node: Node;
    tiledTile: TiledTile;
    state: TileState;
    worldPosition: Vec3;
}

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
 * 增强版地块占用管理器
 * 支持瓦片格子生成、高亮显示和建筑吸附功能
 */
@ccclass('NewTileOccupancyManager')
export class NewTileOccupancyManager extends Component {
    // 使用 TMX 的 TiledMap 来生成瓦片
    @property({ type: TiledMap, tooltip: '场景中的 TiledMap 组件（绑定包含 luohansi.tmx 的节点）' })
    tiledMap: TiledMap = null;
    
    @property({ type: TiledLayer, tooltip: '直接拖拽图块层节点到此' })
    tileLayer: TiledLayer = null;

    @property({ type: ImprovedMapGenerator, tooltip: '地图生成器' })
    mapGenerator: ImprovedMapGenerator = null;

    // 格子显示配置
    @property({ tooltip: '是否显示格子网格' })
    showGrid: boolean = true;

    @property({ tooltip: '格子透明度 (0-255)' })
    gridOpacity: number = 100;

    @property({ tooltip: '边框颜色' })
    gridColor: Color = new Color(255, 255, 255, 200);

    @property({ tooltip: '高亮颜色' })
    highlightColor: Color = new Color(0, 255, 0, 150);

    @property({ tooltip: '占用颜色' })
    occupiedColor: Color = new Color(255, 0, 0, 150);

    @property({ tooltip: '无效颜色' })
    invalidColor: Color = new Color(128, 128, 128, 150);

    // 内部缓存：瓦片格子信息
    private tileGrid: TileGridInfo[][] = [];
    private allTiles: Node[] = [];
    public rows: number = 0;
    public columns: number = 0;
    
    // 高亮相关
    private highlightedTiles: Set<string> = new Set(); // 存储高亮瓦片的key (row_col)
    private currentPreviewArea: { row: number, col: number, width: number, height: number } | null = null;
    
    // 格子材质缓存和可视化节点
    private gridSpriteFrame: SpriteFrame = null;
    private highlightNodes: Node[] = []; // 高亮显示节点
    private previewNodes: Node[] = []; // 预览显示节点
    
    
    
    // 编辑器只读字段：已放置建筑节点索引
    @property({ type: [Node], readonly: true, tooltip: '当前已放置的建筑节点列表（编辑器查看）' })
    private readonly placedBuildingNodes: Node[] = [];

    // 编辑器只读字段：地块占用情况网格
    @property({ type: [CCString], readonly: true, tooltip: '地块占用情况网格（编辑器查看）' })
    private readonly tileOccupancyGrid: string[] = [];
    
    // 注意：建筑相邻关系信息现在显示在每个建筑自己的Inspector面板中
    

    // 地块占用映射表，使用"row_col"作为key
    private tileOccupancyMap: Map<string, TileOccupancyInfo> = new Map();

    // 加载状态跟踪
    private isInitializing: boolean = false;
    private initRetryCount: number = 0;
    private readonly MAX_RETRY_COUNT: number = 10;
    private readonly INITIAL_DELAY: number = 0.2;
    private readonly RETRY_DELAY: number = 0.5;

    /**
     * 生命周期：在 start 阶段根据 TiledMap 初始化瓦片列表
     */
    start() {
        console.log('[NewTileOccupancyManager] 开始初始化');
        this.scheduleInitialization();
    }

    /**
     * 延迟初始化，确保TiledMap完全加载
     */
    private scheduleInitialization(): void {
        if (this.isInitializing) {
            return;
        }
        
        this.scheduleOnce(() => {
            this.tryInitTilesFromTiledMap();
        }, this.INITIAL_DELAY);
    }

    /**
     * 尝试初始化瓦片，支持重试机制
     */
    private tryInitTilesFromTiledMap(): void {
        if (this.isInitializing) {
            return;
        }
        
        this.isInitializing = true;
        
        const success = this.initTilesFromTiledMap();
        
        if (success) {
            console.log('[NewTileOccupancyManager] 瓦片初始化成功');
            this.isInitializing = false;
            this.initRetryCount = 0;
        } else {
            this.initRetryCount++;
            if (this.initRetryCount < this.MAX_RETRY_COUNT) {
                console.warn(`[NewTileOccupancyManager] 瓦片初始化失败，${this.RETRY_DELAY}秒后重试 (${this.initRetryCount}/${this.MAX_RETRY_COUNT})`);
                this.scheduleOnce(() => {
                    this.isInitializing = false;
                    this.tryInitTilesFromTiledMap();
                }, this.RETRY_DELAY);
            } else {
                console.error('[NewTileOccupancyManager] 瓦片初始化失败，已达到最大重试次数');
                this.isInitializing = false;
            }
        }
    }

    /**
     * 尝试在屏幕位置放置建筑（使用吸附功能）
     */
    public tryPlaceBuildingAtScreenPos(screenPos: Vec2, camera: Camera, buildInfo: BuildInfo, existingNode?: Node): boolean {
        // 详细的组件检查和错误日志
        if (!camera) {
            console.warn('[NewTileOccupancyManager] 缺少Camera组件，无法放置建筑');
            return false;
        }
        
        if (!this.tiledMap) {
            console.warn('[NewTileOccupancyManager] 缺少TiledMap组件，无法放置建筑');
            // 尝试重新查找TiledMap组件
            this.tiledMap = this.node.getComponentInChildren(TiledMap);
            if (!this.tiledMap) {
                console.error('[NewTileOccupancyManager] 无法找到TiledMap组件，请检查场景配置');
                return false;
            }
            console.log('[NewTileOccupancyManager] 成功重新找到TiledMap组件');
        }
        
        // 检查瓦片网格是否已初始化
        if (this.tileGrid.length === 0 || this.allTiles.length === 0) {
            console.warn('[NewTileOccupancyManager] 瓦片网格未初始化，尝试重新初始化');
            const initSuccess = this.initTilesFromTiledMap();
            if (!initSuccess) {
                console.error('[NewTileOccupancyManager] 瓦片网格初始化失败，无法放置建筑');
                return false;
            }
            console.log('[NewTileOccupancyManager] 瓦片网格重新初始化成功');
        }
        
        // 获取吸附位置
        const snapInfo = this.getSnapPosition(screenPos, camera);
        if (!snapInfo) {
            console.warn('[NewTileOccupancyManager] 无法获取有效的吸附位置');
            return false;
        }
        
        console.log(`[NewTileOccupancyManager] 吸附到地块 (${snapInfo.row}, ${snapInfo.col})`);
        
        // 放置建筑（使用现有节点或创建新节点）
        if (existingNode) {
            return this.placeBuildingAtPosition(snapInfo.row, snapInfo.col, buildInfo, existingNode);
        } else {
            // 需要创建新节点
            if (!buildInfo.getBuildingPrefab()) {
                console.warn('[NewTileOccupancyManager] 建筑预制体不存在，无法放置建筑');
                return false;
            }
            
            const buildingInstance = instantiate(buildInfo.getBuildingPrefab());
            return this.placeBuildingAtPosition(snapInfo.row, snapInfo.col, buildInfo, buildingInstance);
        }
    }

    /**
     * 获取瓦片尺寸
     * @returns 瓦片尺寸对象，包含width和height属性
     */
    public getTileSize(): { width: number, height: number } | null {
        if (!this.tiledMap) {
            console.warn('[NewTileOccupancyManager] TiledMap未设置，无法获取瓦片尺寸');
            return null;
        }
        
        const tileSize = this.tiledMap.getTileSize();
        if (!tileSize || tileSize.width <= 0 || tileSize.height <= 0) {
            console.warn('[NewTileOccupancyManager] 瓦片尺寸无效');
            return null;
        }
        
        return {
            width: tileSize.width,
            height: tileSize.height
        };
    }

    /**
     * 从TiledMap初始化瓦片网格
     */
    private initTilesFromTiledMap(): boolean {
        try {
            // 如果没有设置tiledMap，尝试从子节点中获取
            if (!this.tiledMap) {
                this.tiledMap = this.node.getComponentInChildren(TiledMap);
                if (!this.tiledMap) {
                    console.warn('[NewTileOccupancyManager] 未找到TiledMap组件');
                    return false;
                }
            }

            // 检查TiledMap是否已经准备好
            if (!this.tiledMap.node || !this.tiledMap.node.active) {
                console.warn('[NewTileOccupancyManager] TiledMap节点未激活');
                return false;
            }

            // 如果没有手动绑定tileLayer，尝试自动绑定
            if (!this.tileLayer) {
                const layers = this.tiledMap.getLayers();
                if (layers && layers.length > 0) {
                    this.tileLayer = layers[0]; // 使用第一个图层
                    console.log('[NewTileOccupancyManager] 自动绑定到第一个图层');
                }
            }

            if (!this.tileLayer) {
                console.warn('[NewTileOccupancyManager] 未找到可用的TiledLayer');
                return false;
            }

            // 获取地图尺寸
            const mapSize = this.tiledMap.getMapSize();
            const tileSize = this.tiledMap.getTileSize();
            
            if (!mapSize || !tileSize || mapSize.width <= 0 || mapSize.height <= 0) {
                console.warn('[NewTileOccupancyManager] 地图尺寸无效');
                return false;
            }

            this.rows = mapSize.height;
            this.columns = mapSize.width;

            console.log(`[NewTileOccupancyManager] 地图尺寸: ${this.columns}x${this.rows}, 瓦片尺寸: ${tileSize.width}x${tileSize.height}`);

            // 初始化瓦片网格
            this.tileGrid = [];
            this.allTiles = [];

            for (let row = 0; row < this.rows; row++) {
                this.tileGrid[row] = [];
                for (let col = 0; col < this.columns; col++) {
                    // 获取瓦片信息
                    const tiledTile = this.tileLayer.getTiledTileAt(col, row);
                    
                    // 计算世界坐标
                    const worldPos = new Vec3();
                    this.tiledMap.node.getComponent(UITransform).convertToWorldSpaceAR(
                        new Vec3(col * tileSize.width + tileSize.width / 2, 
                                (this.rows - row - 1) * tileSize.height + tileSize.height / 2, 0),
                        worldPos
                    );

                    // 创建瓦片信息
                    const tileInfo: TileGridInfo = {
                        row: row,
                        col: col,
                        node: null, // 暂时不创建可视化节点
                        tiledTile: tiledTile,
                        state: TileState.NORMAL,
                        worldPosition: worldPos
                    };

                    this.tileGrid[row][col] = tileInfo;
                }
            }

            console.log(`[NewTileOccupancyManager] 成功初始化 ${this.rows}x${this.columns} 瓦片网格`);
            return true;

        } catch (error) {
            console.error('[NewTileOccupancyManager] 初始化瓦片网格时发生错误:', error);
            return false;
        }
    }

    /**
     * 获取屏幕位置对应的吸附位置
     */
    public getSnapPosition(screenPos: Vec2, camera: Camera): { row: number, col: number, worldPosition: Vec3 } | null {
        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        if (!tileInfo) {
            return null;
        }

        return {
            row: tileInfo.row,
            col: tileInfo.col,
            worldPosition: tileInfo.worldPosition
        };
    }

    /**
     * 获取屏幕位置对应的瓦片信息
     */
    public getTileAtScreenPos(screenPos: Vec2, camera: Camera): { row: number, col: number, worldPosition: Vec3 } | null {
        if (!camera || !this.tiledMap) {
            return null;
        }

        try {
            // 将屏幕坐标转换为世界坐标
            const worldPos = new Vec3();
            camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0), worldPos);

            // 将世界坐标转换为TiledMap的本地坐标
            const localPos = new Vec3();
            this.tiledMap.node.getComponent(UITransform).convertToNodeSpaceAR(worldPos, localPos);

            // 获取瓦片尺寸
            const tileSize = this.tiledMap.getTileSize();
            if (!tileSize || tileSize.width <= 0 || tileSize.height <= 0) {
                return null;
            }

            // 计算瓦片坐标
            const col = Math.floor(localPos.x / tileSize.width);
            const row = this.rows - 1 - Math.floor(localPos.y / tileSize.height);

            // 检查坐标是否在有效范围内
            if (row < 0 || row >= this.rows || col < 0 || col >= this.columns) {
                return null;
            }

            // 获取瓦片的世界坐标
            const tileWorldPos = new Vec3();
            this.tiledMap.node.getComponent(UITransform).convertToWorldSpaceAR(
                new Vec3(col * tileSize.width + tileSize.width / 2, 
                        (this.rows - row - 1) * tileSize.height + tileSize.height / 2, 0),
                tileWorldPos
            );

            if (sys.isNative) {
                console.log(`[NewTileOccupancyManager] 屏幕坐标 (${screenPos.x}, ${screenPos.y}) -> 瓦片 (${row}, ${col})`);
            }

            return {
                row: row,
                col: col,
                worldPosition: tileWorldPos
            };

        } catch (error) {
            console.error('[NewTileOccupancyManager] 获取瓦片位置时发生错误:', error);
            return null;
        }
    }

    /**
     * 在指定位置放置建筑
     */
    public placeBuildingAtPosition(row: number, col: number, buildInfo: BuildInfo, buildingNode: Node): boolean {
        if (!buildingNode || !buildInfo) {
            console.warn('[NewTileOccupancyManager] 建筑节点或建筑信息无效');
            return false;
        }

        // 检查位置是否有效
        if (row < 0 || row >= this.rows || col < 0 || col >= this.columns) {
            console.warn(`[NewTileOccupancyManager] 位置超出范围: (${row}, ${col})`);
            return false;
        }

        // 检查区域是否可用
        const buildingSize = buildInfo.getSize();
        if (!this.canPlaceBuildingAt(row, col, buildingSize.width, buildingSize.height)) {
            console.warn(`[NewTileOccupancyManager] 位置 (${row}, ${col}) 不可放置建筑`);
            return false;
        }

        try {
            // 获取瓦片的世界坐标
            const tileInfo = this.tileGrid[row][col];
            if (!tileInfo) {
                console.warn(`[NewTileOccupancyManager] 无法获取瓦片信息: (${row}, ${col})`);
                return false;
            }

            // 设置建筑位置
            buildingNode.setWorldPosition(tileInfo.worldPosition);

            // 标记占用区域
            this.markTilesAsOccupied(row, col, buildingSize.width, buildingSize.height, buildInfo, buildingNode);

            // 添加到已放置建筑列表
            this.placedBuildingNodes.push(buildingNode);

            console.log(`[NewTileOccupancyManager] 成功放置建筑 ${buildInfo.getBuildingName()} 在位置 (${row}, ${col})`);
            return true;

        } catch (error) {
            console.error('[NewTileOccupancyManager] 放置建筑时发生错误:', error);
            return false;
        }
    }

    /**
     * 检查指定区域是否可以放置建筑
     */
    public canPlaceBuildingAt(row: number, col: number, width: number, height: number): boolean {
        // 检查边界
        if (row < 0 || col < 0 || row + height > this.rows || col + width > this.columns) {
            return false;
        }

        // 检查区域内的每个瓦片
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                const key = `${r}_${c}`;
                if (this.tileOccupancyMap.has(key)) {
                    return false; // 已被占用
                }
            }
        }

        return true;
    }

    /**
     * 标记瓦片为已占用
     */
    private markTilesAsOccupied(row: number, col: number, width: number, height: number, buildInfo: BuildInfo, buildingNode: Node): void {
        const occupancyInfo: TileOccupancyInfo = {
            buildingId: buildingNode.uuid,
            buildingType: buildInfo.getBuildingName(),
            anchorRow: row,
            anchorCol: col,
            width: width,
            height: height,
            buildingNode: buildingNode
        };

        // 标记所有占用的瓦片
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                const key = `${r}_${c}`;
                this.tileOccupancyMap.set(key, occupancyInfo);
                
                // 更新瓦片状态
                if (this.tileGrid[r] && this.tileGrid[r][c]) {
                    this.tileGrid[r][c].state = TileState.OCCUPIED;
                }
            }
        }

        // 更新编辑器显示
        this.updateEditorDisplay();
    }

    /**
     * 更新编辑器显示信息
     */
    private updateEditorDisplay(): void {
        // 更新占用网格显示
        this.tileOccupancyGrid.length = 0;
        for (let row = 0; row < this.rows; row++) {
            let rowStr = '';
            for (let col = 0; col < this.columns; col++) {
                const key = `${row}_${col}`;
                if (this.tileOccupancyMap.has(key)) {
                    const info = this.tileOccupancyMap.get(key);
                    rowStr += info.buildingType.charAt(0); // 使用建筑类型首字母
                } else {
                    rowStr += '.'; // 空地
                }
            }
            this.tileOccupancyGrid.push(rowStr);
        }
    }

    /**
     * 清除建筑预览高亮
     */
    public clearPreview(): void {
        this.highlightedTiles.clear();
        this.currentPreviewArea = null;
        
        // 清除预览节点
        this.previewNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this.previewNodes = [];
        
        // 重置瓦片状态
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                if (this.tileGrid[row] && this.tileGrid[row][col]) {
                    const key = `${row}_${col}`;
                    if (this.tileOccupancyMap.has(key)) {
                        this.tileGrid[row][col].state = TileState.OCCUPIED;
                    } else {
                        this.tileGrid[row][col].state = TileState.NORMAL;
                    }
                }
            }
        }
    }

    /**
     * 显示建筑预览高亮
     */
    public showBuildingPreview(row: number, col: number, width: number, height: number): void {
        this.clearPreview();
        
        this.currentPreviewArea = { row, col, width, height };
        
        // 高亮预览区域
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                if (r >= 0 && r < this.rows && c >= 0 && c < this.columns) {
                    const key = `${r}_${c}`;
                    this.highlightedTiles.add(key);
                    
                    // 更新瓦片状态并创建可视化节点
                    if (this.tileGrid[r] && this.tileGrid[r][c]) {
                        const canPlace = this.canPlaceBuildingAt(r, c, 1, 1);
                        this.tileGrid[r][c].state = canPlace ? TileState.HIGHLIGHTED : TileState.INVALID;
                        
                        // 创建预览高亮节点
                        this.createPreviewNode(r, c, canPlace);
                    }
                }
            }
        }
    }

    /**
     * 创建预览高亮节点
     */
    private createPreviewNode(row: number, col: number, canPlace: boolean): void {
        if (!this.tileGrid[row] || !this.tileGrid[row][col]) {
            return;
        }

        const tileInfo = this.tileGrid[row][col];
        const previewNode = new Node(`Preview_${row}_${col}`);
        
        // 添加到TiledMap节点下
        this.tiledMap.node.addChild(previewNode);
        
        // 设置位置
        const tileSize = this.tiledMap.getTileSize();
        const localPos = new Vec3(
            col * tileSize.width + tileSize.width / 2,
            (this.rows - row - 1) * tileSize.height + tileSize.height / 2,
            1 // 稍微提高z轴，确保在地图上方显示
        );
        previewNode.setPosition(localPos);
        
        // 添加UITransform组件
        const uiTransform = previewNode.addComponent(UITransform);
        uiTransform.setContentSize(tileSize.width, tileSize.height);
        
        // 添加Sprite组件用于显示颜色
        const sprite = previewNode.addComponent(Sprite);
        
        // 创建纯色纹理
        const color = canPlace ? this.highlightColor : this.invalidColor;
        this.createColorTexture(color).then(spriteFrame => {
            if (sprite && sprite.isValid) {
                sprite.spriteFrame = spriteFrame;
            }
        });
        
        // 添加到预览节点列表
        this.previewNodes.push(previewNode);
    }

    /**
     * 创建纯色纹理
     */
    private async createColorTexture(color: Color): Promise<SpriteFrame> {
        return new Promise((resolve) => {
            // 创建1x1像素的ImageAsset
            const imageAsset = new ImageAsset();
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
                ctx.fillRect(0, 0, 1, 1);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const arrayBuffer = reader.result as ArrayBuffer;
                            const uint8Array = new Uint8Array(arrayBuffer);
                            
                            imageAsset.reset({
                                width: 1,
                                height: 1,
                                format: Texture2D.PixelFormat.RGBA8888,
                                _data: uint8Array,
                                _compressed: false
                            });
                            
                            const texture = new Texture2D();
                            texture.image = imageAsset;
                            
                            const spriteFrame = new SpriteFrame();
                            spriteFrame.texture = texture;
                            
                            resolve(spriteFrame);
                        };
                        reader.readAsArrayBuffer(blob);
                    }
                });
            }
        });
    }

    /**
     * 更新建筑预览位置
     */
    public updateBuildingPreview(screenPos: Vec2, camera: Camera, buildingWidth: number, buildingHeight: number): void {
        if (!camera || !this.tiledMap) {
            return;
        }

        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        if (!tileInfo) {
            this.clearPreview();
            return;
        }

        // 计算建筑的锚点位置（左下角）
        const anchorRow = tileInfo.row;
        const anchorCol = tileInfo.col;

        // 检查是否需要更新预览
        if (this.currentPreviewArea && 
            this.currentPreviewArea.row === anchorRow && 
            this.currentPreviewArea.col === anchorCol &&
            this.currentPreviewArea.width === buildingWidth &&
            this.currentPreviewArea.height === buildingHeight) {
            return; // 位置没有变化，不需要更新
        }

        // 显示新的预览
        this.showBuildingPreview(anchorRow, anchorCol, buildingWidth, buildingHeight);
    }

    /**
     * 处理建筑拖拽开始
     */
    public onBuildingDragStart(buildingNode: Node, screenPos: Vec2, camera: Camera): void {
        if (!buildingNode || !camera) {
            console.warn("NewTileOccupancyManager: Invalid parameters for drag start");
            return;
        }

        // 获取建筑的尺寸信息
        const buildInfo = buildingNode.getComponent(BuildInfo);
        let buildingWidth = 1;
        let buildingHeight = 1;
        
        if (buildInfo) {
            buildingWidth = buildInfo.getWidth() || 1;
            buildingHeight = buildInfo.getHeight() || 1;
        }

        // 开始显示预览
        this.updateBuildingPreview(screenPos, camera, buildingWidth, buildingHeight);
        
        console.log(`NewTileOccupancyManager: Started dragging building ${buildingNode.name} (${buildingWidth}x${buildingHeight})`);
    }

    /**
     * 处理建筑拖拽过程中的移动
     */
    public onBuildingDragMove(buildingNode: Node, screenPos: Vec2, camera: Camera): void {
        if (!buildingNode || !camera) {
            return;
        }

        // 获取建筑的尺寸信息
        const buildInfo = buildingNode.getComponent(BuildInfo);
        let buildingWidth = 1;
        let buildingHeight = 1;
        
        if (buildInfo) {
            buildingWidth = buildInfo.getWidth() || 1;
            buildingHeight = buildInfo.getHeight() || 1;
        }

        // 更新预览位置
        this.updateBuildingPreview(screenPos, camera, buildingWidth, buildingHeight);
    }

    /**
     * 处理建筑拖拽结束
     */
    public onBuildingDragEnd(buildingNode: Node, screenPos: Vec2, camera: Camera): boolean {
        if (!buildingNode || !camera) {
            console.warn("NewTileOccupancyManager: Invalid parameters for drag end");
            this.clearPreview();
            return false;
        }

        // 从建筑节点获取BuildInfo组件
        const buildInfo = buildingNode.getComponent(BuildInfo);
        if (!buildInfo) {
            console.warn("NewTileOccupancyManager: BuildInfo component not found on building node");
            this.clearPreview();
            return false;
        }

        // 尝试放置建筑
        const success = this.tryPlaceBuildingAtScreenPos(screenPos, camera, buildInfo, buildingNode);
        
        // 清除预览
        this.clearPreview();
        
        if (success) {
            console.log(`NewTileOccupancyManager: Successfully placed building ${buildingNode.name}`);
        } else {
            console.log(`NewTileOccupancyManager: Failed to place building ${buildingNode.name}`);
        }
        
        return success;
    }

    /**
     * 处理地图拖拽开始
     */
    public onMapDragStart(screenPos: Vec2): void {
        // 清除任何建筑预览
        this.clearPreview();
        
        // 这里可以添加地图拖拽开始的逻辑
        console.log("NewTileOccupancyManager: Map drag started");
    }

    /**
     * 处理地图拖拽移动
     */
    public onMapDragMove(deltaPos: Vec2): void {
        // 这里可以添加地图拖拽移动的逻辑
        // 通常由相机控制器处理，这里主要用于清理预览状态
        this.clearPreview();
    }

    /**
     * 处理地图拖拽结束
     */
    public onMapDragEnd(): void {
        // 这里可以添加地图拖拽结束的逻辑
        console.log("NewTileOccupancyManager: Map drag ended");
    }

    /**
     * 检查指定位置是否可以进行交互
     */
    public canInteractAt(screenPos: Vec2, camera: Camera): boolean {
        if (!camera || !this.tiledMap) {
            return false;
        }

        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        return tileInfo !== null;
    }

    /**
     * 获取指定屏幕位置的瓦片信息（用于调试和UI显示）
     */
    public getTileInfoAtScreenPos(screenPos: Vec2, camera: Camera): { row: number, col: number, state: TileState, occupied: boolean } | null {
        const tileInfo = this.getTileAtScreenPos(screenPos, camera);
        if (!tileInfo) {
            return null;
        }

        const key = `${tileInfo.row}_${tileInfo.col}`;
        const occupied = this.tileOccupancyMap.has(key);
        const state = this.tileGrid[tileInfo.row] && this.tileGrid[tileInfo.row][tileInfo.col] 
            ? this.tileGrid[tileInfo.row][tileInfo.col].state 
            : TileState.NORMAL;

        return {
            row: tileInfo.row,
            col: tileInfo.col,
            state: state,
            occupied: occupied
        };
    }

    /**
     * 强制刷新瓦片网格显示
     */
    public refreshTileGrid(): void {
        if (!this.tileGrid || this.tileGrid.length === 0) {
            console.warn("NewTileOccupancyManager: Tile grid not initialized, cannot refresh");
            return;
        }

        // 重新计算所有瓦片的状态
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                if (this.tileGrid[row] && this.tileGrid[row][col]) {
                    const key = `${row}_${col}`;
                    if (this.tileOccupancyMap.has(key)) {
                        this.tileGrid[row][col].state = TileState.OCCUPIED;
                    } else {
                        this.tileGrid[row][col].state = TileState.NORMAL;
                    }
                }
            }
        }

        }

    /**
     * 获取所有已放置的建筑节点
     */
    public getPlacedBuildings(): Node[] {
        return [...this.placedBuildingNodes];
    }

    /**
     * 移除建筑
     */
    public removeBuilding(buildingNode: Node): boolean {
        const buildingId = buildingNode.uuid;
        
        // 查找并移除占用信息
        const keysToRemove: string[] = [];
        for (const [key, info] of this.tileOccupancyMap.entries()) {
            if (info.buildingId === buildingId) {
                keysToRemove.push(key);
            }
        }
        
        // 移除占用标记
        for (const key of keysToRemove) {
            this.tileOccupancyMap.delete(key);
            const [row, col] = key.split('_').map(Number);
            if (this.tileGrid[row] && this.tileGrid[row][col]) {
                this.tileGrid[row][col].state = TileState.NORMAL;
            }
        }
        
        // 从已放置建筑列表中移除
        const index = this.placedBuildingNodes.indexOf(buildingNode);
        if (index >= 0) {
            this.placedBuildingNodes.splice(index, 1);
        }
        
        // 更新编辑器显示
        this.updateEditorDisplay();
        
        return keysToRemove.length > 0;
    }
}