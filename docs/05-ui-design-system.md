# Astryx UI 与视觉规范

## 1. 设计方向

项目使用 Astryx 作为唯一基础设计系统，并参考 Maka 的桌面工作区风格建立自己的 `Tarot Theme`。

设计目标不是复制 Maka 的品牌，而是继承它的产品纪律：

- 当前任务始终是视觉中心；
- Agent 状态和工具过程清晰可检查；
- 工作区宽松但控件紧凑；
- 层级主要由色阶、间距、分隔线和字重形成；
- 组件具有一致的悬停、聚焦、按下、禁用和错误反馈；
- 同一个控件只存在一条实现路径。

塔罗项目在此基础上加入一个受控的“仪式舞台”：

- 黑色宇宙背景；
- 金色魔法阵；
- 卡牌光泽；
- 选牌与翻牌粒子；
- 当前动量和路径价值的符号化展示。

仪式视觉不能侵入设置、历史列表、对话正文和工具详情，使应用仍然像可靠的桌面 Agent，而不是持续播放特效的游戏首页。

## 2. 设计分层

```text
Astryx Reset 与组件基础
        ↓
Tarot Theme 设计令牌
        ↓
通用桌面组件
        ↓
塔罗业务组件
        ↓
抽牌仪式特效层
```

### 2.1 Astryx 基础层

负责：

- reset；
- 控件结构；
- 键盘焦点；
- 可访问性基础；
- Button、Input、Dialog、Menu、Tooltip 等通用交互；
- Theme 的注入与生成。

### 2.2 Tarot Theme

负责：

- 色彩；
- 字体；
- 间距；
- 圆角；
- 阴影和边框；
- 动画时长；
- 语义状态。

### 2.3 产品组合层

负责：

- 应用侧边栏；
- 会话行；
- 消息内容；
- 输入区；
- 工具事件；
- 设置页面；
- 选牌托盘；
- 解读详情。

产品组合不得重新定义基础按钮和表单。

### 2.4 仪式特效层

负责卡牌、粒子、魔法阵和空间光效。该层不能改变基础组件的几何、焦点行为和可读性。

## 3. 主题令牌

主题源文件建议：

```text
src/renderer/theme/tarotTheme.ts
```

基础比例参考 Maka 的 Astryx Theme：

```ts
export const tarotTheme = {
  typography: {
    scale: { base: 14, ratio: 1.125 },
    stat: { fontSize: "20px", fontWeight: 600, lineHeight: 1.25 },
    heading: { fontSize: "16px", fontWeight: 600, lineHeight: 1.25 },
    body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: "12px", fontWeight: 400, lineHeight: 1.375 },
  },
  radius: {
    control: "6px",
    surface: "8px",
    modal: "12px",
    pill: "999px",
  },
  spacing: {
    base: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },
};
```

颜色使用 OKLCH。正式数值应在真实窗口中渲染后确定，不在开发前凭想象冻结。语义结构先固定：

```text
--surface-canvas
--surface-working
--surface-elevated
--surface-selected
--ink-primary
--ink-secondary
--ink-muted
--border-subtle
--border-strong
--accent-primary
--accent-primary-hover
--focus-ring
--semantic-info
--semantic-success
--semantic-warning
--semantic-destructive
--ritual-glow
--ritual-particle
```

颜色规则：

- 主工作区使用冷中性深色；
- `accent-primary` 使用克制的古金色，负责动作、选择和当前状态；
- 语义错误、警告和成功保留独立含义，不全部染成金色；
- 金色不能铺满大面积背景；
- 正文不使用发光文字；
- 粒子颜色不作为唯一信息载体。

## 4. 排版

- 中文优先使用系统原生无衬线字体栈；
- 拉丁与中文保持同一视觉层级；
- 数值、公式、牌 ID 和工具参数使用统一等宽字体；
- 标题依靠字重、颜色和间距，不混用多种装饰字体；
- 塔罗牌名可以有限使用较有仪式感的显示字体，但正文和控件禁止使用；
- 长篇解读保持舒适行高和受控最大宽度。

## 5. 工作区规则

### 一个工作平面

会话、工具过程和解读是同一个工作空间。使用分隔线和色阶区分职责，不把每段内容都包成浮起的卡片。

### 容器需要理由

只有具备独立选择、滚动、折叠、拖动或所有权边界的区域，才使用边框、底色或阴影。

### 深色克制

深色模式优先使用不同表面色阶和细边框。不要给侧边栏、输入框、每条消息和每个按钮都添加霓虹边缘。

### 玻璃效果受限

玻璃和模糊只能用于明确悬浮层，如抽牌确认栏或模态窗口。它不能代替正常的视觉层级。

## 6. 仪式舞台规则

