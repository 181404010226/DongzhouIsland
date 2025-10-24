import { _decorator, Component, Node, SpriteFrame, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NumberDisplayComponent')
export class NumberDisplayComponent extends Component {
    @property({ type: [SpriteFrame], displayName: '数字图片数组(0-9)' })
    public numberSprites: SpriteFrame[] = [];

    @property({ type: SpriteFrame, displayName: '小数点图片' })
    public decimalPointSprite: SpriteFrame | null = null;

    @property({ displayName: '数字显示缩放', range: [0.01, 2.0, 0.01] })
    public numberScale: number = 1.0;

    @property({ displayName: '数字间距', range: [1, 30, 1] })
    public numberSpacing: number = 1;

    @property({ displayName: '小数位数', range: [0, 5, 1] })
    public decimalPlaces: number = 1;

    private numberNodes: Node[] = [];
    private currentValue: number = 0;

    /**
     * 设置要显示的数值
     */
    public setValue(value: number) {
        this.currentValue = value;
        this.updateNumberDisplay();
    }

    /**
     * 获取当前显示的数值
     */
    public getValue(): number {
        return this.currentValue;
    }

    /**
     * 更新数字显示
     */
    public updateNumberDisplay() {
        // 清除现有的数字节点
        this.clearNumberNodes();

        // 获取要显示的数字字符串
        const valueStr = this.currentValue.toFixed(this.decimalPlaces);
        
        // 创建数字节点
        this.createNumberNodes(valueStr);
    }

    /**
     * 清除数字节点
     */
    private clearNumberNodes() {
        for (const node of this.numberNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.numberNodes = [];
    }

    /**
     * 创建数字节点
     */
    private createNumberNodes(valueStr: string) {
        // 先创建所有节点以获取实际宽度
        const tempNodes: Node[] = [];
        const nodeWidths: number[] = [];
        
        // 第一步：创建所有节点并计算实际宽度
        for (let i = 0; i < valueStr.length; i++) {
            const char = valueStr[i];
            let spriteFrame: SpriteFrame | null = null;
            
            if (char === '.') {
                spriteFrame = this.decimalPointSprite;
            } else if (char >= '0' && char <= '9') {
                const digit = parseInt(char);
                if (digit >= 0 && digit < this.numberSprites.length) {
                    spriteFrame = this.numberSprites[digit];
                }
            }
            
            if (spriteFrame) {
                const digitNode = new Node(`Digit_${char}_${i}`);
                // 继承父节点的 layer（例如 UI_2D），确保与摄像机可见性一致
                digitNode.layer = this.node.layer;
                digitNode.parent = this.node;
                
                const sprite = digitNode.addComponent(Sprite);
                sprite.spriteFrame = spriteFrame;
                digitNode.setScale(this.numberScale, this.numberScale, 1);
                
                // 确保存在 UITransform，再进行尺寸与锚点设置
                const uiTransform = digitNode.getComponent(UITransform) || digitNode.addComponent(UITransform);
                if (uiTransform && spriteFrame) {
                    const size = spriteFrame.originalSize;
                    uiTransform.setContentSize(size.width, size.height);
                    
                    // 如果是小数点，设置锚点为底部对齐
                    if (char === '.') {
                        uiTransform.setAnchorPoint(0.5, 1); // 水平居中，垂直底部对齐
                    } else {
                        uiTransform.setAnchorPoint(0.5, 0.5); // 数字保持居中
                    }
                    
                    // 考虑缩放后的实际宽度
                    const actualWidth = size.width * this.numberScale;
                    nodeWidths.push(actualWidth);
                } else {
                    nodeWidths.push(12 * this.numberScale); // 默认宽度
                }
                
                tempNodes.push(digitNode);
            }
        }
        
        // 第二步：计算总宽度
        let totalWidth = 0;
        for (let i = 0; i < nodeWidths.length; i++) {
            totalWidth += nodeWidths[i];
            if (i < nodeWidths.length - 1) {
                totalWidth += this.numberSpacing; // 添加间距
            }
        }
        
        // 第三步：重新定位所有节点，居中显示
        const startX = -totalWidth / 2;
        let currentX = startX;
        
        for (let i = 0; i < tempNodes.length; i++) {
            const node = tempNodes[i];
            const nodeWidth = nodeWidths[i];
            const char = valueStr[i];
            
            // 设置节点位置
            if (char === '.') {
                // 小数点：水平居中，垂直位置需要调整到底部对齐
                node.setPosition(currentX + nodeWidth / 2, 0, 0);
            } else {
                // 数字：正常居中对齐
                node.setPosition(currentX + nodeWidth / 2, 0, 0);
            }
            
            // 更新下一个节点的X位置
            currentX += nodeWidth + this.numberSpacing;
            
            this.numberNodes.push(node);
        }
    }

    /**
     * 获取字符宽度
     */
    private getCharacterWidth(char: string): number {
        if (char === '.') {
            return this.decimalPointSprite ? this.decimalPointSprite.originalSize.width : 8;
        } else if (char >= '0' && char <= '9') {
            const digit = parseInt(char);
            if (digit >= 0 && digit < this.numberSprites.length && this.numberSprites[digit]) {
                return this.numberSprites[digit].originalSize.width;
            }
        }
        
        return 12; // 默认宽度
    }

    /**
     * 设置数字缩放
     */
    public setNumberScale(scale: number) {
        this.numberScale = scale;
        this.updateNumberDisplay();
    }

    /**
     * 设置数字间距
     */
    public setNumberSpacing(spacing: number) {
        this.numberSpacing = spacing;
        this.updateNumberDisplay();
    }

    /**
     * 设置小数位数
     */
    public setDecimalPlaces(places: number) {
        this.decimalPlaces = places;
        this.updateNumberDisplay();
    }

    /**
     * 获取数字节点总宽度
     */
    public getTotalWidth(): number {
        const valueStr = this.currentValue.toFixed(this.decimalPlaces);
        let totalWidth = 0;
        
        for (let i = 0; i < valueStr.length; i++) {
            const char = valueStr[i];
            totalWidth += this.getCharacterWidth(char) * this.numberScale;
            
            if (i < valueStr.length - 1) {
                totalWidth += this.numberSpacing;
            }
        }
        
        return totalWidth;
    }

    onDestroy() {
        this.clearNumberNodes();
    }
}