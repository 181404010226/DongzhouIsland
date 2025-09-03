import { _decorator, Component, Node, Vec3, Color, Sprite, Vec2, Camera, UITransform, director } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 导航点数据结构
 */
interface NavigationPointData {
    name: string;
    position: { x: number; y: number; z: number };
    weight: number;
    adjacentPoints: string[]; // 存储相邻点的名字
}

/**
 * 导航点生成工具
 * 用于生成所有导航点的权重和相邻点信息
 */
@ccclass('NavigationGenerator')
export class NavigationGenerator extends Component {
    /**
     * 背景节点，用于射线检测
     */
    @property(Node)
    backgroundNode: Node = null;

    /**
     * 相邻点检测半径（像素）
     */
    @property
    adjacentRadius: number = 30;

    /**
     * 每次生成的导航点数量限制
     */
    @property
    batchSize: number = 500;

    // 地块颜色定义
    private readonly GRASS_COLOR = new Color(0, 255, 92, 255); // 00FF5C
    private readonly BLUE_COLOR = new Color(0, 224, 255, 255); // 00E0FF
    private readonly YELLOW_COLOR = new Color(255, 255, 0, 255); // FFFF00

    // 权重定义
    private readonly GRASS_WEIGHT = 10;
    private readonly BLUE_WEIGHT = 5;
    private readonly YELLOW_WEIGHT = 1;

    start() {
        // 可以在这里自动生成，或者通过编辑器按钮触发
    }

    /**
     * 生成所有导航点信息
     */
    @property({ displayName: "生成导航点信息" })
    get generateNavigation() {
        return false;
    }

    set generateNavigation(value: boolean) {
        if (value) {
            this.generateAllNavigationInfo();
        }
    }

    /**
     * 生成所有导航点的信息并保存为JSON文件
     */
    generateAllNavigationInfo(): void {
        console.log('开始生成导航点信息...');
        
        const allNavigationPoints = this.getAllNavigationPoints();
        
        if (allNavigationPoints.length === 0) {
            console.warn('未找到导航点');
            return;
        }

        console.log(`找到 ${allNavigationPoints.length} 个导航点，开始生成信息`);

        // 生成所有导航点的数据
        const navigationData: NavigationPointData[] = [];
        
        for (const point of allNavigationPoints) {
            const pointData = this.generatePointInfo(point, allNavigationPoints);
            navigationData.push(pointData);
        }

        // 保存为JSON文件
        this.saveNavigationDataToJson(navigationData);
        
        console.log(`成功生成 ${navigationData.length} 个导航点的信息并保存到JSON文件`);
    }

    /**
     * 获取所有导航点
     */
    private getAllNavigationPoints(): Node[] {
        const points: Node[] = [];
        
        // 遍历当前节点的所有子节点
        for (let i = 0; i < this.node.children.length; i++) {
            const child = this.node.children[i];
            points.push(child);
        }
        
        return points;
    }

    /**
     * 为单个导航点生成信息
     */
    private generatePointInfo(point: Node, allPoints: Node[]): NavigationPointData {
        // 计算权重
        const weight = this.calculateWeight(point);

        // 计算相邻点
        const adjacentPoints = this.findAdjacentPoints(point, allPoints);
        const adjacentPointNames = adjacentPoints.map(p => p.name);

        // 获取位置信息
        const position = point.getPosition();

        console.log(`导航点 ${point.name}: 权重=${weight}, 相邻点数量=${adjacentPoints.length}`);

        return {
            name: point.name,
            position: { x: position.x, y: position.y, z: position.z },
            weight: weight,
            adjacentPoints: adjacentPointNames
        };
    }

    /**
     * 计算导航点的权重
     */
    private calculateWeight(point: Node): number {
        const worldPos = point.getPosition();
        const color = this.getBackgroundColorAtPosition(worldPos);
        
        if (!color) {
            console.warn(`无法获取位置 ${worldPos} 的背景颜色，使用默认权重`);
            return this.GRASS_WEIGHT;
        }

        // 根据颜色确定权重，选择最低的数值
        const weights: number[] = [];
        
        if (this.isColorMatch(color, this.GRASS_COLOR)) {
            weights.push(this.GRASS_WEIGHT);
        }
        if (this.isColorMatch(color, this.BLUE_COLOR)) {
            weights.push(this.BLUE_WEIGHT);
        }
        if (this.isColorMatch(color, this.YELLOW_COLOR)) {
            weights.push(this.YELLOW_WEIGHT);
        }

        // 如果没有匹配的颜色，使用草地权重
        if (weights.length === 0) {
            return -1;
        }

        // 返回最小权重
        return Math.min(...weights);
    }

