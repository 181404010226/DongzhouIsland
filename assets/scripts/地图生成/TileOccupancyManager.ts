import { _decorator, Component } from 'cc';
import { BuildInfo } from './BuildInfo';
const { ccclass, property } = _decorator;

/**
 * 地块占用信息接口
 */
export interface TileOccupancyInfo {
    buildingId: string;
    buildingType: string;
    anchorRow: number;
    anchorCol: number;
    width: number;
    height: number;
}

/**
 * 地块占用管理器
 * 用于管理地图上建筑的地块占用情况
 */
@ccclass('TileOccupancyManager')
export class TileOccupancyManager extends Component {
    // 地块占用映射表，使用"row_col"作为key
    private tileOccupancyMap: Map<string, TileOccupancyInfo> = new Map();
    
    /**
     * 检查是否可以在指定位置放置建筑（考虑建筑尺寸）
     */
    public canPlaceBuildingAt(row: number, col: number, width: number, height: number): boolean {
        // 检查所有需要占用的地块（从锚点左下角开始向左上方向）
        for (let r = row - height + 1; r <= row; r++) {
            for (let c = col - width + 1; c <= col; c++) {
                // 检查是否超出边界（索引小于0表示超出边界）
                if (r < 0 || c < 0) {
                    return false;
                }
                
                // 检查地块是否已被占用
                const tileKey = `${r}_${c}`;
                if (this.tileOccupancyMap.has(tileKey)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * 标记地块为已占用
     */
    public markTilesAsOccupied(anchorRow: number, anchorCol: number, buildInfo: BuildInfo, buildingId: string): void {
        const width = buildInfo.getBuildingWidth();
        const height = buildInfo.getBuildingHeight();
        
        const occupancyInfo: TileOccupancyInfo = {
            buildingId: buildingId,
            buildingType: buildInfo.getBuildingType(),
            anchorRow: anchorRow,
            anchorCol: anchorCol,
            width: width,
            height: height
        };
        
        // 标记所有占用的地块（从锚点左下角开始向左上方向）
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                const tileKey = `${r}_${c}`;
                this.tileOccupancyMap.set(tileKey, occupancyInfo);
            }
        }
    }
    
    /**
     * 清除地块占用标记
     */
    public clearTileOccupancy(anchorRow: number, anchorCol: number, width: number, height: number): void {
        // 清除从锚点左下角开始向左上方向的占用地块
        for (let r = anchorRow - height + 1; r <= anchorRow; r++) {
            for (let c = anchorCol - width + 1; c <= anchorCol; c++) {
                const tileKey = `${r}_${c}`;
                this.tileOccupancyMap.delete(tileKey);
            }
        }
    }
    
    /**
     * 根据建筑ID清除占用标记
     */
    public clearTileOccupancyByBuildingId(buildingId: string): void {
        const keysToDelete: string[] = [];
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (occupancyInfo.buildingId === buildingId) {
                keysToDelete.push(tileKey);
            }
        }
        
        keysToDelete.forEach(key => {
            this.tileOccupancyMap.delete(key);
        });
    }
    
    /**
     * 检查指定地块是否已放置建筑
     */
    public isBuildingPlaced(row: number, col: number): boolean {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.has(tileKey);
    }
    
    /**
     * 获取所有已放置建筑的锚点坐标
     */
    public getPlacedBuildingPositions(): Array<{row: number, col: number, buildingType: string, width: number, height: number}> {
        const positions: Array<{row: number, col: number, buildingType: string, width: number, height: number}> = [];
        const processedBuildings = new Set<string>();
        
        // 遍历占用映射，只收集锚点位置
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (!processedBuildings.has(occupancyInfo.buildingId)) {
                positions.push({
                    row: occupancyInfo.anchorRow,
                    col: occupancyInfo.anchorCol,
                    buildingType: occupancyInfo.buildingType,
                    width: occupancyInfo.width,
                    height: occupancyInfo.height
                });
                processedBuildings.add(occupancyInfo.buildingId);
            }
        }
        
        return positions;
    }
    
    /**
     * 清除所有占用标记
     */
    public clearAllOccupancy(): void {
        this.tileOccupancyMap.clear();
        console.log('已清除所有地块占用标记');
    }
    
    /**
     * 获取指定地块的建筑信息
     */
    public getBuildingInfoAt(row: number, col: number): TileOccupancyInfo | null {
        const tileKey = `${row}_${col}`;
        return this.tileOccupancyMap.get(tileKey) || null;
    }
    
    /**
     * 检查指定区域是否完全空闲
     */
    public isAreaFree(startRow: number, startCol: number, width: number, height: number): boolean {
        // 从锚点（左下角）开始，向左上方向检查区域
        for (let r = startRow - height + 1; r <= startRow; r++) {
            for (let c = startCol - width + 1; c <= startCol; c++) {
                // 检查是否超出边界（索引小于0表示超出边界）
                if (r < 0 || c < 0) {
                    return false;
                }
                
                // 检查地块是否已被占用
                if (this.isBuildingPlaced(r, c)) {
                    return false;
                }
            }
        }
        return true;
    }
    
    /**
     * 获取所有占用的地块坐标（包括非锚点）
     */
    public getAllOccupiedTiles(): Array<{row: number, col: number, buildingType: string}> {
        const tiles: Array<{row: number, col: number, buildingType: string}> = [];
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            const [row, col] = tileKey.split('_').map(Number);
            tiles.push({
                row: row,
                col: col,
                buildingType: occupancyInfo.buildingType
            });
        }
        
        return tiles;
    }
    
    /**
     * 获取占用统计信息
     */
    public getOccupancyStats(): {
        totalOccupiedTiles: number,
        totalBuildings: number,
        buildingTypeCount: Map<string, number>
    } {
        const buildingTypeCount = new Map<string, number>();
        const processedBuildings = new Set<string>();
        let totalBuildings = 0;
        
        for (const [tileKey, occupancyInfo] of this.tileOccupancyMap) {
            if (!processedBuildings.has(occupancyInfo.buildingId)) {
                totalBuildings++;
                const count = buildingTypeCount.get(occupancyInfo.buildingType) || 0;
                buildingTypeCount.set(occupancyInfo.buildingType, count + 1);
                processedBuildings.add(occupancyInfo.buildingId);
            }
        }
        
        return {
            totalOccupiedTiles: this.tileOccupancyMap.size,
            totalBuildings: totalBuildings,
            buildingTypeCount: buildingTypeCount
        };
    }
    
    /**
     * 获取占用映射的副本（用于调试或序列化）
     */
    public getOccupancyMapCopy(): Map<string, TileOccupancyInfo> {
        return new Map(this.tileOccupancyMap);
    }
    
    /**
     * 从占用映射副本恢复数据（用于反序列化）
     */
    public restoreFromOccupancyMap(occupancyMap: Map<string, TileOccupancyInfo>): void {
        this.tileOccupancyMap = new Map(occupancyMap);
    }
}