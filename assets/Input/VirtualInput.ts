import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('VirtualInput')
export class VirtualInput extends Component {
   static vertical:number = 0;
   static horizontal:number = 0;
}