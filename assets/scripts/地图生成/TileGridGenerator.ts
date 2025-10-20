import { _decorator, Component, Node, TiledLayer, TiledMap } from 'cc';
import { GridTile } from './GridTile';
const { ccclass, property } = _decorator;

/**
 * 图层瓦片生成器
 * 将本节点（应挂在 TiledLayer 上）下生成所有格子节点，
 * 并为每个格子自动挂载 GridTile 组件，按中心坐标系定位。
 */
@ccclass('TileGridGenerator')
export class TileGridGenerator extends Component {
    @property({ tooltip: '启动时自动生成瓦片' })
    autoGenerate: boolean = true;

    @property({ tooltip: '生成前清理已有 Tile_* 节点' })
    clearBeforeGenerate: boolean = true;

    private generatedTiles: Node[] = [];

    start() {
        if (this.autoGenerate) {
            this.generateTiles();
        }
    }

    /**
     * 生成当前图层的所有瓦片节点并挂载 GridTile
     */
    public generateTiles(): void {
        const layer = this.node.getComponent(TiledLayer);
        if (!layer) {
            console.warn('[TileGridGenerator] 本节点未挂载 TiledLayer，无法生成瓦片');
            return;
        }

        const map = this.node.parent?.getComponent(TiledMap);
        if (!map) {
            console.warn('[TileGridGenerator] 未找到父级 TiledMap，请确认层级 Canvas/TiledMap/图块层');
            return;
        }

        const mapSize = map.getMapSize();

        // 清理旧瓦片节点（仅删除名称以 Tile_ 开头的）
        if (this.clearBeforeGenerate) {
            for (const child of [...this.node.children]) {
                if (child.name.startsWith('Tile_')) {
                    child.destroy();
                }
            }
            this.generatedTiles = [];
        }

        // 逐行逐列生成瓦片节点
        for (let row = 0; row < mapSize.height; row++) {
            for (let col = 0; col < mapSize.width; col++) {
                const tileNode = new Node(`Tile_${row}_${col}`);
                this.node.addChild(tileNode);

                // 自动挂载 GridTile 并初始化坐标（x=列, y=行）
                const gridTile = tileNode.addComponent(GridTile);
                gridTile.initialize(layer, col, row);

                this.generatedTiles.push(tileNode);
            }
        }

        console.log(`[TileGridGenerator] 已生成瓦片节点: ${this.generatedTiles.length} 个 (${mapSize.width}x${mapSize.height})`);
    }

    /** 获取已生成的所有瓦片节点 */
    public getAllTiles(): Node[] {
        return [...this.generatedTiles];
    }

    /** 手动清理由本脚本生成的瓦片节点 */
    public clearTiles(): void {
        for (const tile of this.generatedTiles) {
            if (tile && tile.isValid) {
                tile.destroy();
            }
        }
        this.generatedTiles = [];
    }
}