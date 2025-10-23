import { _decorator, Component, Node, Graphics, Color, Vec3, UITransform } from 'cc';
import { TileOccupancyManager } from './TileOccupancyManager';

const { ccclass, property } = _decorator;

/**
 * BuildingCollisionRange
 * - 接收一个挂载节点，用于生成并挂载建筑的碰撞范围可视化节点
 * - 碰撞范围按“0圈”基础，并在此基础上收缩 0.5 圈（建筑边缘可行走）
 * - 编辑器模式下绘制矩形；运行模式下隐藏所有图形（禁用 Graphics 组件）
 * - 仅根据当前已放置的建筑生成碰撞框，应用逻辑之后由你编写
 */
@ccclass('BuildingCollisionRange')
export class BuildingCollisionRange extends Component {
    @property({ type: TileOccupancyManager, tooltip: '地块占用管理器（用于获取已放置建筑）' })
    tileOccupancyManager: TileOccupancyManager = null;

    @property({ type: Node, tooltip: '碰撞范围挂载节点（所有矩形将作为其子节点）' })
    collisionRootNode: Node = null;

    @property({ tooltip: '收缩圈数（默认 0.5 圈）' })
    shrinkRings: number = 0.5;

    @property({ tooltip: '线宽' })
    lineWidth: number = 3;

    // 仅影响编辑器模式下的可视化颜色
    @property({ tooltip: '碰撞框描边颜色（编辑器可见）' })
    strokeColorR: number = 255;
    @property({ tooltip: '碰撞框描边颜色（编辑器可见）' })
    strokeColorG: number = 165;
    @property({ tooltip: '碰撞框描边颜色（编辑器可见）' })
    strokeColorB: number = 0;
    @property({ tooltip: '碰撞框描边透明度（编辑器可见）' })
    strokeColorA: number = 200;

    @property({ tooltip: '碰撞框填充透明度（编辑器可见）' })
    fillAlpha: number = 30;

    @property({ tooltip: '启动时自动生成碰撞框' })
    autoGenerateOnStart: boolean = true;

    @property({ tooltip: '勾选则显示碰撞框' })
    showCollision: boolean = true;

    // 记录已生成的碰撞节点，便于清理
    private collisionNodes: Node[] = [];

    private lastShowCollision: boolean = true;

    start() {
        if (!this.tileOccupancyManager || !this.collisionRootNode) {
            console.warn('[BuildingCollisionRange] 请设置 tileOccupancyManager 与 collisionRootNode');
            return;
        }
        this.lastShowCollision = this.showCollision;
        if (this.autoGenerateOnStart) {
            this.generateForPlacedBuildings();
            this.applyDisplayToggle();
        }
    }

    /**
     * 清理已生成的碰撞范围节点
     */
    public clearCollisionNodes() {
        for (const n of this.collisionNodes) {
            if (n && n.isValid) {
                n.destroy();
            }
        }
        this.collisionNodes.length = 0;
    }

    /**
     * 重新生成（清理后再生成）
     */
    public regenerate() {
        this.clearCollisionNodes();
        this.generateForPlacedBuildings();
        this.applyDisplayToggle();
    }

    /**
     * 应用显示开关到所有已生成的碰撞节点
     */
    public applyDisplayToggle() {
        for (const node of this.collisionNodes) {
            if (!node || !node.isValid) continue;
            const g = node.getComponent(Graphics);
            if (g) {
                g.enabled = this.showCollision;
            }
        }
    }

    update() {
        if (this.lastShowCollision !== this.showCollision) {
            const prev = this.lastShowCollision;
            this.lastShowCollision = this.showCollision;
            // 当勾选为真时，如果尚未生成，则生成一次
            if (this.showCollision && this.collisionNodes.length === 0) {
                this.generateForPlacedBuildings();
            }
            this.applyDisplayToggle();
        }
    }

