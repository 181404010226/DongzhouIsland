import { _decorator, Component, Node, Vec3, JsonAsset } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 导航点数据结构
 */
export interface NavigationPointData {
    name: string;
    position: { x: number; y: number; z: number };
    weight: number;
    adjacentPoints: string[]; // 存储相邻点的名字
}

/**
 * A*算法节点数据结构
 */
interface AStarNode {
    name: string;
    gCost: number; // 从起点到当前节点的实际代价
    hCost: number; // 从当前节点到终点的启发式代价
    fCost: number; // gCost + hCost
    parent: AStarNode | null; // 父节点，用于回溯路径
}

/**
 * 路径查找结果
 */
export interface PathResult {
    success: boolean;
    path: string[]; // 路径节点名称数组
    totalCost: number; // 总代价
}

/**
 * 导航解析系统
 * 接受JSON作为参数，解析导航数据并存储在数据结构中
 */
@ccclass('NavigationSystem')
export class NavigationSystem extends Component {
    
    /**
     * 导航数据JSON文件
     */
    @property(JsonAsset)
    navigationJsonAsset: JsonAsset = null;
    
    /**
     * 被禁用的导航点列表（只读，用于编辑器可视化）
     */
    @property({ type: [String], readonly: true, displayName: "禁用的导航点" })
    private _disabledPointsDisplay: string[] = [];
    
    /**
     * 导航点数据映射表
     */
    private navigationPoints: Map<string, NavigationPointData> = new Map();
    
    /**
     * 导航点节点映射表
     */
    private navigationNodes: Map<string, Node> = new Map();
    
    /**
     * 禁用的导航点集合
     */
    private disabledNavigationPoints: Set<string> = new Set();
    
    /**
     * 注册的游客控制器映射表（导航点名称 -> 游客控制器数组）
     */
    private touristControllers: Map<string, any[]> = new Map();
    
    /**
     * 单例实例
     */
    private static instance: NavigationSystem = null;
    
    onLoad() {
        // 检查场景中是否已有实例
        if (NavigationSystem.instance && NavigationSystem.instance !== this) {
            console.warn('场景中已存在NavigationSystem实例，当前实例将被销毁');
            this.node.destroy();
            return;
        }
        
        NavigationSystem.instance = this;
        
        // 自动加载JSON数据
        if (this.navigationJsonAsset) {
            this.parseNavigationData(this.navigationJsonAsset.json);
        }
        
        // 初始化可视化显示
        this.updateDisabledPointsDisplay();
    }
    
    /**
     * 获取单例实例
     */
    static getInstance(): NavigationSystem {
        return NavigationSystem.instance;
    }
    
    /**
     * 解析导航JSON数据
     * @param jsonData JSON字符串、对象或数组
     */
    parseNavigationData(jsonData: string | NavigationPointData[] | Record<string, any>): void {
        try {
            let data: NavigationPointData[];
            
            if (typeof jsonData === 'string') {
                data = JSON.parse(jsonData);
            } else if (Array.isArray(jsonData)) {
                data = jsonData;
            } else {
                // 处理Record<string, any>类型，假设它是一个包含数组的对象
                // 尝试从对象中提取数组数据
                if (jsonData && typeof jsonData === 'object') {
                    // 如果对象直接是数组格式的数据
                    const values = Object.values(jsonData);
                    if (values.length > 0 && Array.isArray(values[0])) {
                        data = values[0] as NavigationPointData[];
                    } else if (Array.isArray(jsonData)) {
                        data = jsonData as NavigationPointData[];
                    } else {
                        // 假设整个对象就是导航点数据的集合
                        data = Object.values(jsonData) as NavigationPointData[];
                    }
                } else {
                    throw new Error('无效的JSON数据格式');
                }
            }
            
            // 清空现有数据
            this.navigationPoints.clear();
            
            // 解析并存储导航点数据
            for (const pointData of data) {
                this.navigationPoints.set(pointData.name, pointData);
            }
            
        } catch (error) {
            console.error('解析导航数据失败:', error);
        }
    }
    
    /**
     * 注册导航点节点
     * @param pointName 导航点名称
     * @param node 对应的节点
     */
    registerNavigationNode(pointName: string, node: Node): void {
        this.navigationNodes.set(pointName, node);
    }
    
    /**
     * 获取导航点数据
     * @param pointName 导航点名称
     */
    getNavigationPoint(pointName: string): NavigationPointData | null {
        return this.navigationPoints.get(pointName) || null;
    }
    
    /**
     * 获取导航点节点
     * @param pointName 导航点名称
     */
    getNavigationNode(pointName: string): Node | null {
        return this.navigationNodes.get(pointName) || null;
    }
    
