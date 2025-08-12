import { _decorator, Component, Prefab, SpriteFrame } from 'cc';
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
     * 设置建筑尺寸
     */
    public setBuildingSize(width: number, height: number) {
        this.buildingWidth = Math.max(1, width);
        this.buildingHeight = Math.max(1, height);
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
}