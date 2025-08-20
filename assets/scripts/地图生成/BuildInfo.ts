import { _decorator, Component, Prefab, SpriteFrame, resources, Sprite, Node, Layers } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 建筑信息组件
 * 用于存储节点的建筑相关信息
 */
@ccclass('BuildInfo')
export class BuildInfo extends Component {
    @property({ type: Prefab, tooltip: '建筑预制体' })
    buildingPrefab: Prefab = null;
    
    @property({ tooltip: '建筑类型' })
    type: string = '';
    
    @property({ tooltip: '建筑名称' })
    buildingName: string = '';
    
    @property({ tooltip: '建筑描述' })
    description: string = '';
    
    @property({ tooltip: '是否启用此建筑' })
    buildingEnabled: boolean = true;
    
    @property({ tooltip: '建筑宽度（占用地块数）' })
    width: number = 1;
    
    @property({ tooltip: '建筑高度（占用地块数）' })
    height: number = 1;
    
    @property({ tooltip: '解锁所需人气值' })
    unlockPopularity: number = 0;
    
    @property({ tooltip: '建筑图片路径' })
    image: string = '';
    
    @property({ tooltip: '装饰价值' })
    decorationValue: number = 0;
    
    @property({ tooltip: '装饰影响范围' })
    decorationRange: number = 0;
    
    @property({ tooltip: '魅力值' })
    charmValue: number = 0;
    
    @property({ tooltip: '连锁建筑配置' })
    chainBuildings: Array<{building: string, bonus: number}> = [];
    
    @property({ type: Sprite, tooltip: '建筑图片Sprite组件' })
    buildingSprite: Sprite = null;
    
    // 建筑影响范围相关属性
    private influenceRange: Array<{row: number, col: number}> = [];
    
    // 建筑当前及上一次位置信息（锚点位置）
    private currentAnchorRow: number = -1;
    private currentAnchorCol: number = -1;
    private previousAnchorRow: number = -1;
    private previousAnchorCol: number = -1;
    private isPlaced: boolean = false;
    
    /**
     * 获取建筑预制体
     */
    public getBuildingPrefab(): Prefab {
        return this.buildingPrefab;
    }
    
    /**
     * 获取建筑类型
     */
    public getType(): string {
        return this.type;
    }
    
    /**
     * 获取建筑名称
     */
    public getBuildingName(): string {
        return this.buildingName;
    }
    
    /**
     * 获取建筑描述
     */
    public getDescription(): string {
        return this.description;
    }
    
    /**
     * 检查建筑是否启用
     */
    public isEnabled(): boolean {
        return this.buildingEnabled;
    }
    
    /**
     * 设置建筑预制体
     */
    public setBuildingPrefab(prefab: Prefab) {
        this.buildingPrefab = prefab;
    }
    
    /**
     * 设置建筑类型
     */
    public setType(type: string) {
        this.type = type;
    }
    
    /**
     * 设置建筑名称
     */
    public setBuildingName(name: string) {
        this.buildingName = name;
    }
    
    /**
     * 设置建筑描述
     */
    public setDescription(desc: string) {
        this.description = desc;
    }
    
    /**
     * 设置建筑启用状态
     */
    public setEnabled(enabled: boolean) {
        this.buildingEnabled = enabled;
    }
    
    /**
     * 获取解锁所需人气值
     */
    public getUnlockPopularity(): number {
        return this.unlockPopularity;
    }
    
    /**
     * 设置解锁所需人气值
     */
    public setUnlockPopularity(popularity: number) {
        this.unlockPopularity = popularity;
    }
    
    /**
     * 获取建筑图片路径
     */
    public getImage(): string {
        return this.image;
    }
    
    /**
     * 设置建筑图片路径
     */
    public setImage(imagePath: string) {
        this.image = imagePath;
    }
    
    /**
     * 获取装饰价值
     */
    public getDecorationValue(): number {
        return this.decorationValue;
    }
    
