import { _decorator, Component, Prefab, SpriteFrame, CCString } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 建筑信息组件
 * 用于存储节点的建筑相关信息
 */
@ccclass('BuildInfo')
export class BuildInfo extends Component {
    @property({ type: SpriteFrame, tooltip: '建筑预览图片' })
    previewImage: SpriteFrame = null;
    
    @property({ type: Prefab, tooltip: '建筑预制体' })
    buildingPrefab: Prefab = null;
    
    @property({ tooltip: '建筑类型名称' })
    buildingType: string = '';
    
    @property({ tooltip: '建筑描述' })
    description: string = '';
    
    @property({ tooltip: '是否启用此建筑' })
    buildingEnabled: boolean = true;
    
    @property({ tooltip: '建筑宽度（占用地块数）' })
    buildingWidth: number = 1;
    
    @property({ tooltip: '建筑高度（占用地块数）' })
    buildingHeight: number = 1;
    
    // 检测范围现在基于建筑尺寸自动计算：大型建筑(>4格)=3圈，中型建筑(2-4格)=2圈，小型建筑(1格)=1圈
    
    // 建筑影响范围相关属性
    private influenceRange: Array<{row: number, col: number}> = [];
    
    // 建筑当前及上一次位置信息（锚点位置）
    private currentAnchorRow: number = -1;
    private currentAnchorCol: number = -1;
    private previousAnchorRow: number = -1;
    private previousAnchorCol: number = -1;
    private isPlaced: boolean = false;
    
    // 相邻关系信息现在由BuildingAdjacencyDisplay组件负责显示，BuildInfo只保留静态数据
    
    /**
     * 获取建筑预览图片
     */
    public getPreviewImage(): SpriteFrame {
        return this.previewImage;
    }
    
    /**
     * 获取建筑预制体
     */
    public getBuildingPrefab(): Prefab {
        return this.buildingPrefab;
    }
    
    /**
     * 获取建筑类型
     */
    public getBuildingType(): string {
        return this.buildingType;
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
     * 设置建筑预览图片
     */
    public setPreviewImage(spriteFrame: SpriteFrame) {
        this.previewImage = spriteFrame;
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
    public setBuildingType(type: string) {
        this.buildingType = type;
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
     * 获取建筑宽度
     */
    public getBuildingWidth(): number {
        return this.buildingWidth;
    }
    
    /**
     * 获取建筑高度
     */
    public getBuildingHeight(): number {
        return this.buildingHeight;
    }
    
    /**
     * 获取建筑尺寸
     */
    public getSize(): {width: number, height: number} {
        return {
            width: this.buildingWidth,
            height: this.buildingHeight
        };
    }
    
    /**
     * 设置建筑尺寸
     */
    public setBuildingSize(width: number, height: number) {
        this.buildingWidth = Math.max(1, width);
        this.buildingHeight = Math.max(1, height);
    }
    
    /**
     * 获取建筑检测圈层数（基于建筑尺寸自动计算）
     * 大型建筑（占用面积>4格）：3圈
     * 中型建筑（占用面积2-4格）：2圈
     * 小型建筑（占用面积1格）：1圈
     */
    public getDetectionRadius(): number {
        return BuildInfo.calculateDetectionRadius(this.buildingWidth, this.buildingHeight);
    }
    
    /**
     * 静态方法：根据建筑尺寸计算检测范围
     * @param width 建筑宽度
     * @param height 建筑高度
     * @returns 检测圈层数
     */
    public static calculateDetectionRadius(width: number, height: number): number {
        const area = width * height;
        if (area > 4) {
            return 3; // 大型建筑
        } else if (area >= 2) {
            return 2; // 中型建筑
        } else {
            return 1; // 小型建筑
        }
    }
    
    /**
     * 获取建筑占用的所有地块坐标（相对于锚点）
     * 锚点为左下角，返回所有占用地块的相对坐标
     */
    public getOccupiedTiles(): Array<{row: number, col: number}> {
        const tiles: Array<{row: number, col: number}> = [];
        
        // 返回相对于锚点的占用地块坐标（锚点为左下角，向左上方向扩展）
        for (let r = -this.buildingHeight + 1; r <= 0; r++) {
            for (let c = -this.buildingWidth + 1; c <= 0; c++) {
                tiles.push({ row: r, col: c });
            }
        }
        
        return tiles;
    }
    
    /**
     * 获取建筑影响范围（基于配置的检测圈层数扩展）
     * 基于建筑占用区域向外扩展指定圈数
     */
    public getInfluenceRange(): Array<{row: number, col: number}> {
        const range: Array<{row: number, col: number}> = [];
        
        // 计算影响范围边界（在占用区域基础上向外扩展指定圈数）
        const radius = BuildInfo.calculateDetectionRadius(this.buildingWidth, this.buildingHeight);
        const minRow = -this.buildingHeight + 1 - radius; // 向下扩展
        const maxRow = 0 + radius; // 向上扩展
        const minCol = -this.buildingWidth + 1 - radius; // 向左扩展
        const maxCol = 0 + radius; // 向右扩展
        
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
        const radius = BuildInfo.calculateDetectionRadius(this.buildingWidth, this.buildingHeight);
        const minRow = -this.buildingHeight + 1 - radius;
        const maxRow = 0 + radius;
        const minCol = -this.buildingWidth + 1 - radius;
        const maxCol = 0 + radius;
        
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
     */
    public copyFrom(other: BuildInfo) {
        this.previewImage = other.previewImage;
        this.buildingPrefab = other.buildingPrefab;
        this.buildingType = other.buildingType;
        this.description = other.description;
        this.buildingEnabled = other.buildingEnabled;
        this.buildingWidth = other.buildingWidth;
        this.buildingHeight = other.buildingHeight;
        // 检测圈层数现在基于建筑尺寸自动计算，无需复制
        this.influenceRange = other.influenceRange.slice(); // 创建副本
        
        // 复制位置信息
        this.currentAnchorRow = other.currentAnchorRow;
        this.currentAnchorCol = other.currentAnchorCol;
        this.previousAnchorRow = other.previousAnchorRow;
        this.previousAnchorCol = other.previousAnchorCol;
        this.isPlaced = other.isPlaced;
    }
    
    // 相邻关系管理功能已迁移到BuildingManager.ts中的BuildingManager类
}