    /**
     * 获取导航点的世界坐标
     * @param pointName 导航点名称
     */
    getNavigationPointPosition(pointName: string): Vec3 | null {
        const pointData = this.getNavigationPoint(pointName);
        if (pointData) {
            return new Vec3(pointData.position.x, pointData.position.y, pointData.position.z);
        }
        
        const node = this.getNavigationNode(pointName);
        if (node) {
            return node.getWorldPosition();
        }
        
        return null;
    }
    
    /**
     * 获取导航点的相邻点列表（排除禁用的点）
     * @param pointName 导航点名称
     */
    getAdjacentPoints(pointName: string): string[] {
        const pointData = this.getNavigationPoint(pointName);
        if (!pointData) {
            return [];
        }
        
        // 过滤掉禁用的导航点
        return pointData.adjacentPoints.filter(adjacentPoint => !this.isNavigationPointDisabled(adjacentPoint));
    }
    
    /**
     * 获取导航点的权重
     * @param pointName 导航点名称
     */
    getNavigationPointWeight(pointName: string): number {
        const pointData = this.getNavigationPoint(pointName);
        return pointData ? pointData.weight : 10; // 默认权重
    }
    
    /**
     * 获取所有导航点名称
     */
    getAllNavigationPointNames(): string[] {
        return Array.from(this.navigationPoints.keys());
    }
    
