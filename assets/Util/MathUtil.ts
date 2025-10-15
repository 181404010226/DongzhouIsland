import { _decorator, Component, math, Node, v2, Vec2 } from 'cc';
import { TowardsDirection } from '../Actor/TowardsDirection';
const { ccclass, property } = _decorator;
const xAxis = v2(1, 0);
@ccclass('MathUtil')
export class MathUtil extends Component {
    static judgeDirection(vec: Vec2) {
        let angleInRadians = vec.angle(xAxis); // 计算与x轴正方向的夹角，结果以弧度表示
        let angleInDegrees = math.toDegree(angleInRadians); // 转换为度数
        if (angleInDegrees <= 45) {
            return TowardsDirection.Right;
        } else if (angleInDegrees >= 135) {
            return TowardsDirection.Left;
        } else if (vec.y > 0) {
            return TowardsDirection.Up;
        } else {
            return TowardsDirection.Down;
        }
    }
    static isPointsOnSameStraightLine(paramA: Vec2, paramB: Vec2, paramC: Vec2) {
        const A = paramA.clone();
        const B = paramB.clone();
        const C = paramC.clone();
        const AB = B.subtract(A);
        const AC = C.subtract(A);
        const cross = AB.cross(AC);
        if (Math.abs(cross) < math.EPSILON) {
            if(cross!==0){
                console.log('Math.abs(cross)',Math.abs(cross))
            }
            return true;
        } else {
            return false;
        }
    }
}


