'use strict';

// GridTile 的菱形 Gizmo 绘制（编辑器场景中显示为菱形高亮）
// 参考 Cocos Creator 的 Gizmo API：使用 svg.js 在场景中绘制

class GridTileGizmo extends Editor.Gizmo {
  init() {
    // 可在此初始化参数
  }

  onCreateRoot() {
    // 创建 svg 根分组与菱形多边形
    this._tool = this._root.group();
    this._poly = this._tool.polygon([]);
    // 样式：无填充，亮青色描边
    this._poly.fill('none');
    this._poly.stroke({ color: '#00AAFF', width: 2 });
    // 不参与点击事件（仅显示）
    this._poly.style('pointer-events', 'none');
  }

  onUpdate() {
    const node = this.node;
    const target = this.target;
    if (!node || !target) return;

    // 获取瓦片尺寸，优先取 UITransform.contentSize（GridTile.refresh 已设置）
    let width = 64, height = 32;
    let ui = null;
    try {
      ui = node.getComponent('cc.UITransform');
    } catch (e) {}
    if (ui && ui.contentSize) {
      width = ui.contentSize.width;
      height = ui.contentSize.height;
    }

    const halfW = width / 2;
    const halfH = height / 2;

    // 将局部坐标转换为世界坐标
    const toWorld = (x, y) => {
      // 3.x 推荐使用 UITransform 转换
      if (ui && ui.convertToWorldSpaceAR) {
        return ui.convertToWorldSpaceAR(cc.v2(x, y));
      }
      // 兼容旧接口
      if (node.convertToWorldSpaceAR) {
        return node.convertToWorldSpaceAR(cc.v2(x, y));
      }
      const wp = node.worldPosition || node.position || { x: 0, y: 0 };
      return cc.v2((wp.x || 0) + x, (wp.y || 0) + y);
    };

    // 顶点：上、右、下、左（以中心为原点）
    const ptsWorld = [
      toWorld(0, halfH),
      toWorld(halfW, 0),
      toWorld(0, -halfH),
      toWorld(-halfW, 0),
    ];
    const ptsPixel = ptsWorld.map((w) => {
      const p = this.worldToPixel(w);
      return Editor.GizmosUtils.snapPixelWihVec2(p);
    });

    // 更新菱形绘制
    this._poly.plot(ptsPixel);

    // 根据组件属性更新样式（若存在）
    try {
      const lw = typeof target.lineWidth === 'number' ? target.lineWidth : 2;
      let stroke = '#00AAFF';
      if (target.lineColor) {
        const c = target.lineColor;
        stroke = `rgba(${c.r||0},${c.g||0},${c.b||0},1)`;
      }
      this._poly.stroke({ color: stroke, width: lw });

      let fillOpacity = typeof target.fillOpacity === 'number' ? target.fillOpacity : 0;
      if (fillOpacity > 0) {
        let fill = stroke;
        if (target.lineColor) {
          const c = target.lineColor;
          const a = Math.max(0, Math.min(255, fillOpacity)) / 255;
          fill = `rgba(${c.r||0},${c.g||0},${c.b||0},${a})`;
        }
        this._poly.fill(fill);
      } else {
        this._poly.fill('none');
      }
    } catch (e) {
      // ignore style errors
    }
  }

  // gizmo 可见性：选中或正在编辑时显示
  visible() {
    return this.selecting || this.editing;
  }

  // 绘制层：scene 层即可
  layer() {
    return 'scene';
  }
}

module.exports = GridTileGizmo;