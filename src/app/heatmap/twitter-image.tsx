// /heatmap/twitter-image.tsx · Twitter card · 复用同套生成逻辑
// Next.js 16 metadata 文件不支持 re-export · 直接 import default

import OG from "./opengraph-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DU4LEAVING · 押注热力图";
export const revalidate = 60;

export default OG;
