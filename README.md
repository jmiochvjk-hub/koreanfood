# 伴饭 BanFan

面向来韩国旅行和生活的中文用户的消费发现产品。

当前网页包含四个频道：

- FOOD：餐厅与食品；支持榜单、地图、用户补充新地点。
- BEAUTY：首批 3,000 件 Olive Young 商品；中文品名优先显示，韩文原名保留用于门店核对。
- LIFE：首批 3,000 件 Daiso 商品，以及后续便利店、家居与文具；平台导入，用户晒图评价。
- FASHION：首批 100 个品牌、3,000 件商品；平台导入，用户晒图评价。

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
- `config.js`：浏览器可用的 Supabase anon 配置和 Kakao JavaScript key。
- `migrations/`：分阶段 Supabase 数据结构与 RLS 迁移。
- `supabase-schema.sql`：仅用于旧版 `food_places` 的初始安装，不再代表完整模型。
- `scripts/catalog/`：可断点续跑的官方商品资料导入器；原始快照与翻译结果只保存在被忽略的 `.catalog-cache/`。

## 数据库升级

迁移顺序和执行时机见 `migrations/README.md`。

网页已经要求登录后才能补充地点。部署这一版本前，应确认
`migrations/20260927_03_require_auth.sql` 已执行，关闭旧版匿名地点写入。

大商品库使用 `migrations/20260927_09_catalog_scale.sql` 提供分页、全库搜索和仅限
服务端调用的批量写入。导入器以来源商品编号去重，可以安全重跑；每条商品保留原始
页面、采集时间和来源排序，便于后续更新或下架。商品中文名和品牌中文名由服务端
分批生成，原文始终保留，不将导入密钥或 AI 密钥放进网页。

## 登录配置

网页已接入 Supabase 邮箱验证码登录。浏览和本地收藏无需账号；登录后收藏会同步
到账号，发布带图评价、社区图文、申请新增商品和补充美食地点时必须登录。

在 Supabase Dashboard 的 Authentication → URL Configuration 中配置：

- Site URL：正式上线后填写 `https://banfantujian.com`
- Redirect URLs：开发阶段加入 `http://127.0.0.1:4173/**`
- Redirect URLs：部署阶段加入 GitHub Pages 地址和
  `https://banfantujian.com/**`

评价记录和压缩后的实拍照片会先以 `pending` 状态写入 Supabase，再由服务端自动
检查文字和图片中的色情、未成年人色情、暴力及血腥暴力内容。正常评价会立即转为
`published` 并公开；命中规则的评价及照片会被删除，用户可以修改后重新提交。
旧版本留在浏览器本机的评价仍会继续显示。

自动审核由 `moderate-review`、`moderate-community-post`、
`moderate-item-request` 和 `moderate-place-submission` 四个 Edge Function 执行，
全部使用 DeepSeek。生产环境必须在 Supabase Edge Function Secrets 中配置
`DEEPSEEK_API_KEY`；密钥不能写入 `config.js` 或其他浏览器可读取的文件。商品
申请通过后会自动写入公共商品库；地图地点通过后会同时写入现有地图与规范地点表。

## 本地预览

```bash
python3 -m http.server 4173
```

打开 `http://127.0.0.1:4173/`。

## 地图配置

网页的韩国交互地图使用 Kakao Maps。餐厅经纬度保存在 Supabase 中，不绑定地图供应商；当第三方底图在某个地区无法加载时，页面自动显示站内地点列表和完整榜单，搜索、收藏、评价与详情仍可使用。腾讯 Web 地图没有韩国道路与地名底图，高德海外商业使用需要另行授权，因此二者都不作为当前网页默认底图。

上线前必须在 Kakao 开发者控制台为 JavaScript key 登记 `https://banfantujian.com`、`https://www.banfantujian.com` 以及本地开发 origin。中国大陆版本后续应把地图看作可替换展示层，优先评估自托管韩国矢量瓦片或小程序原生地图能力，不迁移地点数据。

## 安全

Supabase anon key 本来就会暴露在浏览器中，真正的安全边界是 Row Level
Security。永远不要把 service-role key 写入网页、移动应用或公开仓库。
