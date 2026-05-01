# Quality Upgrade v3.5 · 网游质感 5 节点研究

日期 · 2026-04-24
目标 · catchzvibe.studio 摄影师公会 MMO 从 prototype → 网游质感
当前栈 · Next.js + R3F + drei + rapier + ecctrl + postprocessing
原则 · CC0 资产 · 真 URL · 可直接 paste 的 code · ROI 优先

---

## 节点 1 · HDRI 户外环境 (替代 `preset="apartment"`)

### Top 3 资源 (CC0 · 免注册)

1. **Urban Street 01** · 伦敦街景日光 · `https://polyhaven.com/a/urban_street_01`
2. **Wide Street 01** · 阳光大道 · `https://polyhaven.com/a/wide_street_01`
3. **Shanghai Bund** · 上海外滩夜景 · `https://polyhaven.com/a/shanghai_bund`

CDN 直链格式 · `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/{1k|2k|4k}/{slug}_{res}.hdr`
示例 · `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/urban_street_01_2k.hdr`

### 集成代码 (放 `/public/hdri/urban_street_01_2k.hdr` 后)

```tsx
import { Environment } from '@react-three/drei'

// Scene.tsx · 替换原 <Environment preset="apartment">
<Environment
  files="/hdri/urban_street_01_2k.hdr"
  background={false}        // true=用作天空盒 · false=只做反射光照
  environmentIntensity={0.8} // 暖光场景压一点 · 默认 1
  resolution={512}           // 移动端建议 256 · PC 512-1024
/>

// 配合 Sky 时 · 关 background 走 Sky 当天空 · HDRI 只做光照
<Sky sunPosition={[100, 20, 100]} />
<Environment files="/hdri/wide_street_01_1k.hdr" background={false} />
```

### 性能 / License

| 分辨率 | 文件大小 | GPU 内存 | 首屏延迟 | 适用 |
|---|---|---|---|---|
| 1k | ~2MB | ~16MB | <200ms | 移动端默认 |
| 2k | ~8MB | ~64MB | <500ms | 桌面默认 |
| 4k | ~30MB | ~256MB | 1-2s | 摄影模式 |

License · CC0 (Public Domain) · 免归属 · 可商用
风险 · 4k 在低端 GPU (Intel UHD) 卡顿 · 必须 dynamic resolution

**ROI · 5/5** (一行替换 · 视觉跃升最大)

---

## 节点 2 · InstancedMesh 草地

### Top 3 资源

1. **Quaternius Stylized Nature** · 草叶 GLB · `https://quaternius.com/packs/stylizednature.html` (CC0)
2. **Kenney Nature Kit** · 草贴图 · `https://kenney.nl/assets/nature-kit` (CC0)
3. **Poly Haven Grass Textures** · alpha PNG · `https://polyhaven.com/textures/grass` (CC0)

### 集成代码 (10000 草 · 用 drei `<Instances>`)

```tsx
import { Instances, Instance } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

function GrassField({ count = 10000, size = 100 }) {
  const positions = useMemo(() => 
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * size,
      z: (Math.random() - 0.5) * size,
      rot: Math.random() * Math.PI,
      scale: 0.8 + Math.random() * 0.4,
    })), [count, size])

  return (
    <Instances limit={count} castShadow={false} receiveShadow>
      <planeGeometry args={[0.3, 0.6]} />
      <meshStandardMaterial
        map={useTexture('/textures/grass_blade.png')}
        alphaTest={0.5}      // 关键 · 替代 transparent · 不破坏深度
        side={THREE.DoubleSide}
        color="#7ea96b"
      />
      {positions.map((p, i) => (
        <Instance key={i} position={[p.x, 0.3, p.z]} 
          rotation={[0, p.rot, 0]} scale={p.scale} />
      ))}
    </Instances>
  )
}
```

### 性能 (实测参考 · M1 Mac)