    /**
     * 获取指定位置的背景颜色
     */
    private getBackgroundColorAtPosition(worldPos: Vec3): Color | null {
        if (!this.backgroundNode) {
            console.error('背景节点未设置');
            return null;
        }

        // 使用节点检测方式获取背景信息
        const hitNode = this.getNodeAtPosition(worldPos, this.backgroundNode);
        
        if (hitNode) {
            console.log(hitNode.name);
            const sprite = hitNode.getComponent(Sprite);
            if (sprite && sprite.color) {
                return sprite.color;
            }
        }

        // 如果没有检测到子节点，尝试直接从背景节点获取颜色
        const backgroundSprite = this.backgroundNode.getComponent(Sprite);
        if (backgroundSprite) {
            return backgroundSprite.color;
        }

        return null;
    }

    /**
     * 获取指定世界坐标位置的所有节点（类似触摸检测）
     */
    private getAllNodesAtPosition(worldPos: Vec3, parentNode: Node, visited: Set<Node> = new Set(), depth: number = 0): Node[] {
        const hitNodes: Node[] = [];
        
        // 防止无限递归 - 检查访问过的节点
        if (visited.has(parentNode)) {
            return hitNodes;
        }
        
        // 防止递归深度过深（最大20层）
        if (depth > 1) {
            console.warn('递归深度超过限制，停止搜索');
            return hitNodes;
        }
        
        visited.add(parentNode);
        
        // 递归检查所有子节点
        for (let i = 0; i < parentNode.children.length; i++) {
            const child = parentNode.children[i];
            
            // 防止重复访问
            if (visited.has(child)) {
                continue;
            }
            
            // 检查子节点是否包含该点
            if (this.isPointInNode(worldPos, child)) {
                hitNodes.push(child);
                // 继续检查子节点的子节点
                const deeperNodes = this.getAllNodesAtPosition(worldPos, child, visited, depth + 1);
                hitNodes.push(...deeperNodes);
            }
        }
        
        return hitNodes;
    }

    /**
     * 获取指定世界坐标位置的节点（类似触摸检测）
     */
    private getNodeAtPosition(worldPos: Vec3, parentNode: Node): Node | null {
        // 创建新的visited集合，避免跨调用的状态污染
        const visited = new Set<Node>();
        
        // 获取所有命中的节点
        const hitNodes = this.getAllNodesAtPosition(worldPos, parentNode, visited);
        
        if (hitNodes.length === 0) {
            return null;
        }
        
        // 如果只有一个节点，直接返回
        if (hitNodes.length === 1) {
            return hitNodes[0];
        }
        
        // 多个节点时，选择权重最低的颜色对应的节点
        let bestNode: Node | null = null;
        let lowestWeight = Infinity;
        
        for (const node of hitNodes) {
            const sprite = node.getComponent(Sprite);
            if (sprite && sprite.color) {
                const weight = this.getColorWeight(sprite.color);
                if (weight < lowestWeight) {
                    lowestWeight = weight;
                    bestNode = node;
                }
            }
        }
        
        return bestNode || hitNodes[0]; // 如果没有找到有颜色的节点，返回第一个
    }

    /**
     * 检查点是否在节点内（扩大1px范围，考虑45°旋转）
     */
    private isPointInNode(worldPos: Vec3, node: Node): boolean {
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }

        // 获取节点的世界坐标和旋转角度
        const nodePos = node.getPosition();
        const contentSize = uiTransform.contentSize;
        const anchorPoint = uiTransform.anchorPoint;
        const rotation = node.angle; // 获取节点旋转角度
        