    /**
     * 获取随机导航点名称（排除禁用的点）
     */
    getRandomNavigationPointName(): string | null {
        const names = this.getAllNavigationPointNames().filter(name => !this.isNavigationPointDisabled(name));
        if (names.length === 0) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * names.length);
        return names[randomIndex];
    }
    
    /**
     * 从相邻点中随机选择一个（排除禁用的点）
     * @param pointName 当前导航点名称
     */
    getRandomAdjacentPoint(pointName: string): string | null {
        const adjacentPoints = this.getAdjacentPoints(pointName);
        if (adjacentPoints.length === 0) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * adjacentPoints.length);
        return adjacentPoints[randomIndex];
    }
    
    /**
     * 检查导航点是否存在
     * @param pointName 导航点名称
     */
    hasNavigationPoint(pointName: string): boolean {
        return this.navigationPoints.has(pointName);
    }
    
    /**
     * 禁用导航点
     * @param pointName 导航点名称
     */
    disableNavigationPoint(pointName: string): void {
        if (!this.hasNavigationPoint(pointName)) {
            console.warn(`尝试禁用不存在的导航点: ${pointName}`);
            return;
        }
        
        this.disabledNavigationPoints.add(pointName);
        console.log(`导航点 ${pointName} 已被禁用`);
        
        // 更新可视化显示
        this.updateDisabledPointsDisplay();
        
        // 通知所有使用该导航点的游客重新计算路径
        this.notifyTouristsToRecalculatePath(pointName);
    }
    
    /**
     * 启用导航点
     * @param pointName 导航点名称
     */
    enableNavigationPoint(pointName: string): void {
        if (this.disabledNavigationPoints.has(pointName)) {
            this.disabledNavigationPoints.delete(pointName);
            console.log(`导航点 ${pointName} 已被启用`);
            
            // 更新可视化显示
            this.updateDisabledPointsDisplay();
        }
    }
    
    /**
     * 检查导航点是否被禁用
     * @param pointName 导航点名称
     */
    isNavigationPointDisabled(pointName: string): boolean {
        return this.disabledNavigationPoints.has(pointName);
    }
    
    /**
     * 获取所有禁用的导航点
     */
    getDisabledNavigationPoints(): string[] {
        return Array.from(this.disabledNavigationPoints);
    }
    
    /**
     * 注册游客控制器到导航点
     * @param pointName 导航点名称
     * @param touristController 游客控制器
     */
    registerTouristAtPoint(pointName: string, touristController: any): void {
        if (!this.touristControllers.has(pointName)) {
            this.touristControllers.set(pointName, []);
        }
        
        const controllers = this.touristControllers.get(pointName);
        if (!controllers.includes(touristController)) {
            controllers.push(touristController);
        }
    }
    
    /**
     * 从导航点注销游客控制器
     * @param pointName 导航点名称
     * @param touristController 游客控制器
     */
    unregisterTouristFromPoint(pointName: string, touristController: any): void {
        const controllers = this.touristControllers.get(pointName);
        if (controllers) {
            const index = controllers.indexOf(touristController);
            if (index !== -1) {
                controllers.splice(index, 1);
            }
            
            // 如果没有游客了，删除该导航点的记录
            if (controllers.length === 0) {
                this.touristControllers.delete(pointName);
            }
        }
    }
    
    /**
     * 获取在指定导航点的所有游客控制器
     * @param pointName 导航点名称
     */
    getTouristsAtPoint(pointName: string): any[] {
        return this.touristControllers.get(pointName) || [];
    }
    
    /**
     * 获取所有经过指定导航点的游客控制器（包括路径中包含该点的游客）
     * @param pointName 导航点名称
     */
    getTouristsUsingPoint(pointName: string): any[] {
        const tourists: any[] = [];
        
        // 获取当前在该点的游客
        const touristsAtPoint = this.getTouristsAtPoint(pointName);
        tourists.push(...touristsAtPoint);
        
        // 遍历所有注册的游客，检查其路径是否包含该点
        for (const [_, controllers] of this.touristControllers) {
            for (const controller of controllers) {
                if (controller && typeof controller.isPathContainingPoint === 'function') {
                    if (controller.isPathContainingPoint(pointName) && !tourists.includes(controller)) {
                        tourists.push(controller);
                    }
                }
            }
        }
        
        return tourists;
    }
    
    /**
     * 通知所有使用指定导航点的游客重新计算路径
     * @param pointName 导航点名称
     */
    private notifyTouristsToRecalculatePath(pointName: string): void {
        const affectedTourists = this.getTouristsUsingPoint(pointName);
        
        console.log(`导航点 ${pointName} 被禁用，通知 ${affectedTourists.length} 个游客重新计算路径`);
        
        for (const tourist of affectedTourists) {
            if (tourist && typeof tourist.forceRecalculatePath === 'function') {
                tourist.forceRecalculatePath();
            }
        }
    }
    
    /**
     * 根据建筑位置计算对应的导航点名称
     * @param buildingRow 建筑行位置
     * @param buildingCol 建筑列位置
     * @returns 对应的导航点名称，如果不存在则返回null
     */
    getNavigationPointNameByBuildingPosition(buildingRow: number, buildingCol: number): string | null {
        // 计算对应的导航点位置 (2i, 2j)
        const navRow = 2 * buildingRow;
        const navCol = 2 * buildingCol;
        
        // 尝试不同的导航点命名格式
        const possibleNames = [
            `Tile_${navRow}_${navCol}`,
        ];
        
        for (const name of possibleNames) {
            if (this.hasNavigationPoint(name)) {
                return name;
            }
        }
        
        console.warn(`未找到建筑位置 (${buildingRow}, ${buildingCol}) 对应的导航点 (${navRow}, ${navCol})`);
        return null;
    }
    
    /**
     * 计算两个导航点之间的距离
     * @param pointName1 第一个导航点
     * @param pointName2 第二个导航点
     */
    getDistanceBetweenPoints(pointName1: string, pointName2: string): number {
        const pos1 = this.getNavigationPointPosition(pointName1);
        const pos2 = this.getNavigationPointPosition(pointName2);
        
        if (!pos1 || !pos2) {
            return Infinity;
        }
        
        return Vec3.distance(pos1, pos2);
    }
    
    /**
     * 使用A*算法查找从起点到终点的最优路径（考虑禁用的导航点）
     * @param startPoint 起点名称
     * @param endPoint 终点名称
     * @returns 路径查找结果
     */
    findPathAStar(startPoint: string, endPoint: string): PathResult {
        // 验证起点和终点是否存在且未被禁用
        if (!this.hasNavigationPoint(startPoint) || !this.hasNavigationPoint(endPoint)) {
            console.error(`A*路径查找失败: 起点 ${startPoint} 或终点 ${endPoint} 不存在`);
            return { success: false, path: [], totalCost: 0 };
        }
        
        if (this.isNavigationPointDisabled(startPoint) || this.isNavigationPointDisabled(endPoint)) {
            console.error(`A*路径查找失败: 起点 ${startPoint} 或终点 ${endPoint} 已被禁用`);
            return { success: false, path: [], totalCost: 0 };
        }
        
        // 如果起点就是终点，直接返回
        if (startPoint === endPoint) {
            return { success: true, path: [startPoint], totalCost: 0 };
        }
        
        // 初始化开放列表和关闭列表
        const openList: AStarNode[] = [];
        const closedList: Set<string> = new Set();
        const allNodes: Map<string, AStarNode> = new Map();
        
        // 创建起始节点
        const startNode: AStarNode = {
            name: startPoint,
            gCost: 0,
            hCost: this.calculateHeuristic(startPoint, endPoint),
            fCost: 0,
            parent: null
        };
        startNode.fCost = startNode.gCost + startNode.hCost;
        
        openList.push(startNode);
        allNodes.set(startPoint, startNode);
        
        // A*主循环
        while (openList.length > 0) {
            // 找到fCost最小的节点
            let currentNode = openList[0];
            let currentIndex = 0;
            
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].fCost < currentNode.fCost || 
                    (openList[i].fCost === currentNode.fCost && openList[i].hCost < currentNode.hCost)) {
                    currentNode = openList[i];
                    currentIndex = i;
                }
            }
            
            // 将当前节点从开放列表移到关闭列表
            openList.splice(currentIndex, 1);
            closedList.add(currentNode.name);
            
            // 如果到达终点，重构路径
            if (currentNode.name === endPoint) {
                return this.reconstructPath(currentNode);
            }
            
            // 检查所有相邻节点（getAdjacentPoints已经过滤了禁用的点）
            const adjacentPoints = this.getAdjacentPoints(currentNode.name);
            for (const adjacentPointName of adjacentPoints) {
                // 跳过已在关闭列表中的节点
                if (closedList.has(adjacentPointName)) {
                    continue;
                }
                
                // 跳过禁用的导航点（双重保险）
                if (this.isNavigationPointDisabled(adjacentPointName)) {
                    continue;
                }
                
                // 计算到相邻节点的代价
                const moveCost = this.getMoveCost(currentNode.name, adjacentPointName);
                const tentativeGCost = currentNode.gCost + moveCost;
                
                // 检查是否已在开放列表中
                let adjacentNode = allNodes.get(adjacentPointName);
                let isInOpenList = openList.some(node => node.name === adjacentPointName);
                
                if (!adjacentNode) {
                    // 创建新节点
                    adjacentNode = {
                        name: adjacentPointName,
                        gCost: tentativeGCost,
                        hCost: this.calculateHeuristic(adjacentPointName, endPoint),
                        fCost: 0,
                        parent: currentNode
                    };
                    adjacentNode.fCost = adjacentNode.gCost + adjacentNode.hCost;
                    allNodes.set(adjacentPointName, adjacentNode);
                    openList.push(adjacentNode);
                } else if (tentativeGCost < adjacentNode.gCost) {
                    // 找到更好的路径，更新节点
                    adjacentNode.gCost = tentativeGCost;
                    adjacentNode.fCost = adjacentNode.gCost + adjacentNode.hCost;
                    adjacentNode.parent = currentNode;
                    
                    // 如果不在开放列表中，添加进去
                    if (!isInOpenList) {
                        openList.push(adjacentNode);
                    }
                }
            }
        }
        
        // 没有找到路径
        console.warn(`A*算法未找到从 ${startPoint} 到 ${endPoint} 的路径`);
        return { success: false, path: [], totalCost: 0 };
    }
    
    /**
     * 计算启发式函数值（使用欧几里得距离）
     * @param fromPoint 起点
     * @param toPoint 终点
     * @returns 启发式代价
     */
    private calculateHeuristic(fromPoint: string, toPoint: string): number {
        return this.getDistanceBetweenPoints(fromPoint, toPoint);
    }
    
    /**
     * 计算从一个点移动到相邻点的代价
     * @param fromPoint 起点
     * @param toPoint 终点
     * @returns 移动代价
     */
    private getMoveCost(fromPoint: string, toPoint: string): number {
        // 基础距离代价
        const distance = this.getDistanceBetweenPoints(fromPoint, toPoint);
        
        // 考虑目标点的权重
        const toPointWeight = this.getNavigationPointWeight(toPoint);
        
        // 总代价 = 距离 + 权重影响
        return distance + toPointWeight;
    }
    
    /**
     * 重构路径（从终点回溯到起点）
     * @param endNode 终点节点
     * @returns 路径结果
     */
    private reconstructPath(endNode: AStarNode): PathResult {
        const path: string[] = [];
        let currentNode: AStarNode | null = endNode;
        let totalCost = endNode.gCost;
        
        // 从终点回溯到起点
        while (currentNode !== null) {
            path.unshift(currentNode.name); // 在数组开头插入
            currentNode = currentNode.parent;
        }
        
        return {
            success: true,
            path: path,
            totalCost: totalCost
        };
    }
    
    /**
     * 获取从起点到终点的路径节点名称数组（简化接口）
     * @param startPoint 起点名称
     * @param endPoint 终点名称
     * @returns 路径节点名称数组，如果找不到路径则返回空数组
     */
    getPath(startPoint: string, endPoint: string): string[] {
        const result = this.findPathAStar(startPoint, endPoint);
        return result.success ? result.path : [];
    }
    
    /**
     * 更新禁用导航点的可视化显示
     * @private
     */
    private updateDisabledPointsDisplay(): void {
        this._disabledPointsDisplay = Array.from(this.disabledNavigationPoints).sort();
    }
}