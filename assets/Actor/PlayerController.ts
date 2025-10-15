import { _decorator, Collider2D, Component, Contact2DType, EventKeyboard, ICollisionEvent, Input, input, IPhysics2DContact, KeyCode, math, Node, v3, Vec2, Vec3 } from 'cc';
import { Actor } from './Actor';
import { VirtualInput } from '../Input/VirtualInput';
import { StateDefine } from './StateDefine';
import { MathUtil } from '../Util/MathUtil';
const { ccclass, property, requireComponent } = _decorator;
let toDirection = null;
@ccclass('PlayerController')
@requireComponent(Actor)
export class PlayerController extends Component {
    actor: Actor = null;
    collider: Collider2D = null;
    private keyStates: { [key: number]: boolean } = {};

    // private siblingIndex = 0;
    // private parentChildren: Node[] = [];
    // private yPos = 0;
    onLoad() {
        //注册键盘事件
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }
    start() {
        this.actor = this.node.getComponent(Actor);
        this.collider = this.actor.collider;
        // this.parentChildren = this.node.parent.children;
    }
    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }
    update(deltaTime: number) {
        this.actor.input.x = VirtualInput.horizontal;
        this.actor.input.y = VirtualInput.vertical;
        if (this.actor.input.length() > 0) {
            if (this.actor.currentState != StateDefine.Run) {
                this.actor.changeState(StateDefine.Run);
            }
            //只有移动时需要改变方向
            this.changeDirection();
        } else {
            if (this.actor.currentState != StateDefine.Idle) {
                this.actor.changeState(StateDefine.Idle);
            }
        }
        // if (this.node.position.y != this.yPos) {
        //     this.changeShelter();
        //     this.yPos = this.node.position.y;
        // }
    }

    onKeyDown(event: EventKeyboard) {
        const keyCode = event.keyCode;
        if (!this.keyStates[keyCode]) {
            //按下的逻辑
            if (keyCode == KeyCode.KEY_A) {
                if (this.keyStates[KeyCode.KEY_D] == true) {
                    VirtualInput.horizontal = 0;
                    if (VirtualInput.vertical != 0) {
                        if (this.keyStates[KeyCode.KEY_W] == true) {
                            VirtualInput.vertical = 1;
                        } else if (this.keyStates[KeyCode.KEY_S] == true) {
                            VirtualInput.vertical = -1;
                        }
                    }
                } else if (VirtualInput.vertical == 0) {
                    VirtualInput.horizontal = -1;
                } else if (this.keyStates[KeyCode.KEY_W] == true) {
                    VirtualInput.horizontal = -0.7;
                    VirtualInput.vertical = 0.7;
                } else {
                    VirtualInput.horizontal = -0.7;
                    VirtualInput.vertical = -0.7;
                }
            } else if (keyCode == KeyCode.KEY_D) {
                if (this.keyStates[KeyCode.KEY_A] == true) {
                    VirtualInput.horizontal = 0;
                    if (VirtualInput.vertical != 0) {
                        if (this.keyStates[KeyCode.KEY_W] == true) {
                            VirtualInput.vertical = 1;
                        } else if (this.keyStates[KeyCode.KEY_S] == true) {
                            VirtualInput.vertical = -1;
                        }
                    }
                } else if (VirtualInput.vertical == 0) {
                    VirtualInput.horizontal = 1;
                } else if (this.keyStates[KeyCode.KEY_W] == true) {
                    VirtualInput.horizontal = 0.7;
                    VirtualInput.vertical = 0.7;
                } else {
                    VirtualInput.horizontal = 0.7;
                    VirtualInput.vertical = -0.7;
                }
            } else if (keyCode == KeyCode.KEY_W) {
                if (this.keyStates[KeyCode.KEY_S] == true) {
                    VirtualInput.vertical = 0;
                    if (VirtualInput.horizontal != 0) {
                        if (this.keyStates[KeyCode.KEY_A] == true) {
                            VirtualInput.horizontal = -1;
                        } else if (this.keyStates[KeyCode.KEY_D] == true) {
                            VirtualInput.horizontal = 1;
                        }
                    }
                } else if (VirtualInput.horizontal == 0) {
                    VirtualInput.vertical = 1;
                } else if (this.keyStates[KeyCode.KEY_A] == true) {
                    VirtualInput.horizontal = -0.7;
                    VirtualInput.vertical = 0.7;
                } else {
                    VirtualInput.horizontal = 0.7;
                    VirtualInput.vertical = 0.7;
                }
            } else if (keyCode == KeyCode.KEY_S) {
                if (this.keyStates[KeyCode.KEY_W] == true) {
                    VirtualInput.vertical = 0;
                    if (VirtualInput.horizontal != 0) {
                        if (this.keyStates[KeyCode.KEY_A] == true) {
                            VirtualInput.horizontal = -1;
                        } else if (this.keyStates[KeyCode.KEY_D] == true) {
                            VirtualInput.horizontal = 1;
                        }
                    }
                } else if (VirtualInput.horizontal == 0) {
                    VirtualInput.vertical = -1;
                } else if (this.keyStates[KeyCode.KEY_A] == true) {
                    VirtualInput.horizontal = -0.7;
                    VirtualInput.vertical = -0.7;
                } else {
                    VirtualInput.horizontal = 0.7;
                    VirtualInput.vertical = -0.7;
                }
            } else if (keyCode == KeyCode.KEY_F) {
            }
            this.keyStates[keyCode] = true;
        } 
        // else {
        //     console.log('阻止重复按下' + keyCode)
        // }
    }
    onKeyUp(event: EventKeyboard) {
        const keyCode = event.keyCode;
        if (this.keyStates[keyCode]) {
            //松开的逻辑
            if (keyCode == KeyCode.KEY_A) {
                if (VirtualInput.vertical == 0) {
                    if (this.keyStates[KeyCode.KEY_D] == true) {
                        VirtualInput.horizontal = 1;
                    } else {
                        VirtualInput.horizontal = 0;
                    }
                } else if (this.keyStates[KeyCode.KEY_D] == true) {
                    VirtualInput.horizontal = 0.7;
                    if (this.keyStates[KeyCode.KEY_W] == true) {
                        VirtualInput.vertical = 0.7;
                    } else {
                        VirtualInput.vertical = -0.7;
                    }
                } else {
                    VirtualInput.horizontal = 0;
                    if (this.keyStates[KeyCode.KEY_W] == true) {
                        VirtualInput.vertical = 1;
                    } else {
                        VirtualInput.vertical = -1;
                    }
                }
            } else if (keyCode == KeyCode.KEY_D) {
                if (VirtualInput.vertical == 0) {
                    if (this.keyStates[KeyCode.KEY_A] == true) {
                        VirtualInput.horizontal = -1;
                    } else {
                        VirtualInput.horizontal = 0;
                    }
                } else if (this.keyStates[KeyCode.KEY_A] == true) {
                    VirtualInput.horizontal = -0.7;
                    if (this.keyStates[KeyCode.KEY_W] == true) {
                        VirtualInput.vertical = 0.7;
                    } else {
                        VirtualInput.vertical = -0.7;
                    }
                } else {
                    VirtualInput.horizontal = 0;
                    if (this.keyStates[KeyCode.KEY_W] == true) {
                        VirtualInput.vertical = 1;
                    } else {
                        VirtualInput.vertical = -1;
                    }
                }
            } else if (keyCode == KeyCode.KEY_W) {
                if (VirtualInput.horizontal == 0) {
                    if (this.keyStates[KeyCode.KEY_S] == true) {
                        VirtualInput.vertical = -1;
                    } else {
                        VirtualInput.vertical = 0;
                    }
                } else if (this.keyStates[KeyCode.KEY_S] == true) {
                    VirtualInput.vertical = -0.7;
                    if (this.keyStates[KeyCode.KEY_A] == true) {
                        VirtualInput.horizontal = -0.7;
                    } else {
                        VirtualInput.horizontal = 0.7;
                    }
                } else {
                    VirtualInput.vertical = 0;
                    if (this.keyStates[KeyCode.KEY_A] == true) {
                        VirtualInput.horizontal = -1;
                    } else {
                        VirtualInput.horizontal = 1;
                    }
                }
            } else if (keyCode == KeyCode.KEY_S) {
                if (VirtualInput.horizontal == 0) {
                    if (this.keyStates[KeyCode.KEY_W] == true) {
                        VirtualInput.vertical = 1;
                    } else {
                        VirtualInput.vertical = 0;
                    }
                } else if (this.keyStates[KeyCode.KEY_W] == true) {
                    VirtualInput.vertical = 0.7;
                    if (this.keyStates[KeyCode.KEY_A] == true) {
                        VirtualInput.horizontal = -0.7;
                    } else {
                        VirtualInput.horizontal = 0.7;
                    }
                } else {
                    VirtualInput.vertical = 0;
                    if (this.keyStates[KeyCode.KEY_A] == true) {
                        VirtualInput.horizontal = -1;
                    } else {
                        VirtualInput.horizontal = 1;
                    }
                }
            }
            this.keyStates[keyCode] = false;
        } 
        // else {
        //     console.log('阻止重复松开' + keyCode)
        // }
    }

    // 改变方向
    changeDirection(input: Vec2 = this.actor.input) {
        toDirection = MathUtil.judgeDirection(input);
        if (toDirection == this.actor.currentTowards) {
            //如果方向没有变化，则不进行处理
            return;
        } else {
            //如果方向有变化，则改变方向并切换动画
            this.actor.setTowards(toDirection);
            this.actor.changeAnimation();
        }
    }
    collect() {
        console.log('人物执行了采集动作')
    }
    // changeShelter() {
    //     let stillShelter = true;
    //     let count = 0;
    //     do {//获取当前节点的位次
    //         count++;
    //         if (count > 10) {
    //             break;
    //         }
    //         this.siblingIndex = this.node.getSiblingIndex();
    //         // console.log('当前节点的位次：' + this.siblingIndex);
    //         //定义前后节点的位次
    //         let prevIndex = this.siblingIndex - 1;
    //         let nextIndex = this.siblingIndex + 1;
    //         //判断前后节点是否存在
    //         let prevNode = this.parentChildren[prevIndex];
    //         let nextNode = this.parentChildren[nextIndex];
    //         if (prevNode) {
    //             const prevNodeYPos = prevNode.position.y;
    //             //如果前节点的y坐标小于角色y坐标，则交换位置
    //             if (prevNodeYPos < this.yPos) {
    //                 this.node.setSiblingIndex(prevIndex);
    //                 continue;
    //             }
    //         }
    //         if (nextNode) {
    //             const nextNodeYPos = nextNode.position.y;
    //             //如果后节点的y坐标大于角色y坐标，则交换位置
    //             if (nextNodeYPos > this.yPos) {
    //                 this.node.setSiblingIndex(nextIndex);
    //                 continue;
    //             }
    //         }
    //         //如果未触发交换位置，则说明当前节点已经是最佳位置，终止循环
    //         stillShelter = false;
    //     } while (stillShelter);
    // }

}


