# Rhythm Overlap 美术设计参考文档

> 基于用户偏好的 **maimai DX 国际版 PRiSM** 和 **CHUNITHM** 风格调研

---

## 📋 目录

1. [推荐风格：maimai 国际版 PRiSM](#推荐风格maimai-国际版-prism)
2. [色彩系统](#色彩系统)
3. [动态背景设计](#动态背景设计)
4. [动画效果详解](#动画效果详解)
5. [背景素材参考](#背景素材参考)
6. [UI组件风格](#ui组件风格)
7. [CHUNITHM 风格参考](#chunithm-风格参考)
8. [技术实现建议](#技术实现建议)

---

## 推荐风格：maimai 国际版 PRiSM

> 官网: https://maimai.sega.com/

### 核心视觉特点
- **梦幻天空** - 柔和的粉蓝紫渐变
- **彩虹元素** - 温柔的彩虹光带
- **云朵飘动** - 多层云朵缓慢移动
- **棱镜光效** - 星星、菱形闪烁
- **极光效果** - 缓慢流动的极光

### 与日本版对比

| 特点 | 日本版 (CiRCLE) | 国际版 (PRiSM) ✓推荐 |
|-----|----------------|---------------------|
| 主色调 | 浓烈粉紫色 | 柔和粉蓝紫渐变 |
| 风格 | 活泼可爱 | 梦幻唯美 |
| 背景元素 | 斜条纹+像素 | 云朵+极光+彩虹 |
| 动态感 | 快速活跃 | 缓慢流动 |

---

## 色彩系统

### PRiSM 主色板

```css
:root {
  /* 主渐变色 - 梦幻天空 */
  --prism-sky-light: #E8F4FC;     /* 浅天蓝 */
  --prism-sky: #B8E4F9;           /* 天蓝色 */
  --prism-lavender: #D8C8F0;      /* 薰衣草紫 */
  --prism-pink-light: #F9D8E8;    /* 浅粉色 */
  --prism-pink: #F8B4D0;          /* 柔粉色 */
  
  /* 彩虹色谱 */
  --rainbow-red: #FF9B9B;
  --rainbow-orange: #FFD093;
  --rainbow-yellow: #FFF59D;
  --rainbow-green: #C8E6C9;
  --rainbow-blue: #B3E5FC;
  --rainbow-purple: #E1BEE7;
  
  /* 闪光强调色 */
  --shine-white: #FFFFFF;
  --shine-yellow: #FFE566;
  --shine-pink: #FFB6D9;
  --shine-cyan: #80DEEA;
  
  /* 云朵色 */
  --cloud-white: rgba(255, 255, 255, 0.9);
  --cloud-pink: rgba(255, 200, 220, 0.7);
}
```

### 主背景渐变

```css
/* PRiSM 梦幻天空渐变 - 核心背景 */
.prism-gradient {
  background: linear-gradient(
    180deg,
    #E8F4FC 0%,      /* 顶部 - 浅蓝 */
    #D8C8F0 30%,     /* 中上 - 薰衣草 */
    #F8B4D0 60%,     /* 中下 - 柔粉 */
    #F9D8E8 100%     /* 底部 - 浅粉 */
  );
}

/* 动态渐变版本 */
.prism-gradient-animated {
  background: linear-gradient(
    var(--gradient-angle, 180deg),
    #E8F4FC,
    #D8C8F0,
    #F8B4D0,
    #F9D8E8
  );
  animation: gradient-shift 10s linear infinite;
}

@keyframes gradient-shift {
  0% { --gradient-angle: 180deg; }
  50% { --gradient-angle: 200deg; }
  100% { --gradient-angle: 180deg; }
}
```

---

## 动态背景设计

### 官网背景层级结构 (从下到上)

```
┌─────────────────────────────────────────┐
│  Layer 7: 前景云朵 (cloud_front)         │ z-index: 70  飘动 18-20s
├─────────────────────────────────────────┤
│  Layer 6: 彩虹底部 (rainbow_btm)         │ z-index: 60  进入动画 2s
├─────────────────────────────────────────┤
│  Layer 5: 闪光装饰 (shine/stars)         │ z-index: 50  闪烁 3s
├─────────────────────────────────────────┤
│  Layer 4: 月亮 (moon)                    │ z-index: 40  摆动 6s
├─────────────────────────────────────────┤
│  Layer 3: 背景云朵 (cloud_back)          │ z-index: 30  飘动 12-14s
├─────────────────────────────────────────┤
│  Layer 2: 极光效果 (aurora)              │ z-index: 20  流动 50s
├─────────────────────────────────────────┤
│  Layer 1: 渐变背景 (gradient)            │ z-index: 10  缓慢变化 10s
└─────────────────────────────────────────┘
```

### 各层详细配置

#### Layer 1: 渐变背景
```css
.bg--gradient {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #E8F4FC, #D8C8F0, #F8B4D0, #F9D8E8);
  animation: gradient 10s linear infinite;
}

@keyframes gradient {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(10deg); }
}
```

#### Layer 2: 极光效果
```css
.bg--aurora {
  position: absolute;
  width: 200%;
  height: 100%;
  background: url('bg_aurora_pc.png');
  background-size: 2753px auto;
  animation: auroras 50s linear infinite;
  opacity: 0.6;
}

@keyframes auroras {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

#### Layer 3-7: 云朵系统
```css
/* 云朵基础样式 */
.bg--cloud__item {
  position: absolute;
  background-size: contain;
  background-repeat: no-repeat;
  animation: cloud linear infinite;
}

/* 背景云 - 慢速 */
.bg--cloud__item.i1 { animation-duration: 12s; }
.bg--cloud__item.i2 { animation-duration: 14s; }
.bg--cloud__item.i3 { animation-duration: 13s; }

/* 前景云 - 快速 */
.bg--cloud__item.i4 { animation-duration: 18s; }
.bg--cloud__item.i5 { animation-duration: 20s; }
.bg--cloud__item.i6 { animation-duration: 19s; }

@keyframes cloud {
  0% { transform: translateX(-10%); }
  100% { transform: translateX(10%); }
}
```

#### Layer 5: 闪光装饰
```css
/* 菱形闪光 */
.bg--shine__item.diamond {
  animation: diamond 3s linear infinite;
}

/* 星星闪光 */
.bg--shine__item.star {
  animation: star 3s linear infinite;
}

@keyframes diamond {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes star {
  0%, 100% { opacity: 0.5; transform: rotate(0deg) scale(1); }
  50% { opacity: 1; transform: rotate(180deg) scale(1.3); }
}
```

#### Layer 4: 月亮
```css
.bg--moon {
  position: absolute;
  top: 5%;
  left: 5%;
  width: 80px;
  animation: moon 6s linear infinite alternate;
}

@keyframes moon {
  0% { transform: translateY(0) rotate(-5deg); }
  100% { transform: translateY(20px) rotate(5deg); }
}
```

---

## 动画效果详解

### 官网使用的完整动画列表

| 动画名称 | 时长 | 缓动 | 用途 |
|---------|-----|------|-----|
| `gradient` | 10s | linear | 背景渐变微调 |
| `auroras` | 50s | linear | 极光水平移动 |
| `cloud` | 12-20s | linear | 云朵左右飘动 |
| `moon` | 6s | linear alternate | 月亮轻微摆动 |
| `diamond` | 3s | linear | 菱形闪烁 (交错启动) |
| `star` | 3s | linear | 星星闪烁旋转 |
| `rainbow-bottom` | 2s | ease | 彩虹出现动画 |

### 动画交错启动 (Stagger)
```css
/* 不同元素使用不同延迟，创造自然感 */
.diamond-pink { animation-delay: 1s; }
.diamond-yellow { animation-delay: 2s; }
.diamond-white { animation-delay: 0s; }

.star-white { animation-delay: 0s; }
.star-yellow.i1 { animation-delay: 1s; }
.star-yellow.i2 { animation-delay: 1s; }
```

---

## 背景素材参考

### maimai 国际版 PRiSM 素材 URL

| 素材 | 用途 | URL |
|-----|------|-----|
| 极光 | Layer 2 | `https://maimai.sega.com/assets/img/prism/bg/bg_aurora_pc.png` |
| 闪光图 | Layer 5 | `https://maimai.sega.com/assets/img/prism/bg/bg_shines_pc.png` |
| 背景云-左 | Layer 3 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_back_l.png` |
| 背景云-右 | Layer 3 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_back_r.png` |
| 背景云-中 | Layer 3 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_back_c.png` |
| 前景云-左 | Layer 7 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_front_l.png` |
| 前景云-右 | Layer 7 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_front_r.png` |
| 前景云-中 | Layer 7 | `https://maimai.sega.com/assets/img/prism/bg/bg_cloud_front_c.png` |
| 月亮 | Layer 4 | `https://maimai.sega.com/assets/img/prism/bg/bg_moon.png` |
| 彩虹底 | Layer 6 | `https://maimai.sega.com/assets/img/prism/bg/bg_rainbow_btm_pc.png` |

---

## UI组件风格

### PRiSM 风格卡片
```css
.prism-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    0 8px 32px rgba(200, 180, 220, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

### PRiSM 风格按钮
```css
.prism-button {
  background: linear-gradient(135deg, #F8B4D0 0%, #B8E4F9 100%);
  border-radius: 25px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: white;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 15px rgba(248, 180, 208, 0.4);
}
```

---

## CHUNITHM 风格参考

> 官网: https://chunithm.sega.jp/music/new/

### 视觉特点
- **科幻数字世界** - 几何线条、数字城市
- **紫色光线** - 霓虹风格
- **动态元素** - 旋转文字、流动光带

### 背景层级
| 层级 | 元素 | 动画 |
|-----|------|------|
| main-bg-inner | 主背景图 (bg.jpg) | 静态 |
| verse-town | 数字城市 | 静态 |
| verse-belt | 光带装饰 | 15-25s 流动 |
| globe/globe-cross | 地球装饰 | 静态 |
| corner-text | 角落文字 | 60s 旋转 |
| frame | 边框装饰 | 静态 |

### CHUNITHM 素材 URL
| 素材 | URL |
|-----|-----|
| 主背景 | `https://chunithm.sega.jp/$site/components/chuniMainBg/bg.jpg.webp` |
| 数字城市 | `https://chunithm.sega.jp/$site/components/chuniMainBg/verse-town.png.webp` |
| 光带-左 | `https://chunithm.sega.jp/$site/components/chuniMainBg/verse_belt-left.png.webp` |
| 光带-右 | `https://chunithm.sega.jp/$site/components/chuniMainBg/verse_belt-right.png.webp` |
| 浮动文字 | `https://chunithm.sega.jp/$site/components/chuniMainBg/floating_text.png.webp` |

---

## 技术实现建议

### 推荐方案

**方案 A: 纯 CSS 实现 (推荐)**
- 优点：性能好，维护简单
- 缺点：复杂效果需要多层 div

**方案 B: CSS + SVG**
- 优点：可实现复杂路径动画
- 缺点：需要设计师配合

**方案 C: Canvas/WebGL**
- 优点：可实现粒子效果
- 缺点：实现复杂，性能消耗大

### 推荐技术栈
```
React + Framer Motion + CSS Animations
```

### 示例组件结构
```tsx
// PrismBackground.tsx
<div className="prism-bg">
  <div className="prism-bg__gradient" />      {/* Layer 1 */}
  <div className="prism-bg__aurora" />        {/* Layer 2 */}
  <div className="prism-bg__clouds-back">     {/* Layer 3 */}
    <div className="cloud i1" />
    <div className="cloud i2" />
    <div className="cloud i3" />
  </div>
  <div className="prism-bg__moon" />          {/* Layer 4 */}
  <div className="prism-bg__shines">          {/* Layer 5 */}
    <div className="shine diamond" />
    <div className="shine star" />
  </div>
  <div className="prism-bg__rainbow" />       {/* Layer 6 */}
  <div className="prism-bg__clouds-front">    {/* Layer 7 */}
    <div className="cloud i4" />
    <div className="cloud i5" />
    <div className="cloud i6" />
  </div>
</div>
```

### 性能优化
```css
/* GPU 加速 */
.prism-bg * {
  will-change: transform, opacity;
  transform: translateZ(0);
}

/* 减少重绘 */
.prism-bg {
  contain: layout style paint;
}
```

### 移动端适配
```css
@media (max-width: 768px) {
  /* 减少云朵数量 */
  .prism-bg__clouds-back .cloud:nth-child(n+3) { display: none; }
  
  /* 降低动画复杂度 */
  .prism-bg__aurora { animation-duration: 80s; }
}

@media (prefers-reduced-motion: reduce) {
  .prism-bg * { animation: none !important; }
}
```

---

## 示例页面需求清单

### ✅ 必须实现
1. 多层渐变背景 (粉蓝紫梦幻色调)
2. 云朵飘动效果 (至少 4 层)
3. 闪光/星星装饰 (带闪烁动画)
4. 极光流动效果

### 🔲 可选实现
- 彩虹装饰
- 月亮摆动
- 粒子效果

### 交付要求
- React 组件格式 (`PrismBackground.tsx`)
- 包含所有 CSS 动画
- 提供颜色 CSS 变量便于主题切换
- 移动端适配

---

## 参考链接

- maimai DX 国际版: https://maimai.sega.com/
- maimai DX 日本版: https://maimai.sega.jp/
- CHUNITHM 日本版: https://chunithm.sega.jp/music/new/

---

**调研日期**: 2026-01-11  
**推荐风格**: maimai DX PRiSM (国际版)