    /**
     * 根据当前已放置的建筑生成碰撞范围矩形
     * 碰撞范围为“0圈 - 0.5圈”的可视化（由开关控制显示）
     */
    public generateForPlacedBuildings() {
        const positions = this.tileOccupancyManager.getPlacedBuildingPositions();
        const mapGen = this.tileOccupancyManager.mapGenerator;
        if (!mapGen) {
            console.warn('[BuildingCollisionRange] 缺少 mapGenerator');
            return;
        }

        // 基于等距菱形网格的单位换算（与影响范围绘制保持一致）
        const tileSize = mapGen.tileSize / Math.sqrt(2);
        const shrinkPixels = this.shrinkRings * 2 * tileSize; // 两侧各收缩 0.5 圈，总计 1 格大小

        for (const pos of positions) {
            const tileKey = `${pos.row}_${pos.col}`;
            const tileNode: Node = this.tileOccupancyManager['getTileByKey']?.(tileKey);
            if (!tileNode) {
                continue;
            }

            const collisionNode = new Node(`Collision_${pos.buildingType}_${pos.row}_${pos.col}`);
            collisionNode.parent = this.collisionRootNode;
            collisionNode.setScale(3, 3, 1);

            // 计算占用 tiles 的中心点（以实际 tiles 为准）
            const rStart = pos.row - pos.height + 1;
            const cStart = pos.col - pos.width + 1;
            let sum = new Vec3(0, 0, 0);
            let count = 0;
            for (let r = rStart; r <= pos.row; r++) {
                for (let c = cStart; c <= pos.col; c++) {
                    const key = `${r}_${c}`;
                    const node = this.tileOccupancyManager['getTileByKey']?.(key);
                    if (node) {
                        const wp = node.getWorldPosition();
                        sum.x += wp.x;
                        sum.y += wp.y;
                        count++;
                    }
                }
            }
            if (count <= 0) {
                continue;
            }
            const centerWorldPos = new Vec3(sum.x / count, sum.y / count, 0);
            collisionNode.setWorldPosition(centerWorldPos);
            collisionNode.setPosition(collisionNode.position.x, collisionNode.position.y, 1);
            // 统一 45° 旋转，与预览/影响范围绘制保持一致
            collisionNode.setRotationFromEuler(0, 0, 45);

            const graphics = collisionNode.addComponent(Graphics);
            graphics.lineWidth = this.lineWidth;
            graphics.strokeColor = new Color(this.strokeColorR, this.strokeColorG, this.strokeColorB, this.strokeColorA);
            graphics.fillColor = new Color(this.strokeColorR, this.strokeColorG, this.strokeColorB, this.fillAlpha);

            // 计算矩形尺寸（在 0 圈基础上按像素收缩）
            let drawW = pos.width * tileSize - shrinkPixels;   // 注意：旋转后 X 方向对应高度/宽度混合，下面会做交换
            let drawH = pos.height * tileSize - shrinkPixels;

            // 为了在 1x1 建筑下仍可视化，做一个最小值夹制（仅影响可视化，不影响后续应用）
            const minSize = tileSize * 0.2;
            if (drawW < minSize) drawW = minSize;
            if (drawH < minSize) drawH = minSize;

            // 与影响范围绘制保持坐标系一致：在 45° 旋转下，采用中心对齐并交换宽高以匹配菱形轴向
            // 这样矩形能与 TileOccupancyManager/BuildingPlacer 的绘制风格一致
            const rectW = drawH; // 交换
            const rectH = drawW; // 交换
            const left = -rectW / 2;
            const bottom = -rectH / 2;

            // UITransform与绘制尺寸保持一致
            const ui = collisionNode.getComponent(UITransform) || collisionNode.addComponent(UITransform);
            ui.setAnchorPoint(0.5, 0.5);
            ui.setContentSize(rectW, rectH);

            graphics.clear();
            graphics.rect(left, bottom, rectW, rectH);
            graphics.fill();
            graphics.stroke();
            graphics.enabled = this.showCollision;

            this.collisionNodes.push(collisionNode);
        }

        console.log(`[BuildingCollisionRange] 已生成 ${this.collisionNodes.length} 个碰撞范围节点`);
    }
}