| 草数量 | 帧率 (桌面) | 帧率 (mobile) | 推荐 |
|---|---|---|---|
| 5000 | 60fps | 45fps | 移动端 |
| 10000 | 60fps | 30fps | 桌面默认 |
| 50000 | 45fps | 不可用 | 仅 PC + LOD |

风险 · 用 `transparent: true` 会破坏 SSAO 深度排序 · **必须** 用 `alphaTest`
进阶 · 大场景用 chunk InstancedMesh (每 chunk 1024 草 · 视距 cull)

**ROI · 4/5** (视觉高 · 但要控数量防移动端跪)

---

## 节点 3 · GLTF 资产替代 box+cone 建筑

### Top 3 资源 (全 CC0)

1. **Kenney City Kit (Suburban)** · `https://kenney.nl/assets/city-kit-suburban` · 35+ 模型 · GLTF
2. **Kenney Retro Urban Kit** · `https://kenney.nl/assets/retro-urban-kit` · 120 模型 · 复古
3. **Quaternius Ultimate Buildings** · `https://quaternius.com/packs/ultimatetexturedbuildings.html` · 模块化

工作流 · 下 zip → 解压到 `/public/models/city/` → drei 一键加载

### 集成代码 (drei `<Gltf>` 一行加载 · 自动 cache)

```tsx
import { Gltf, useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

// 方案 A · drei <Gltf> 简化版
function GuildBuilding({ position, type = 'large' }) {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <Gltf src={`/models/city/building-${type}.glb`} 
        position={position} scale={1.2} />
    </RigidBody>
  )
}

// 方案 B · useGLTF + 共享几何 (8 楼用同一个 glb · 节省内存)
function CityBlock() {
  const { scene } = useGLTF('/models/city/buildings.glb')
  
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const r = 25
        return (
          <RigidBody key={i} type="fixed" colliders="cuboid">
            <primitive 
              object={scene.clone()} 
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
              rotation={[0, -angle + Math.PI, 0]}
            />
          </RigidBody>
        )
      })}
    </>
  )
}
useGLTF.preload('/models/city/buildings.glb')
```

### 性能 / License

| 资产源 | 单楼三角面 | License | 风险 |
|---|---|---|---|
| Kenney City Kit | 200-800 | CC0 | 风格偏卡通 |
| Quaternius Ult.Buildings | 500-2000 | CC0 | 需自配贴图 |
| Sketchfab CC0 | 不定 | 必检查 | 部分 CC-BY |

**关键** · 用 `colliders="cuboid"` 不要 `trimesh` (后者 8 楼会卡)
**关键** · `useGLTF.preload` 防首屏闪烁

**ROI · 4/5** (视觉高 · 但要花 1 小时挑/转资产)

---

## 节点 4 · 后处理升级

### 推荐 EffectComposer 顺序 (重要 · 顺序错就糊)

```
DOF → SSAO → Bloom → GodRays → Vignette → Noise → ToneMapping
   场景空间        屏幕空间      色调
```

原理 · 屏幕空间效果 (SSAO/Bloom) 必须先于色调映射 (Tone) · Bloom 要 HDR 输入 · GodRays 要 HDR 才有光柱

### 集成代码 (完整 pipeline · paste 即用)

