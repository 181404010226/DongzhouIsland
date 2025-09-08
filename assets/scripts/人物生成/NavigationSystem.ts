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
     * 导航点数据映射表
     */
    private navigationPoints: Map<string, NavigationPointData> = new Map();
    
    /**
     * 导航点节点映射表
     */
    private navigationNodes: Map<string, Node> = new Map();
    
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
            
            console.log(`成功解析 ${data.length} 个导航点数据`);
            
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
     * 获取导航点的相邻点列表
     * @param pointName 导航点名称
     */
    getAdjacentPoints(pointName: string): string[] {
        const pointData = this.getNavigationPoint(pointName);
        return pointData ? pointData.adjacentPoints : [];
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
     * 获取随机导航点名称
     */
    getRandomNavigationPointName(): string | null {
        const names = this.getAllNavigationPointNames();
        if (names.length === 0) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * names.length);
        return names[randomIndex];
    }
    
    /**
     * 从相邻点中随机选择一个
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
}