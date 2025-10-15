import { _decorator, Animation, BoxCollider2D, CCFloat, CircleCollider2D,EventKeyboard, Collider, Collider2D, Component, Contact2DType,Input, input, director, EPhysics2DDrawFlags, ICollisionEvent, IPhysics2DContact, Node, PhysicsSystem, PhysicsSystem2D, RigidBody, RigidBody2D, SkeletalAnimation, v2, v3, Vec2, Vec3 } from 'cc';
import { StateDefine } from './StateDefine';
import { TowardsDirection } from './TowardsDirection';
const { ccclass, property } = _decorator;
let tempVelocity = v2();
@ccclass('Actor')
export class Actor extends Component {
    static _instance: Actor = null;
    static get instance(): Actor {
        if (this._instance == null) {
            this._instance = new Actor();
        }
        return this._instance;
    }
    currentState: StateDefine = null;
    currentTowards: TowardsDirection = null;
    private rigidBody: RigidBody2D = null;
    collider: CircleCollider2D = null;
    private animation: Animation = null;
    @property(CCFloat)
    linearSpeed: number = 1.0;
    input: Vec2 = v2();
    onLoad() {
        this.rigidBody = this.node.getComponent(RigidBody2D);
        this.collider = this.node.getComponent(CircleCollider2D);
        this.animation = this.node.getChildByName('role').getComponent(Animation);
    }
    start() {
        this.currentState = StateDefine.Idle;
        this.currentTowards = TowardsDirection.Down;
        this.animation.play('Idle-Down');
    }
    protected onDestroy(): void {
    }
    update(deltaTime: number) {
        switch (this.currentState) {
            case StateDefine.Idle:
                break;
            case StateDefine.Run:
                this.doMove();
                break;
            default:
                break;
        }
    }

    doMove() {
        const speed = this.input.length() * this.linearSpeed;
        tempVelocity.x = this.input.x * speed;
        tempVelocity.y = this.input.y * speed;
        this.rigidBody.linearVelocity = tempVelocity;
    }
    stopMove() {
        this.rigidBody.linearVelocity = Vec2.ZERO;

    }
    changeState(deststate: StateDefine) {
        if (deststate != StateDefine.Run) {
            //只有切换的一下才速度归零，在update里面一直执行速度归零没有必要
            this.stopMove();
        }
        //更新当前状态，这样update就能根据状态做相应的处理
        this.currentState = deststate;
        //状态改变时，播放相应的动画
        this.changeAnimation();
    }
    //获取方向
    getTowards() {
        return this.currentTowards;
    }
    //切换方向
    setTowards(towards: TowardsDirection) {
        this.currentTowards = towards;
    }
    //切换动画
    changeAnimation() {
        if (this.currentState == StateDefine.Run) {
            this.playAnimation('Run', this.currentTowards);
        }
        if (this.currentState == StateDefine.Idle) {
            this.playAnimation('Idle', this.currentTowards);
        }
    }
    //播放动画
    playAnimation(state, direction) {
        //设置是否水平翻转
        const scale: Vec3 = (direction === TowardsDirection.Left) ? v3(-1, 1, 1) : v3(1, 1, 1);
        //设置动画名，如果方向为Left就使用Right的动画，然后水平翻转
        const animationName = `${state}-${direction === TowardsDirection.Left ? 'Right' : direction}`;
        this.animation.node.setScale(scale);
        this.animation.play(animationName);
    }
    respawn() {
        this.currentState = StateDefine.Idle;
    }
}