    /**
     * 设置装饰价值
     */
    public setDecorationValue(value: number) {
        this.decorationValue = value;
    }
    
    /**
     * 获取装饰影响范围
     */
    public getDecorationRange(): number {
        return this.decorationRange;
    }
    
    /**
     * 设置装饰影响范围
     */
    public setDecorationRange(range: number) {
        this.decorationRange = range;
    }
    
    /**
     * 获取魅力值
     */
    public getCharmValue(): number {
        return this.charmValue;
    }
    
    /**
     * 设置魅力值
     */
    public setCharmValue(value: number) {
        this.charmValue = value;
    }
    
    /**
     * 获取连锁建筑配置
     */
    public getChainBuildings(): Array<{building: string, bonus: number}> {
        return this.chainBuildings.slice(); // 返回副本
    }
    
    /**
     * 设置连锁建筑配置
     */
    public setChainBuildings(buildings: Array<{building: string, bonus: number}>) {
        this.chainBuildings = buildings.slice(); // 创建副本
    }
    
    /**
     * 获取建筑宽度
     */
    public getWidth(): number {
        return this.width;
    }
    
    /**
     * 获取建筑高度
     */
    public getHeight(): number {
        return this.height;
    }
    
    /**
     * 获取建筑尺寸
     */
    public getSize(): {width: number, height: number} {
        return {
            width: this.width,
            height: this.height
        };
    }
    
