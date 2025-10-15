import { _decorator, Camera, Component, director, macro, math, Node, v2, v3, Vec2, Vec3 } from 'cc';
import { Actor } from '../Actor/Actor';
const { ccclass, property } = _decorator;

@ccclass('CameraController')
export class CameraController extends Component {
    @property
    OrthoHeight: number = 200;
    @property(Node)
    player: Node = null;
    private camera: Camera = null;
    // private shelter: Node = null;
    private playerPos: Vec3 = null;
    private cameraPos: Vec3 = null;
    private move: Vec3 = null;
    private isCameraOverMapHeight: boolean = null;
    private isCameraOverMapWidth: boolean = null;
    onLoad() {
        // macro.FIX_ARTIFACTS_BY_STRECHING_TEXEL = 0;
        this.camera = this.node.getComponent(Camera);
        // this.shelter = this.node.parent.getChildByName('Shelter')
        // this.player = this.shelter.getChildByName('player');
    }
    start() {
        this.cameraPos = v3(0, 0, 0);
        this.camera.orthoHeight = this.OrthoHeight;
        //如果没有设置actorNode，则默认获取场景中的第一个Actor节点
        if (!this.player) {
            const actorComponent = director.getScene().getComponentInChildren(Actor);
            if (actorComponent) {
                this.player = actorComponent.node;
            } else {
                console.error('CameraController:没有找到Actor节点，请设置player');
            }
        }
    }

    lateUpdate(deltaTime: number) {
        this.camera.orthoHeight = this.OrthoHeight;
        this.playerPos = this.player.getPosition();
        const x = this.playerPos.x;
        const y = this.playerPos.y;
        // const upLimit = (640-this.OrthoHeight)/2
        // //以角色当前位置当作相机位置
        // this.isCameraOverMapHeight = (y < -160 || y > 160)
        // this.isCameraOverMapWidth = (x < -90 || x > 460)
        // //如果相机只超出了地图高度但没超出宽度
        // if(this.isCameraOverMapHeight&&!this.isCameraOverMapWidth){
        //     this.cameraPos.x = x;
        //     this.node.setPosition(this.cameraPos);
        //     return;
        // }
        // //如果相机只超出了地图宽度但没超出高度
        // if(this.isCameraOverMapWidth&&!this.isCameraOverMapHeight){
        //     this.cameraPos.y = y;
        //     this.node.setPosition(this.cameraPos);
        //     return;
        // }
        // //如果相机超出了地图高度和宽度
        // if(this.isCameraOverMapHeight&&this.isCameraOverMapWidth){
        //     return;
        // }
        // if (this.playerPos.equals(this.cameraPos)) {
        //     return;
        // }
        this.cameraPos = this.playerPos
        this.node.setPosition(this.cameraPos);

    }
}