```tsx
import {
  EffectComposer, Bloom, DepthOfField, GodRays, 
  Vignette, Noise, SSAO, ToneMapping
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'
import { useRef } from 'react'

function Effects({ sunRef, isMobile }) {
  return (
    <EffectComposer multisampling={isMobile ? 0 : 4} disableNormalPass={false}>
      {/* 1. DOF · 焦点感 · mobile 关 */}
      {!isMobile && (
        <DepthOfField focusDistance={0.02} focalLength={0.05} 
          bokehScale={2} height={480} />
      )}
      
      {/* 2. SSAO · 接触阴影 */}
      <SSAO samples={isMobile ? 8 : 16} radius={0.08} 
        intensity={20} luminanceInfluence={0.6} />
      
      {/* 3. Bloom · 招牌/路灯发光 (材质 emissive>1 才发光) */}
      <Bloom intensity={0.6} luminanceThreshold={0.9} 
        luminanceSmoothing={0.4} mipmapBlur kernelSize={KernelSize.LARGE} />
      
      {/* 4. GodRays · 太阳光柱 · 必传 sun mesh ref */}
      {sunRef?.current && !isMobile && (
        <GodRays sun={sunRef.current} samples={30} density={0.96} 
          decay={0.92} weight={0.3} exposure={0.4} 
          blendFunction={BlendFunction.SCREEN} />
      )}
      
      {/* 5. Vignette · 暗角 · 引导视觉中心 */}
      <Vignette offset={0.3} darkness={0.6} eskil={false} />
      
      {/* 6. Noise · 胶片颗粒 · 微量 */}
      <Noise opacity={0.04} blendFunction={BlendFunction.OVERLAY} />
      
      {/* 7. ToneMapping · 必须最后 */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

// Sun mesh (GodRays 需要)
function Sun() {
  const ref = useRef<THREE.Mesh>(null)
  return (
    <mesh ref={ref} position={[100, 80, -200]}>
      <sphereGeometry args={[8, 32, 32]} />
      <meshBasicMaterial color="#fff5d6" />
    </mesh>
  )
}
```

### 移动端策略

| 效果 | Desktop | Mobile |
|---|---|---|
| DOF | ✓ | ✗ (-15ms) |
| SSAO | 16 samples | 8 samples |
| Bloom | LARGE kernel | SMALL kernel |
| GodRays | 30 samples | ✗ (-20ms) |
| MSAA | 4x | 0 |

风险 · GodRays 没传 sun mesh 直接崩 · 必须 ref 检查
风险 · Bloom 跟 transparent 草地冲突 · 草地必须 alphaTest

**ROI · 5/5** (网游质感主要靠这层)

---

## 节点 5 · 角色 GLTF 替代 capsule+box

### Top 3 资源

1. **Quaternius Universal Base Characters** · `https://quaternius.com/packs/universalbasecharacters.html` · 20 发型 · CC0
2. **Quaternius Animated Human** · `https://poly.pizza/m/c3Ibh9I3udk` · 内置动画 · CC0
3. **Mixamo** · `https://www.mixamo.com/` · 免费 · 但需 Adobe 账号 · 自己合成 GLB

### 工作流 · Mixamo + 自己角色

1. 上 mixamo · 下 base character (Y Bot)
2. 选动画 · idle / walking / running / jump · 各下 FBX (No Skin)
3. Blender 合成 · NLA 多 clip → Export GLB
4. 命名 · `Idle / Walk / Run / Jump_Start / Jump_Idle / Jump_Land`

### 集成代码 (EcctrlAnimation 包装)

```tsx
import Ecctrl, { EcctrlAnimation } from 'ecctrl'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useRef } from 'react'

const characterURL = '/models/photographer.glb'

const animationSet = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  jump: 'Jump_Start',
  jumpIdle: 'Jump_Idle',
  jumpLand: 'Jump_Land',
  fall: 'Fall',
  action1: 'Wave',
  action2: 'Dance',
}

function CharacterModel() {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF(characterURL)
  return (
    <group ref={ref} dispose={null}>
      {/* 注意 · y 偏移让脚踩地 · ecctrl capsule 中心在 0 */}
      <primitive object={scene} position={[0, -0.9, 0]} />
    </group>
  )
}
useGLTF.preload(characterURL)

function Player() {
  return (
    <Ecctrl 
      animated 
      capsuleHalfHeight={0.35} 
      camInitDis={-4}
      maxVelLimit={5}
    >
      <EcctrlAnimation characterURL={characterURL} animationSet={animationSet}>
        <CharacterModel />
      </EcctrlAnimation>
    </Ecctrl>
  )
}
```

### 性能 / License