        // 扩大1px的范围
        const expandSize = 1;
        const expandedWidth = contentSize.width + expandSize * 2;
        const expandedHeight = contentSize.height + expandSize * 2;
        
        // 计算相对于节点中心的偏移
        const centerX = nodePos.x + contentSize.width * (0.5 - anchorPoint.x);
        const centerY = nodePos.y + contentSize.height * (0.5 - anchorPoint.y);
        
        // 将世界坐标转换为相对于节点中心的坐标
        const relativeX = worldPos.x - centerX;
        const relativeY = worldPos.y - centerY;
        
        // 如果有旋转，需要反向旋转来检测
        let localX = relativeX;
        let localY = relativeY;
        
        if (rotation !== 0) {
            const radians = -rotation * Math.PI / 180; // 反向旋转
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            
            localX = relativeX * cos - relativeY * sin;
            localY = relativeX * sin + relativeY * cos;
        }
        
        // 检查点是否在扩大后的包围盒内
        const halfWidth = expandedWidth * 0.5;
        const halfHeight = expandedHeight * 0.5;
        
        return localX >= -halfWidth && localX <= halfWidth && 
               localY >= -halfHeight && localY <= halfHeight;
    }

    /**
     * 颜色匹配检测（允许一定误差）
     */
    private isColorMatch(color1: Color, color2: Color, tolerance: number = 10): boolean {
        const dr = Math.abs(color1.r - color2.r);
        const dg = Math.abs(color1.g - color2.g);
        const db = Math.abs(color1.b - color2.b);
        
        return dr <= tolerance && dg <= tolerance && db <= tolerance;
    }

    /**
     * 根据颜色获取权重值
     */
    private getColorWeight(color: Color): number {
        if (this.isColorMatch(color, this.YELLOW_COLOR)) {
            return this.YELLOW_WEIGHT; // 1
        } else if (this.isColorMatch(color, this.BLUE_COLOR)) {
            return this.BLUE_WEIGHT; // 5
        } else if (this.isColorMatch(color, this.GRASS_COLOR)) {
            return this.GRASS_WEIGHT; // 10
        }
        
        // 默认返回最高权重
        return 999;
    }

    /**
     * 查找相邻的导航点（半径内）
     */
    private findAdjacentPoints(point: Node, allPoints: Node[]): Node[] {
        const adjacentPoints: Node[] = [];
        const pointPos = point.getPosition();

        for (const otherPoint of allPoints) {
            if (otherPoint === point) {
                continue; // 跳过自己
            }

            const otherPos = otherPoint.getPosition();
            const distance = Vec3.distance(pointPos, otherPos);

            if (distance <= this.adjacentRadius) {
                adjacentPoints.push(otherPoint);
            }
        }

        return adjacentPoints;
    }

    /**
     * 保存导航点数据到JSON文件
     */
    private saveNavigationDataToJson(navigationData: NavigationPointData[]): void {
        const jsonString = JSON.stringify(navigationData, null, 2);
        
        // 在Cocos Creator中，我们可以通过console输出JSON数据
        // 开发者可以复制这些数据到文件中
        console.log('=== 导航点数据 JSON ===');
        console.log(jsonString);
        console.log('=== JSON 数据结束 ===');
        
        // 如果在浏览器环境中，可以尝试下载文件
        if (typeof window !== 'undefined' && window.document) {
            this.downloadJsonFile(jsonString, 'navigation_points.json');
        }
    }

    /**
     * 在浏览器中下载JSON文件
     */
    private downloadJsonFile(jsonString: string, filename: string): void {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        console.log(`JSON文件 ${filename} 已下载`);
    }

    /**
     * 清除导航点JSON数据（显示提示信息）
     */
    @property({ displayName: "清除导航点信息" })
    get clearNavigation() {
        return false;
    }

    set clearNavigation(value: boolean) {
        if (value) {
            this.clearAllNavigationInfo();
        }
    }

    /**
     * 清除导航点信息提示
     */
    private clearAllNavigationInfo(): void {
        console.log('导航点信息现在保存在JSON文件中，如需清除请手动删除对应的JSON文件');
        console.log('JSON文件通常保存在浏览器的下载目录中，文件名为: navigation_points.json');
    }
}