允许使用：

- 缓慢旋转的魔法阵；
- 卡牌边缘的低强度金色反射；
- 选择时一次短暂光圈；
- 确认时粒子汇聚；
- 翻牌时短时爆发；
- 动量和价值变化时一次状态过渡。

避免使用：

- 所有控件持续呼吸发光；
- 大面积紫蓝渐变背景；
- 每条 Agent 消息的装饰性闪烁；
- 无意义的漂浮小图标；
- 长时间阻止操作的动画；
- 多套不同的金色、圆角和阴影规则。

动画层必须支持：

- 跳过；
- 中断；
- `prefers-reduced-motion`；
- 窗口失焦时降帧或暂停；
- 不影响牌面确认和数据库状态。

输入方式不应改变视觉语言。鼠标、键盘、触摸、触控笔以及未来可能出现的摄像头手势，都映射到同一组 Astryx 选择、聚焦、确认和错误状态。摄像头识别不得额外创建一套平行的发光组件或状态颜色。

## 7. 组件优先级

第一批应完整打磨的组件：

1. 主按钮、次按钮、危险按钮、图标按钮；
2. 问题输入框和模型设置输入框；
3. 会话列表行与上下文菜单；
4. 弹窗、确认框、Tooltip 和 Toast；
5. Agent 消息与工具事件折叠项；
6. 水平牌带与暗牌；
7. 已选牌托盘和 `1–5` 顺序标记；
8. 五张牌结果布局；
9. 动量—价值罗盘；
10. 空状态、加载、失败和重试状态。

每个组件至少覆盖：

```text
default
hover
focus-visible
active
disabled
loading
error（适用时）
```

## 8. CSS 与主题组织

建议使用明确的 Cascade Layers：

```css
@layer reset, astryx-tokens, astryx-components, product-components, ritual-effects, utilities;

@import "@astryxdesign/core/reset.css" layer(reset);
@import "@astryxdesign/core/astryx.css" layer(astryx-components);
@import "./theme/tarot.css" layer(astryx-tokens);
@import "./styles/product.css" layer(product-components);
@import "./styles/ritual-effects.css" layer(ritual-effects);
```

规则：

- Theme 是颜色、间距、圆角和排版的唯一来源；
- 产品 CSS 只做组合，不复制组件底层样式；
- 特效 CSS 不覆盖 Astryx 的 focus、disabled 和 error 状态；
- 禁止在业务组件中散落未经令牌管理的颜色和阴影；
- 主题生成物应提供检查命令，防止源文件与生成 CSS 漂移。

## 9. 视觉验证

每次完成核心 UI 后都需要真实渲染检查：

- Windows 100%、125%、150% 缩放；
- 1024×720 最小支持窗口；
- 360px、600px 和 1024px 关键响应式宽度；
- 常用桌面窗口尺寸；
- 长中文问题与长篇解读；
- 五张正位、五张逆位和混合方向；
- 空历史、加载、断网、API 错误、输出校验失败；
- 键盘导航和可见焦点；
- 鼠标拖动与 Chromium 模拟触摸；
- 减少动态效果；
- 深色表面之间是否仍有清晰层级。

核心选牌可访问性要求：

- 牌带使用可描述的列表或网格语义；
- 每张暗牌提供“第 N 张未揭示卡牌”的可访问名称，不提前泄露牌面身份；
- 选择后播报“已选择，顺序 X，共 5 张”；
- 取消后播报新的选择数量与顺序变化；
- `已选择 N/5` 使用 `aria-live` 礼貌播报；
- 键盘可以完成浏览、选择、取消、清空和确认；
- 翻牌完成后播报牌名、正逆位与牌位；
- 动量和价值罗盘必须同时提供数值、标签和文字解释，颜色与图形不能是唯一信息；
- 跳过动画和减少动态效果不改变信息完整性。

组件层建议维护 Storybook 或等价展示页，并通过真实 Electron 窗口进行最终验收。浏览器中的组件效果不能替代 Windows 桌面窗口检查；Windows 模拟触摸也不能替代未来移动端的真机手感测试。

## 10. 参考来源

- [Maka Design System](https://github.com/maka-agent/maka-agent/blob/main/DESIGN.md)
- [Maka Astryx Theme Build](https://github.com/maka-agent/maka-agent/blob/main/scripts/build-astryx-theme.mjs)
- [Maka Renderer Style Composition](https://github.com/maka-agent/maka-agent/blob/main/apps/desktop/src/renderer/styles.css)

Maka 使用 Apache-2.0 许可证。若后续直接复制而非重新实现其主题或组件代码，需要保留相应许可证和 NOTICE；仅参考设计原则和公开令牌结构时，也应在项目文档中保留来源说明。
