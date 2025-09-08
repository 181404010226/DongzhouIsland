import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 导航点信息组件
 * 存储每个导航点的权重和相邻点信息
 */
@ccclass('NavigationPointInfo')
export class NavigationPointInfo extends Component {
    /**
     * 导航点权重
     * 草地: 10, 蓝色地块: 5, 黄色地块: 1
     */
    @property
    weight: number = 10;

    /**
     * 相邻的导航点列表（半径30px内）
     */
    @property([Node])
    adjacentPoints: Node[] = [];

    /**
     * 获取权重
     */
    getWeight(): number {
        return this.weight;
    }

    /**
     * 设置权重
     */
    setWeight(weight: number): void {
        this.weight = weight;
    }

    /**
     * 获取相邻点
     */
    getAdjacentPoints(): Node[] {
        return this.adjacentPoints;
    }

    /**
     * 设置相邻点
     */
    setAdjacentPoints(points: Node[]): void {
        this.adjacentPoints = points;
    }

    /**
     * 添加相邻点
     */
    addAdjacentPoint(point: Node): void {
        if (!this.adjacentPoints.includes(point)) {
            this.adjacentPoints.push(point);
        }
    }

    /**
     * 清空相邻点
     */
    clearAdjacentPoints(): void {
        this.adjacentPoints = [];
    }
}