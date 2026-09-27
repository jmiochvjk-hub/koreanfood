# 伴饭 BanFan

面向来韩国旅行和生活的中文用户的消费发现产品。

当前网页包含四个频道：

- FOOD：餐厅与食品；支持榜单、地图、用户补充新地点。
- BEAUTY：已接入首批 200 件 Olive Young 商品；中文品名优先显示，韩文原名保留用于门店核对。
- LIFE：Daiso、便利店、家居与文具；平台导入，用户晒图评价。
- FASHION：韩国品牌、单品与穿搭；平台导入，用户晒图评价。

## 产品数据规则

- 商品品目由平台批量导入和去重，普通用户不能直接创建。
- 美食地点允许用户补充，但需要审核。
- 评价必须绑定一个已存在的商品品目或地点。
- 顶部搜索同时覆盖四个频道，列表统一按评价数量从高到低排列。
- 搜不到商品时提交缺少品目申请，由平台审核后入库。
- 地点坐标与地图供应商解耦；网页和小程序可以使用不同地图。

## 文件

- `index.html`：品目发现、FOOD 地图与评价界面。
- `tokens.css` 与 `redesign.css`：设计变量和响应式界面。
- `app.js`：云端商品/地点读取、搜索筛选、分页、收藏同步、带图评价、FOOD 地图和地点新增。
- `config.js`：浏览器可用的 Supabase anon 配置、腾讯地图 JS key，以及迁移期间可选的 Kakao 后备 key。
- `migrations/`：分阶段 Supabase 数据结构与 RLS 迁移。
- `supabase-schema.sql`：仅用于旧版 `food_places` 的初始安装，不再代表完整模型。

## 数据库升级

迁移顺序和执行时机见 `migrations/README.md`。

网页已经要求登录后才能补充地点。部署这一版本前，应确认
`migrations/20260927_03_require_auth.sql` 已执行，关闭旧版匿名地点写入。

## 登录配置

网页已接入 Supabase 邮箱验证码登录。浏览和本地收藏无需账号；登录后收藏会同步
到账号，发布带图评价和补充美食地点时必须登录。

在 Supabase Dashboard 的 Authentication → URL Configuration 中配置：

- Site URL：正式上线后填写 `https://banfantujian.com`
- Redirect URLs：开发阶段加入 `http://127.0.0.1:4173/**`
- Redirect URLs：部署阶段加入 GitHub Pages 地址和
  `https://banfantujian.com/**`

评价记录和压缩后的实拍照片会写入 Supabase，并以 `pending` 状态等待审核；只有
发布状态的评价会向其他用户展示。旧版本留在浏览器本机的评价仍会继续显示。

## 本地预览

```bash
python3 -m http.server 4173
```

打开 `http://127.0.0.1:4173/`。

## 地图配置

网页已具备腾讯地图 JavaScript API GL 适配层，但 2026-09-27 的实机测试中，腾讯地图在首尔可以加载控件和自有标记，却没有韩国道路与地名底图，因此生产配置保持关闭。下一步验证高德世界地图；在中国可访问且韩国底图完整之前，网页临时回退到 Kakao。

餐厅经纬度保存在 Supabase 中，不绑定任何地图供应商。腾讯 key 可以留作后续微信小程序和海外 WebService 能力评估，不应因为供应商切换而迁移地点数据。

## 安全

Supabase anon key 本来就会暴露在浏览器中，真正的安全边界是 Row Level
Security。永远不要把 service-role key 写入网页、移动应用或公开仓库。