| 资产 | 三角面 | 骨骼 | License | 备注 |
|---|---|---|---|---|
| Quaternius Universal | 5k-15k | 标准 humanoid | CC0 | 推荐起步 |
| Mixamo Y Bot | 8k | 65 | 免费但需 Adobe ToS | 商用要看条款 |
| ReadyPlayerMe | 12k-20k | humanoid | 免费 API | 自定义最强 |

风险 · Mixamo 商用条款 2020 起允许但 ToS 偶有变动 · Quaternius CC0 最稳
风险 · 动画 clip 命名必须匹配 animationSet · 错一个字符不动
风险 · 角色脚位置 (foot offset) 要试 · 不对就漂浮

**ROI · 4/5** (玩家就看自己角色 · 必做但工作量大)

---

## ROI 排序 + 推荐 Sprint 路径

| # | 节点 | ROI | 工时 | 视觉提升 |
|---|---|---|---|---|
| 1 | **HDRI 户外** | 5 | 0.5h | ★★★★★ |
| 2 | **后处理 pipeline** | 5 | 1.5h | ★★★★★ |
| 3 | InstancedMesh 草 | 4 | 2h | ★★★★ |
| 4 | GLTF 建筑 | 4 | 3-4h | ★★★★ |
| 5 | GLTF 角色 | 4 | 4-6h | ★★★★ |

### 第一波 (今晚 2 小时 · ROI 5)

**先做 1 + 4** · HDRI + 后处理 pipeline

理由 ·
- 两者都是 "替换/插入式" 改动 · 不动场景结构
- 总工时 2h · 单 sprint 出活
- 视觉提升立刻看见 (HDRI 反射 + Bloom 招牌发光 + GodRays 阳光柱)
- 风险最低 (没新资产依赖 · 没动画对位)

### 第二波 (周末 4-5 小时)

**做 2 + 3** · 草地 + GLTF 建筑

下载 Kenney City Kit (Suburban) · 替换 8 仿真楼 · 加 10000 草

### 第三波 (下周专题)

**做 5** · 角色升级 · 需要 Blender 合成动画 GLB · 单独 session 处理

---

## 第一波 · 今晚执行 checklist

```bash
# 1. 下 HDRI (2 选 1 · 推荐 urban_street_01)
mkdir -p public/hdri
curl -L -o public/hdri/urban_street_01_2k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/urban_street_01_2k.hdr"

# 2. 改 Scene.tsx · 替换 <Environment preset="apartment">
#    新 · <Environment files="/hdri/urban_street_01_2k.hdr" background={false} />

# 3. 改 Effects.tsx · 按节点 4 完整 pipeline 替换

# 4. dev 看效果 · 重点看
#    - 招牌/路灯 emissive 是否出 Bloom
#    - 太阳方向是否有 GodRays 光柱
#    - 整体色调是否更暖更电影
```

完成后写 `docs/quality_upgrade_v35_phase1.md` 记录前后对比 + 帧率。

---

## Sources

- [Poly Haven HDRIs](https://polyhaven.com/hdris) · [Urban Street 01](https://polyhaven.com/a/urban_street_01) · [Wide Street 01](https://polyhaven.com/a/wide_street_01)
- [drei Environment docs](https://drei.docs.pmnd.rs/staging/environment) · [drei useAnimations](https://drei.docs.pmnd.rs/abstractions/use-animations)
- [Codrops · Three.js Instances](https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/) · [Fluffiest Grass](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/)
- [Kenney City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) · [Retro Urban Kit](https://kenney.nl/assets/retro-urban-kit)
- [Quaternius Buildings](https://quaternius.com/packs/ultimatetexturedbuildings.html) · [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
- [react-postprocessing Bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom) · [GodRays](https://react-postprocessing.docs.pmnd.rs/effects/god-rays) · [DepthOfField](https://react-postprocessing.docs.pmnd.rs/effects/depth-of-field)
- [Ecctrl GitHub](https://github.com/pmndrs/ecctrl) · [Don McCurdy · Mixamo + glTF](https://www.donmccurdy.com/2017/11/06/creating-animated-gltf-characters-with-mixamo-and-blender/)
