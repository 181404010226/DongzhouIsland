import { _decorator, Component, TiledMap, TiledLayer, UITransform, v2, v3, Size, Graphics, Color } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('GridTile')
@executeInEditMode()
export class GridTile extends Component {
    @property
    x: number = 0;

    @property
    y: number = 0;

    private _layer: TiledLayer | null = null;

    // 选框可视属性
    @property({ tooltip: '是否绘制菱形选框' })
    showFrame: boolean = true;

    @property({ tooltip: '选框线宽（像素）' })
    lineWidth: number = 2;

    @property({ tooltip: '选框描边颜色' })
    lineColor: Color = new Color(0, 170, 255, 255);

    @property({ tooltip: '填充透明度（0-255），0为不填充' })
    fillOpacity: number = 0;

    initialize(layer: TiledLayer, x: number, y: number) {
        this._layer = layer;
        this.x = x;
        this.y = y;
        this.refresh();
    }

    setXY(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.refresh();
    }

    refresh() {
        const layer = this._layer ?? this.node.parent?.getComponent(TiledLayer);
        if (!layer) return;
        const map: TiledMap = layer.node.parent?.getComponent(TiledMap);
        if (!map) return;

        const tileSize = map.getTileSize();
        const mapSize = map.getMapSize();

        let ui = this.node.getComponent(UITransform);
        if (!ui) ui = this.node.addComponent(UITransform);
        ui.setContentSize(tileSize);
        ui.setAnchorPoint(v2(0.5, 0.5));

        // 等距（isometric）地图：按菱形结构计算中心坐标
        // 以地图中心为原点，半宽/半高为 tileSize 的一半
        const dx = this.x - mapSize.width / 2 + 0.5;   // 列相对中心
        const dy = this.y - mapSize.height / 2 + 0.5;  // 行相对中心
        const px = (dx - dy) * (tileSize.width / 2);
        const py = -(dx + dy) * (tileSize.height / 2);
        this.node.setPosition(v3(px, py, 0));

        // 绘制菱形选框，使其符合 45° 等距地图瓦片的形状
        if (this.showFrame) {
            let g = this.node.getComponent(Graphics);
            if (!g) g = this.node.addComponent(Graphics);

            g.clear();
            g.lineWidth = this.lineWidth;
            g.strokeColor = this.lineColor;

            const halfW = tileSize.width / 2;
            const halfH = tileSize.height / 2;

            // 顶->右->下->左->闭合，局部坐标以中心为原点
            g.moveTo(0, halfH);
            g.lineTo(halfW, 0);
            g.lineTo(0, -halfH);
            g.lineTo(-halfW, 0);
            g.close();

            if (this.fillOpacity > 0) {
                g.fillColor = new Color(this.lineColor.r, this.lineColor.g, this.lineColor.b, this.fillOpacity);
                g.fill();
            }
            g.stroke();
        } else {
            // 如果不显示选框，确保清除既有绘制
            const g = this.node.getComponent(Graphics);
            if (g) g.clear();
        }
    }

    onLoad() {
        // 在编辑器中也绘制一次，便于场景视图观察菱形
        this.refresh();
    }
}