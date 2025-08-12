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
}