    /**
     * 设置建筑尺寸
     */
    public setBuildingSize(width: number, height: number) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
    }
    
    /**
     * 获取建筑占用的所有地块坐标（相对于锚点）
     * 锚点为左下角，返回所有占用地块的相对坐标
     */
    public getOccupiedTiles(): Array<{row: number, col: number}> {
        const tiles: Array<{row: number, col: number}> = [];
        
        // 返回相对于锚点的占用地块坐标（锚点为左下角，向左上方向扩展）
        for (let r = -this.height + 1; r <= 0; r++) {
            for (let c = -this.width + 1; c <= 0; c++) {
                tiles.push({ row: r, col: c });
            }
        }
        
        return tiles;
    }
    
    /**
     * 获取建筑影响范围（扩展两圈的网格范围）
     * 基于建筑占用区域向外扩展2格
     */
    public getInfluenceRange(): Array<{row: number, col: number}> {
        const range: Array<{row: number, col: number}> = [];
        
        // 计算影响范围边界（在占用区域基础上向外扩展2格）
        const minRow = -this.height + 1 - 2; // 向下扩展2格
        const maxRow = 0 + 2; // 向上扩展2格
        const minCol = -this.width + 1 - 2; // 向左扩展2格
        const maxCol = 0 + 2; // 向右扩展2格
        
        // 生成影响范围内的所有地块坐标
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                range.push({ row: r, col: c });
            }
        }
        
        return range;
    }
    
    /**
     * 获取建筑影响范围边界（空心矩形的四条边）
     * 返回构成空心矩形的地块坐标
     */
    public getInfluenceRangeBorder(): Array<{row: number, col: number}> {
        const border: Array<{row: number, col: number}> = [];
        
        // 计算影响范围边界
        const minRow = -this.height + 1 - 2;
        const maxRow = 0 + 2;
        const minCol = -this.width + 1 - 2;
        const maxCol = 0 + 2;
        
        // 添加上下边界
        for (let c = minCol; c <= maxCol; c++) {
            border.push({ row: minRow, col: c }); // 下边界
            border.push({ row: maxRow, col: c }); // 上边界
        }
        
        // 添加左右边界（排除角落重复点）
        for (let r = minRow + 1; r <= maxRow - 1; r++) {
            border.push({ row: r, col: minCol }); // 左边界
            border.push({ row: r, col: maxCol }); // 右边界
        }
        
        return border;
    }
    
    /**
     * 设置建筑影响范围
     * 通常在建筑放置完成后调用
     */
    public setInfluenceRange(range: Array<{row: number, col: number}>) {
        this.influenceRange = range.slice(); // 创建副本
    }
    
    /**
     * 获取存储的建筑影响范围
     */
    public getStoredInfluenceRange(): Array<{row: number, col: number}> {
        return this.influenceRange.slice(); // 返回副本
    }
    
    /**
     * 清除存储的影响范围
     */
    public clearInfluenceRange() {
        this.influenceRange = [];
    }
    
    /**
     * 设置建筑当前位置
     */
    public setCurrentPosition(anchorRow: number, anchorCol: number) {
        // 保存上一次位置
        this.previousAnchorRow = this.currentAnchorRow;
        this.previousAnchorCol = this.currentAnchorCol;
        
        // 设置新的当前位置
        this.currentAnchorRow = anchorRow;
        this.currentAnchorCol = anchorCol;
        
        // 当传入-1,-1时表示重置位置，设置isPlaced为false
        if (anchorRow === -1 && anchorCol === -1) {
            this.isPlaced = false;
        } else {
            this.isPlaced = true;
        }
    }
    
    /**
     * 获取建筑当前锚点位置
     */
    public getCurrentPosition(): {row: number, col: number} | null {
        if (!this.isPlaced) {
            return null;
        }
        return {
            row: this.currentAnchorRow,
            col: this.currentAnchorCol
        };
    }
    
    /**
     * 获取建筑上一次位置
     */
    public getPreviousPosition(): {row: number, col: number} | null {
        if (this.previousAnchorRow >= 0 && this.previousAnchorCol >= 0) {
            return {row: this.previousAnchorRow, col: this.previousAnchorCol};
        }
        return null;
    }
    
    /**
     * 检查建筑是否已放置
     */
    public getIsPlaced(): boolean {
        return this.isPlaced;
    }
 
    /**
     * 从另一个BuildInfo复制所有数据
     * @param other 源BuildInfo对象
     * @param copyLayer 是否复制层级信息，默认为false
     */
    public copyFrom(other: BuildInfo, copyLayer: boolean = false) {
        this.buildingPrefab = other.buildingPrefab;
        this.type = other.type;
        this.buildingName = other.buildingName;
        this.description = other.description;
        this.buildingEnabled = other.buildingEnabled;
        this.width = other.width;
        this.height = other.height;
        this.unlockPopularity = other.unlockPopularity;
        this.image = other.image;
        this.decorationValue = other.decorationValue;
        this.decorationRange = other.decorationRange;
        this.charmValue = other.charmValue;
        this.chainBuildings = other.chainBuildings.slice(); // 创建副本
        this.influenceRange = other.influenceRange.slice(); // 创建副本
        
        // 复制位置信息
        this.currentAnchorRow = other.currentAnchorRow;
        this.currentAnchorCol = other.currentAnchorCol;
        this.previousAnchorRow = other.previousAnchorRow;
        this.previousAnchorCol = other.previousAnchorCol;
        this.isPlaced = other.isPlaced;
        
        // 可选择性复制层级信息
        if (copyLayer && other.node && this.node) {
            this.node.layer = other.node.layer;
            console.log(`复制层级信息: ${other.node.layer} -> ${this.buildingName}`);
        }
    }
    
    /**
     * 加载并设置建筑图片
     * @param targetNode 目标节点（可选，主要用于兼容性）
     * @returns Promise<boolean> 是否加载成功
     */
    public async loadAndSetImage(targetNode?: Node): Promise<boolean> {
        if (!this.image) {
            return false;
        }
        
        if (!this.buildingSprite) {
            console.warn(`BuildInfo组件缺少buildingSprite引用: ${this.buildingName}`);
            return false;
        }
        
        return new Promise((resolve) => {
            // 从resources/建筑目录加载图片，需要指定到spriteFrame子资源
            const resourcePath = `建筑/${this.image}/spriteFrame`;
            
            resources.load(resourcePath, SpriteFrame, (err, spriteFrame) => {
                if (err) {
                    console.warn(`加载建筑图片失败: ${resourcePath}`, err);
                    resolve(false);
                    return;
                }
                
                // 直接使用装饰器引用的Sprite组件设置图片
                if (this.buildingSprite && spriteFrame) {
                    this.buildingSprite.spriteFrame = spriteFrame;
                    console.log(`设置建筑图片: ${this.image} -> ${this.buildingName}`);
                    resolve(true);
                } else {
                    console.warn(`buildingSprite为空或SpriteFrame为空: ${this.buildingName}`);
                    resolve(false);
                }
            });
        });
    }
    
    /**
     * 设置建筑选中状态的视觉反馈
     * @param selected 是否选中
     */
    public setSelected(selected: boolean) {
        if (!this.buildingSprite) {
            return;
        }
        
        // 通过改变透明度来显示选中状态
        const color = this.buildingSprite.color.clone();
        color.a = selected ? 200 : 255; // 选中时稍微透明
        this.buildingSprite.color = color;
        
        console.log(`建筑 ${this.buildingName} ${selected ? '选中' : '取消选中'}`);
    }
    
    /**
     * 设置节点层级
     * @param layer 目标层级
     */
    public setNodeLayer(layer: number) {
        if (this.node) {
            this.node.layer = layer;
            console.log(`建筑 ${this.buildingName} 层级设置为: ${layer}`);
        }
    }
    
    /**
     * 将建筑从UI_2D层级转换到DEFAULT层级
     * 用于从建造栏拖拽到地图时的层级转换
     */
    public convertToMapLayer() {
        this.setNodeLayer(Layers.Enum.DEFAULT);
        console.log(`建筑 ${this.buildingName} 已转换到地图层级 (DEFAULT)`);
    }
    
    /**
     * 将建筑设置为UI层级
     * 用于在建造栏中显示时的层级设置
     */
    public convertToUILayer() {
        this.setNodeLayer(Layers.Enum.UI_2D);
        console.log(`建筑 ${this.buildingName} 已转换到UI层级 (UI_2D)`);
    }
    
    /**
     * 获取当前节点层级
     * @returns 当前层级值
     */
    public getCurrentLayer(): number {
        return this.node ? this.node.layer : -1;
    }
    
    /**
     * 检查是否在地图层级
     * @returns 是否在DEFAULT层级
     */
    public isOnMapLayer(): boolean {
        return this.getCurrentLayer() === Layers.Enum.DEFAULT;
    }
    
    /**
     * 检查是否在UI层级
     * @returns 是否在UI_2D层级
     */
    public isOnUILayer(): boolean {
        return this.getCurrentLayer() === Layers.Enum.UI_2D;
    }
    
    /**
     * 处理建筑拖拽时的层级转换
     * 从建造栏(UI_2D)拖拽到地图(DEFAULT)时调用
     * @param targetLayer 目标层级，默认为DEFAULT
     */
    public handleDragToMap(targetLayer: number = Layers.Enum.DEFAULT) {
        const currentLayer = this.getCurrentLayer();
        if (currentLayer !== targetLayer) {
            this.setNodeLayer(targetLayer);
            console.log(`拖拽建筑层级转换: ${currentLayer} -> ${targetLayer} (${this.buildingName})`);
        }
    }
    
    /**
     * 处理建筑返回建造栏时的层级转换
     * 从地图(DEFAULT)返回到建造栏(UI_2D)时调用
     */
    public handleReturnToUI() {
        const currentLayer = this.getCurrentLayer();
        if (currentLayer !== Layers.Enum.UI_2D) {
            this.setNodeLayer(Layers.Enum.UI_2D);
            console.log(`建筑返回UI层级转换: ${currentLayer} -> ${Layers.Enum.UI_2D} (${this.buildingName})`);
        }
    }
 
}